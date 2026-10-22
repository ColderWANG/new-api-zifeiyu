/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU
Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { execFileSync } from 'node:child_process'

import { describe, expect, it } from 'vitest'

import {
  buildCodexConfigToml,
  buildCodexEnvCommand,
  buildClientLaunchCommand,
  normalizeClientApiBaseUrl,
} from '../client-config'

describe('client setup commands', () => {
  it('generates Codex config.toml with the selected model and an environment-backed key', () => {
    const config = buildCodexConfigToml({
      apiBaseUrl: 'https://gateway.example.com/proxy/v1',
      model: 'gpt-5-codex',
      credentialMode: 'environment',
    })
    expect(config).toBe(
      'model = "gpt-5-codex"\n' +
        'model_provider = "newapi"\n\n' +
        '[model_providers.newapi]\n' +
        'name = "New API"\n' +
        'base_url = "https://gateway.example.com/proxy/v1"\n' +
        'env_key = "NEWAPI_API_KEY"\n' +
        'wire_api = "responses"\n'
    )
    expect(config).not.toContain('sk-')
  })

  it('generates a standalone Codex config.toml with the exact escaped API key', () => {
    const apiKey = 'sk-test"\\private'
    const config = buildCodexConfigToml({
      apiBaseUrl: 'https://gateway.example.com/v1',
      model: 'gpt-5-codex',
      credentialMode: 'embedded',
      apiKey,
    })
    expect(config).toContain(
      `experimental_bearer_token = ${JSON.stringify(apiKey)}`
    )
    expect(config).not.toContain('env_key =')
    expect(config).toContain('wire_api = "responses"')
  })

  it('exports an API key without executing shell metacharacters', () => {
    const key = "sk-test'$(printf injected)"
    const command = buildCodexEnvCommand(key)
    const output = execFileSync('sh', [
      '-c',
      `${command}; printf '%s' "$NEWAPI_API_KEY"`,
    ]).toString()
    expect(output).toBe(key)
  })

  it.each([
    ['https://gateway.example.com/', 'https://gateway.example.com/v1'],
    [
      'https://gateway.example.com/proxy/v1/',
      'https://gateway.example.com/proxy/v1',
    ],
    ['http://localhost:3000/proxy', 'http://localhost:3000/proxy/v1'],
  ])('normalizes %s to one API version path', (address, expected) => {
    expect(normalizeClientApiBaseUrl(address)).toBe(expected)
  })

  it.each([
    'http://gateway.example.com',
    'javascript:alert(1)',
    'https://user:password@gateway.example.com',
    'https://gateway.example.com?key=secret',
  ])('rejects an unsafe API address %s', (address) => {
    expect(normalizeClientApiBaseUrl(address)).toBeNull()
  })

  it('passes the exact key, model and URL to Codex without shell expansion', () => {
    const key = "sk-test'$(printf injected)"
    const model = 'gpt-5-codex'
    const url = 'https://gateway.example.com/proxy/v1'
    const command = buildClientLaunchCommand({
      app: 'codex',
      apiKey: key,
      apiBaseUrl: url,
      model,
    })
    const output = execFileSync('sh', [
      '-c',
      `codex() { printf '%s\n' "$NEWAPI_API_KEY" "$@"; }; ${command}`,
    ]).toString()
    expect(output.split('\n').filter(Boolean)).toEqual([
      key,
      '-c',
      `model="${model}"`,
      '-c',
      'model_provider="newapi"',
      '-c',
      'model_providers.newapi.name="New API"',
      '-c',
      `model_providers.newapi.base_url="${url}"`,
      '-c',
      'model_providers.newapi.env_key="NEWAPI_API_KEY"',
      '-c',
      'model_providers.newapi.wire_api="responses"',
    ])
  })

  it.each([
    ['responses', '@ai-sdk/openai'],
    ['chat', '@ai-sdk/openai-compatible'],
  ] as const)(
    'passes a valid OpenCode %s provider with the selected model',
    (mode, expectedPackage) => {
      const key = 'sk-test-only'
      const command = buildClientLaunchCommand({
        app: 'opencode',
        apiKey: key,
        apiBaseUrl: 'https://gateway.example.com/v1',
        model: 'gpt-5-codex',
        openCodeApiMode: mode,
      })
      const output = execFileSync('sh', [
        '-c',
        `opencode() { printf '%s\n' "$NEWAPI_API_KEY" "$OPENCODE_CONFIG_CONTENT"; }; ${command}`,
      ])
        .toString()
        .trimEnd()
        .split('\n')
      expect(output[0]).toBe(key)
      const config = JSON.parse(output[1])
      expect(config.model).toBe('newapi/gpt-5-codex')
      expect(config.provider.newapi.npm).toBe(expectedPackage)
      expect(config.provider.newapi.options).toEqual({
        baseURL: 'https://gateway.example.com/v1',
        apiKey: '{env:NEWAPI_API_KEY}',
      })
      expect(config.provider.newapi.models).toHaveProperty('gpt-5-codex')
      expect(output[1]).not.toContain(key)
    }
  )
})
