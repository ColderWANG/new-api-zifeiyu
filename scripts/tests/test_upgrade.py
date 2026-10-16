"""Deployment failure-path tests. Docker/Git boundaries are mocked; no live services are touched.

Run on Linux: python3 -m unittest discover -s scripts/tests -p test_upgrade.py -v
"""
import json
import os
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch


@unittest.skipUnless(os.name == 'posix', 'The production upgrade entry point uses Linux file locks')
class UpgradeSafetyTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='new-api-upgrade-test-')
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name) / 'repo'
        self.root.mkdir()
        (self.root / '.git').mkdir()
        self.backup = Path(self.temp.name) / 'backups' / 'fixture'
        self.backup.mkdir(parents=True)
        self.old_override = b'services:\n  new-api:\n    image: old-image\n'
        for parent in (self.root, self.backup):
            (parent / 'docker-compose.override.yml').write_bytes(self.old_override)
        self.config = {'services': {'new-api': {'image': 'old-image', 'environment': {'EXAMPLE': 'unchanged'}}}}
        (self.backup / 'compose-before.json').write_text(json.dumps(self.config))
        self.before = {'Id': 'old-container', 'Image': 'old-id', 'Config': {'Image': 'old-image', 'Labels': {'org.opencontainers.image.revision': 'a' * 40}}}
        script = Path(os.environ.get('UPGRADE_SCRIPT') or str(Path(__file__).resolve().parents[2] / 'upgrade.sh'))
        source = script.read_text().split("<<'PY'\n", 1)[1].rsplit('\nPY', 1)[0]
        self.ns = {'__name__': 'upgrade_under_test'}
        with patch.object(sys, 'argv', ['upgrade.sh', str(self.root)]):
            exec(compile(source, str(script), 'exec'), self.ns)
        self.ns['BACKUPS'] = self.backup.parent
        self.commands = []
        self.failure = None
        self.ns.update(run=self.run_command, inspect=self.inspect, log=lambda message: None)
        self.verifications = []
        self.ns['verify_application'] = self.verify
        self.ns['preflight'] = lambda: (self.before, {'postgres': 'pg-id', 'redis': 'redis-id'}, {}, self.config)
        self.addCleanup(self.close_log)

    def close_log(self):
        if self.ns['LOG']:
            self.ns['LOG'].close()

    def inspect(self, name):
        return {
            'new-api': {**self.before, 'State': {'Running': False}},
            'old-image': {'Id': 'old-id'},
            'new-image': {'Id': 'new-id'},
            'postgres': {'Id': 'pg-id'},
            'redis': {'Id': 'redis-id'},
        }[name]

    def verify(self, image_id, before, version=None):
        self.verifications.append(image_id)
        if image_id == 'new-id' and self.failure == 'health':
            raise RuntimeError('new image unhealthy')

    def run_command(self, *args, **kwargs):
        self.commands.append(args)
        if args[:3] == ('git', 'rev-parse', '--absolute-git-dir'):
            return str(self.root / '.git')
        if args[:2] == ('git', 'rev-parse'):
            return 'a' * 40 if args[2] == 'HEAD' else 'b' * 40
        if args[:2] == ('git', 'diff'):
            return 'web/src/features/image-studio/api.ts'
        if args[:2] == ('tar', '-xf'):
            source = Path(args[4])
            (source / 'Dockerfile').write_text('FROM example\nRUN go build -o new-api\n')
        if args[:2] == ('docker', 'build') and self.failure == 'build':
            raise RuntimeError('image build failed')
        if args[:4] == ('docker', 'exec', 'postgres', 'sh'):
            if self.failure == 'backup':
                raise RuntimeError('database backup failed')
            kwargs['stdout'].write(b'fixture archive')
        if args[:2] == ('docker', 'compose') and 'config' in args:
            config = json.loads(json.dumps(self.config))
            override = self.ns['yaml'].safe_load((self.root / 'docker-compose.override.yml').read_text())
            config['services']['new-api']['image'] = override['services']['new-api']['image']
            if self.failure == 'configuration' and config['services']['new-api']['image'] == 'new-image':
                config['services']['new-api']['environment']['EXAMPLE'] = 'unexpected'
            return json.dumps(config)
        return ''

    def activate(self, database_changed=False):
        self.ns['activate'](self.backup, self.before, {'postgres': 'pg-id', 'redis': 'redis-id'}, 'new-image', 'test-version', database_changed)

    def test_build_failure_never_stops_or_replaces_the_running_application(self):
        self.failure = 'build'
        cwd = Path.cwd()
        try:
            with self.assertRaisesRegex(RuntimeError, 'image build failed'):
                self.ns['main']([])
        finally:
            os.chdir(cwd)
        self.assertFalse(any('stop' in args or 'up' in args for args in self.commands))
        self.assertEqual((self.root / 'docker-compose.override.yml').read_bytes(), self.old_override)

    def test_backup_failure_resumes_old_application_without_starting_new_image(self):
        self.failure = 'backup'
        with self.assertRaisesRegex(RuntimeError, 'database backup failed'):
            self.activate()
        self.assertEqual(self.verifications, ['old-id'])
        self.assertEqual((self.root / 'docker-compose.override.yml').read_bytes(), self.old_override)

    def test_health_failure_restores_original_override_and_verifies_old_image(self):
        self.failure = 'health'
        with self.assertRaisesRegex(RuntimeError, 'new image unhealthy'):
            self.activate()
        self.assertEqual(self.verifications, ['new-id', 'old-id'])
        self.assertEqual((self.root / 'docker-compose.override.yml').read_bytes(), self.old_override)
        updates = [args for args in self.commands if args[:2] == ('docker', 'compose') and 'up' in args]
        self.assertEqual(len(updates), 2)
        self.assertTrue(all(args[-1] == 'new-api' and '--no-deps' in args and '--pull' in args and 'never' in args for args in updates))

    def test_configuration_drift_is_rejected_before_new_image_starts(self):
        self.failure = 'configuration'
        with self.assertRaisesRegex(RuntimeError, 'configuration changed'):
            self.activate()
        self.assertEqual(self.verifications, ['old-id'])
        self.assertEqual((self.root / 'docker-compose.override.yml').read_bytes(), self.old_override)

    def test_database_sensitive_failure_does_not_start_old_app_against_new_schema(self):
        self.failure = 'health'
        with self.assertRaisesRegex(RuntimeError, 'new image unhealthy'):
            self.activate(database_changed=True)
        self.assertEqual(self.verifications, ['new-id'])
        self.assertIn('new-image', (self.root / 'docker-compose.override.yml').read_text())

    def test_success_updates_only_application_and_preserves_other_configuration(self):
        self.activate()
        self.assertEqual(self.verifications, ['new-id'])
        self.assertEqual(self.ns['config_without_image'](self.config), self.ns['config_without_image'](json.loads(self.run_command(*self.ns['COMPOSE'], 'config', '--format', 'json'))))
        self.assertFalse(any('down' in args or 'prune' in args for args in self.commands))


if __name__ == '__main__':
    unittest.main()
