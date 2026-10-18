#!/usr/bin/env bash
# New API / QuantumNous derivative: deployment entry point for this custom fork.
# Run on the production host: bash /root/zifeiyu/project/new-api/upgrade.sh
#
# 涉及数据库变更时，先审查迁移兼容性和恢复方案，再依次执行：
# 1. 仅预检查：拉取远程提交并检查升级条件，不构建、不停服、不执行数据库迁移。
#    bash upgrade.sh --check --allow-database-change
# 2. 正式升级：构建镜像，停止应用并备份数据库，然后启动新版本并验证服务。
#    bash upgrade.sh --allow-database-change
# --allow-database-change 表示已确认数据库变更风险，不会跳过备份和升级检查。
# 若新应用已尝试启动后升级失败，需要人工检查恢复，不会自动回退旧应用或数据库。
set -euo pipefail
ROOT=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)
exec python3 - "$ROOT" "$@" <<'PY'
import argparse
import fcntl
import json
import os
import re
import shutil
import signal
import subprocess
import sys
import tempfile
import time
import urllib.request
from datetime import datetime
from pathlib import Path
from urllib.parse import unquote, urlsplit

import yaml

ROOT = Path(sys.argv[1]).resolve()
BACKUPS = Path(os.environ.get('UPGRADE_BACKUP_DIR', str(ROOT.parent.parent / 'backups/new-api'))).resolve()
LOCAL = os.environ.get('UPGRADE_LOCAL_URL', 'http://127.0.0.1:3001').rstrip('/')
PUBLIC = os.environ.get('UPGRADE_PUBLIC_URL', 'https://ai.112102.xyz').rstrip('/')
STOP_TIMEOUT = 150
HEALTH_TIMEOUT = 180
LOG = None
COMPOSE = ['docker', 'compose', '--project-directory', str(ROOT), '-p', 'new-api',
           '-f', str(ROOT / 'docker-compose.yml'), '-f', str(ROOT / 'docker-compose.override.yml')]


def log(message):
    line = f'[{datetime.now().astimezone().isoformat(timespec="seconds")}] {message}'
    print(line, flush=True)
    if LOG:
        LOG.write(line + '\n')
        LOG.flush()


def run(*args, stream=False, stdout=None, stdin=None):
    if stream:
        with subprocess.Popen(args, cwd=ROOT, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True) as proc:
            for line in proc.stdout:
                print(line, end='', flush=True)
                if LOG:
                    LOG.write(line)
                    LOG.flush()
            code = proc.wait()
            if code:
                raise RuntimeError(f'{args[0]} {args[1]} failed (exit {code}); see upgrade.log')
        return ''
    result = subprocess.run(args, cwd=ROOT, stdin=stdin, stdout=stdout or subprocess.PIPE,
                            stderr=subprocess.PIPE)
    if result.returncode:
        if LOG:
            LOG.write(result.stderr.decode(errors='replace') + '\n')
            LOG.flush()
        raise RuntimeError(f'{args[0]} {args[1]} failed (exit {result.returncode})')
    return result.stdout.decode().strip() if result.stdout else ''


def inspect(name):
    return json.loads(run('docker', 'inspect', name))[0]


def environment(container):
    return dict(item.split('=', 1) for item in container['Config']['Env'] if '=' in item)


def runtime_signature(container):
    return {
        'environment': environment(container),
        'mounts': sorted((m['Type'], m['Source'], m['Destination'], m['RW']) for m in container['Mounts']),
        'networks': sorted(container['NetworkSettings']['Networks']),
        'ports': container['HostConfig']['PortBindings'],
        'restart': container['HostConfig']['RestartPolicy'],
        'command': container['Config']['Cmd'],
        'entrypoint': container['Config']['Entrypoint'],
        'user': container['Config']['User'],
        'working_dir': container['Config']['WorkingDir'],
    }


def config_without_image(config):
    config = json.loads(json.dumps(config))
    config['services']['new-api'].pop('image', None)
    return config


def atomic_write(path, content):
    mode = path.stat().st_mode & 0o777 if path.exists() else 0o600
    fd, temp = tempfile.mkstemp(prefix='.upgrade-', dir=path.parent)
    try:
        with os.fdopen(fd, 'wb') as output:
            output.write(content)
            output.flush()
            os.fsync(output.fileno())
        os.chmod(temp, mode)
        os.replace(temp, path)
    finally:
        if os.path.exists(temp):
            os.unlink(temp)


def http_check(base, version=None):
    headers = {'User-Agent': 'Mozilla/5.0 NewAPI-Upgrade', 'Cache-Control': 'no-cache'}
    suffix = f'?upgrade_check={time.time_ns()}'
    req = urllib.request.Request(base + '/api/status' + suffix, headers=headers)
    with urllib.request.urlopen(req, timeout=20) as response:
        body = json.load(response)
    if body.get('success') is not True:
        raise RuntimeError('Status endpoint did not report success')
    if version and body.get('data', {}).get('version') != version:
        raise RuntimeError('Status endpoint is not serving the expected application version')
    for path in ('/', '/sign-in'):
        with urllib.request.urlopen(urllib.request.Request(base + path + suffix, headers=headers), timeout=20) as response:
            if 'text/html' not in response.headers.get('Content-Type', ''):
                raise RuntimeError(f'{path} did not serve HTML')
            if b'id="root"' not in response.read():
                raise RuntimeError(f'{path} did not serve the application shell')


def verify_application(image_id, before, version=None):
    deadline = time.monotonic() + HEALTH_TIMEOUT
    while time.monotonic() < deadline:
        app = inspect('new-api')
        if app['Image'] != image_id:
            raise RuntimeError('Running image does not match the selected image')
        if runtime_signature(app) != runtime_signature(before):
            raise RuntimeError('Runtime configuration changed unexpectedly; details remain in protected backups')
        if app['State'].get('Health', {}).get('Status') == 'healthy':
            break
        time.sleep(3)
    else:
        raise RuntimeError('Application did not become healthy in time')
    http_check(LOCAL, version)
    http_check(PUBLIC, version)


def restore_application(backup, before):
    old_ref = before['Config']['Image']
    if inspect(old_ref)['Id'] != before['Image']:
        raise RuntimeError('Previous image reference no longer matches its recorded image ID; manual recovery required')
    run(*COMPOSE, 'stop', '-t', str(STOP_TIMEOUT), 'new-api', stream=True)
    atomic_write(ROOT / 'docker-compose.override.yml', (backup / 'docker-compose.override.yml').read_bytes())
    run(*COMPOSE, 'up', '-d', '--no-deps', '--pull', 'never', 'new-api', stream=True)
    verify_application(before['Image'], before)


def preflight():
    if run('git', 'branch', '--show-current') != 'main':
        raise RuntimeError('Run from the custom main branch; no branch is switched automatically')
    remote = run('git', 'remote', 'get-url', 'custom').removesuffix('.git').rstrip('/')
    if remote not in ('https://github.com/zi-fei-yu-2020/new-api-zifeiyu', 'git@github.com:zi-fei-yu-2020/new-api-zifeiyu'):
        raise RuntimeError('custom must point to the Zifeiyu repository, never the official upstream repository')
    if run('git', 'diff', '--cached', '--name-only'):
        raise RuntimeError('Commit or save staged changes before upgrading')
    dirty = set(run('git', 'diff', '--name-only').splitlines())
    if dirty - {'docker-compose.yml', 'new-api.service'}:
        raise RuntimeError('Unexpected tracked local changes; save them before upgrading')
    before = inspect('new-api')
    if before['State'].get('Health', {}).get('Status') != 'healthy':
        raise RuntimeError('Current application is not healthy; diagnose it before upgrading')
    labels = before['Config']['Labels']
    expected_files = ','.join(str(ROOT / name) for name in ('docker-compose.yml', 'docker-compose.override.yml'))
    if labels.get('com.docker.compose.project.config_files') != expected_files or labels.get('com.docker.compose.project') != 'new-api':
        raise RuntimeError('Compose project/files differ from the supported deployment layout')
    env = environment(before)
    dsn = urlsplit(env.get('SQL_DSN', ''))
    pg = inspect('postgres')
    pg_env = environment(pg)
    if dsn.scheme not in ('postgres', 'postgresql') or dsn.hostname != 'postgres' or unquote(dsn.path.lstrip('/')) != pg_env.get('POSTGRES_DB') or unquote(dsn.username or '') != pg_env.get('POSTGRES_USER'):
        raise RuntimeError('Automatic backup supports only this deployment\'s PostgreSQL container/database')
    if env.get('LOG_SQL_DSN'):
        raise RuntimeError('A separate log database requires an explicitly reviewed backup procedure')
    dependencies = {name: inspect(name)['Id'] for name in ('postgres', 'redis')}
    if not pg['State']['Running'] or not inspect('redis')['State']['Running']:
        raise RuntimeError('PostgreSQL or Redis is not running')
    override = yaml.safe_load((ROOT / 'docker-compose.override.yml').read_text())
    if not isinstance(override, dict) or not isinstance(override.get('services', {}).get('new-api'), dict):
        raise RuntimeError('A valid existing docker-compose.override.yml is required')
    config = json.loads(run(*COMPOSE, 'config', '--format', 'json'))
    if inspect(config['services']['new-api']['image'])['Id'] != before['Image']:
        raise RuntimeError('Compose image differs from the running application')
    if shutil.disk_usage(ROOT).free < 6 * 1024 ** 3 or shutil.disk_usage(tempfile.gettempdir()).free < 3 * 1024 ** 3:
        raise RuntimeError('Insufficient free space for build and backups (6 GiB project / 3 GiB temporary minimum)')
    http_check(LOCAL)
    http_check(PUBLIC)
    return before, dependencies, override, config


def activate(backup, before, dependencies, target_image, version, database_changed):
    stopped = False
    new_started = False
    try:
        # The old application continues serving during the entire build.
        stopped = True
        run(*COMPOSE, 'stop', '-t', str(STOP_TIMEOUT), 'new-api', stream=True)
        if inspect('new-api')['State']['Running']:
            raise RuntimeError('Application is still running; consistent backup cannot start')
        with (backup / 'postgres.dump').open('wb') as output:
            run('docker', 'exec', 'postgres', 'sh', '-c', 'exec pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc', stdout=output)
        if (backup / 'postgres.dump').stat().st_size == 0:
            raise RuntimeError('Database backup is empty')
        with (backup / 'postgres.dump').open('rb') as source, (backup / 'postgres.list').open('wb') as listing:
            run('docker', 'exec', '-i', 'postgres', 'pg_restore', '--list', stdin=source, stdout=listing)
        run('tar', '-czf', str(backup / 'data.tar.gz'), '-C', str(ROOT), 'data')
        run('tar', '-tzf', str(backup / 'data.tar.gz'))
        override = yaml.safe_load((backup / 'docker-compose.override.yml').read_text())
        override['services']['new-api']['image'] = target_image
        atomic_write(ROOT / 'docker-compose.override.yml', yaml.safe_dump(override, sort_keys=False).encode())
        expected = json.loads((backup / 'compose-before.json').read_text())
        actual = json.loads(run(*COMPOSE, 'config', '--format', 'json'))
        if config_without_image(expected) != config_without_image(actual):
            raise RuntimeError('Compose configuration changed beyond the application image')
        new_started = True  # A failed `up` can still have started migrations.
        run(*COMPOSE, 'up', '-d', '--no-deps', '--pull', 'never', 'new-api', stream=True)
        verify_application(inspect(target_image)['Id'], before, version)
        if any(inspect(name)['Id'] != value for name, value in dependencies.items()):
            raise RuntimeError('A dependency container was replaced unexpectedly')
    except BaseException:
        if stopped and not (new_started and database_changed):
            log('Upgrade failed; restoring the previous application image (database is not restored).')
            restore_application(backup, before)
            log('Previous application restored and verified.')
        elif stopped:
            log('Database-sensitive upgrade failed. Automatic image/database rollback is disabled; manual recovery is required.')
        raise


def main(argv):
    global LOG
    parser = argparse.ArgumentParser(description='Upgrade the Zifeiyu New API deployment from custom/main.')
    parser.add_argument('--check', action='store_true', help='Fetch and validate only; do not build, stop or replace the application')
    parser.add_argument('--allow-database-change', action='store_true', help='Acknowledge reviewed database-sensitive changes; disables automatic rollback after new app startup')
    parser.add_argument('--rollback', metavar='BACKUP_DIR', help='Restore the application image from one backup; never restores database or Git history')
    args = parser.parse_args(argv)
    if args.rollback and (args.check or args.allow_database_change):
        parser.error('--rollback cannot be combined with upgrade options')
    os.umask(0o077)
    os.chdir(ROOT)
    git_dir = Path(run('git', 'rev-parse', '--absolute-git-dir'))
    with (git_dir / 'new-api-upgrade.lock').open('a+') as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            raise RuntimeError('Another upgrade or rollback is already running') from None
        if args.rollback:
            backup = Path(args.rollback).resolve()
            if not backup.is_relative_to(BACKUPS) or backup == BACKUPS:
                raise RuntimeError('Rollback directory must be inside the configured backup root')
            manifest = json.loads((backup / 'manifest.json').read_text())
            if manifest['root'] != str(ROOT) or manifest['database_changed']:
                raise RuntimeError('Backup belongs to another deployment or requires manual database compatibility review')
            current = inspect('new-api')
            if current['Image'] != manifest['new_image_id']:
                raise RuntimeError('This backup does not match the currently running image; refusing a stale rollback')
            before = json.loads((backup / 'container-before.json').read_text())
            if runtime_signature(current) != runtime_signature(before):
                raise RuntimeError('Runtime configuration has changed since this backup; review it manually')
            LOG = (backup / 'rollback.log').open('a')
            restore_application(backup, before)
            log('Rollback complete. Git source stays at the newer commit; database was not restored.')
            return

        before, dependencies, override, config = preflight()
        run('git', 'fetch', 'custom', 'main', stream=True)
        target = run('git', 'rev-parse', 'refs/remotes/custom/main^{commit}')
        head = run('git', 'rev-parse', 'HEAD')
        run('git', 'merge-base', '--is-ancestor', head, target)
        changed = run('git', 'diff', '--name-only', head, target).splitlines()
        if set(changed) & {'docker-compose.yml', 'docker-compose.override.yml', '.env', 'new-api.service'}:
            raise RuntimeError('Deployment files changed upstream; review and integrate them before using automatic upgrade')
        old_revision = before['Config'].get('Labels', {}).get('org.opencontainers.image.revision')
        database_changed = True
        if old_revision:
            paths = run('git', 'diff', '--name-only', old_revision, target).splitlines()
            database_changed = any(path.startswith(('model/', 'migrations/')) or path in ('go.mod', 'go.sum') for path in paths)
        log(f'Target custom/main: {target}; database-sensitive changes: {database_changed}')
        if database_changed and not args.allow_database_change:
            raise RuntimeError('Review database compatibility and recovery first, then explicitly use --allow-database-change')
        if args.check:
            log('Preflight passed. No build, application restart or production configuration change performed.')
            return
        if old_revision == target:
            run('git', 'merge', '--ff-only', target, stream=True)
            log('Already running the latest custom/main revision; nothing to rebuild or restart.')
            return

        stamp = datetime.now().strftime('%Y%m%d-%H%M%S')
        backup = BACKUPS / f'{stamp}-{target[:12]}'
        backup.mkdir(parents=True, mode=0o700)
        LOG = (backup / 'upgrade.log').open('x')
        log(f'Backup and build log: {backup}')
        for name in ('docker-compose.yml', 'docker-compose.override.yml', '.env', 'new-api.service'):
            if (ROOT / name).exists():
                shutil.copyfile(ROOT / name, backup / name)
        (backup / 'container-before.json').write_text(json.dumps(before))
        (backup / 'compose-before.json').write_text(json.dumps(config))
        image = f'new-api-zifeiyu:{target[:12]}'
        version = f'custom-main-{target[:12]}'
        rollback_tag = f'new-api-zifeiyu:rollback-{stamp}'
        run('docker', 'tag', before['Image'], rollback_tag)
        try:
            with tempfile.TemporaryDirectory(prefix='new-api-build-') as temp:
                context = Path(temp)
                archive = context / 'source.tar'
                source = context / 'source'
                source.mkdir()
                run('git', 'archive', '--format=tar', '-o', str(archive), target)
                run('tar', '-xf', str(archive), '-C', str(source))
                (source / 'VERSION').write_text(version + '\n')
                # Bound compiler concurrency in the temporary build only; no production source edits.
                dockerfile = (source / 'Dockerfile').read_text()
                if 'RUN go build ' not in dockerfile:
                    raise RuntimeError('Dockerfile build layout changed; review build resource limits first')
                (source / 'Dockerfile').write_text(dockerfile.replace('RUN go build ', 'RUN GOMAXPROCS=2 go build -p=2 ', 1))
                log('Building on the server; the old application remains online.')
                run('docker', 'build', '--progress=plain', '--target', 'builder', str(source), stream=True)
                run('docker', 'build', '--progress=plain', '--label', f'org.opencontainers.image.revision={target}',
                    '--label', 'org.opencontainers.image.source=https://github.com/zi-fei-yu-2020/new-api-zifeiyu',
                    '-t', image, str(source), stream=True)
            candidate = inspect(image)
            if candidate['Config'].get('Labels', {}).get('org.opencontainers.image.revision') != target:
                raise RuntimeError('Built image revision mismatch')
            manifest = {'root': str(ROOT), 'target': target, 'source_before': head, 'old_image': before['Config']['Image'],
                        'old_image_id': before['Image'], 'new_image': image, 'new_image_id': candidate['Id'],
                        'rollback_tag': rollback_tag, 'database_changed': database_changed}
            (backup / 'manifest.json').write_text(json.dumps(manifest, indent=2))
            run('git', 'merge', '--ff-only', target, stream=True)
            if json.loads(run(*COMPOSE, 'config', '--format', 'json')) != config:
                raise RuntimeError('Compose configuration drifted during build; application left unchanged')
            if inspect('new-api')['Id'] != before['Id']:
                raise RuntimeError('Application changed during build; refusing to replace another deployment')
            log('Build passed. Stopping only new-api for a consistent backup and image switch.')
            activate(backup, before, dependencies, image, version, database_changed)
            (backup / 'result.txt').write_text('success\n')
            log(f'Upgrade complete: {image}. Local/public checks passed; PostgreSQL and Redis were not recreated.')
            log(f'Application rollback: bash {ROOT}/upgrade.sh --rollback {backup}')
        except BaseException:
            (backup / 'result.txt').write_text('failed\n')
            raise


def interrupted(signum, frame):
    raise RuntimeError(f'Interrupted by signal {signum}')


if __name__ == '__main__':
    signal.signal(signal.SIGTERM, interrupted)
    try:
        main(sys.argv[2:])
    except (Exception, KeyboardInterrupt) as error:
        log(f'FAILED: {type(error).__name__}: {error}')
        sys.exit(1)
    finally:
        if LOG:
            LOG.close()
PY
