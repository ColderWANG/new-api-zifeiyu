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

export type ClientApp = 'codex' | 'opencode'
export type OpenCodeApiMode = 'responses' | 'chat'

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", `'"'"'`)}'`
}

export function normalizeClientApiBaseUrl(address: string): string | null {
  try {
    const url = new URL(address.trim())
    const isLocalhost = ['localhost', '127.0.0.1', '[::1]'].includes(
      url.hostname
    )
    if (
      (url.protocol !== 'https:' &&
        !(url.protocol === 'http:' && isLocalhost)) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    ) {
      return null
    }
    const path = url.pathname.replace(/\/+$/, '')
    return `${url.origin}${path.endsWith('/v1') ? path : `${path}/v1`}`
  } catch {
    return null
  }
}

export function buildCodexConfigToml(input: {
  apiBaseUrl: string
  model: string
}): string {
  return [
    `model = ${JSON.stringify(input.model)}`,
    'model_provider = "newapi"',
    '',
    '[model_providers.newapi]',
    'name = "New API"',
    `base_url = ${JSON.stringify(input.apiBaseUrl)}`,
    'env_key = "NEWAPI_API_KEY"',
    'wire_api = "responses"',
    '',
  ].join('\n')
}

export function buildCodexEnvCommand(apiKey: string): string {
  return `export NEWAPI_API_KEY=${shellQuote(apiKey)}`
}

export function buildClientLaunchCommand(input: {
  app: ClientApp
  apiKey: string
  apiBaseUrl: string
  model: string
  openCodeApiMode?: OpenCodeApiMode
}): string {
  const { app, apiKey, apiBaseUrl, model } = input
  if (app === 'codex') {
    const overrides = [
      `model=${JSON.stringify(model)}`,
      'model_provider="newapi"',
      'model_providers.newapi.name="New API"',
      `model_providers.newapi.base_url=${JSON.stringify(apiBaseUrl)}`,
      'model_providers.newapi.env_key="NEWAPI_API_KEY"',
      'model_providers.newapi.wire_api="responses"',
    ]
    return `NEWAPI_API_KEY=${shellQuote(apiKey)} codex ${overrides.map((value) => `-c ${shellQuote(value)}`).join(' ')}`
  }

  const config = {
    $schema: 'https://opencode.ai/config.json',
    model: `newapi/${model}`,
    provider: {
      newapi: {
        npm:
          input.openCodeApiMode === 'chat'
            ? '@ai-sdk/openai-compatible'
            : '@ai-sdk/openai',
        name: 'New API',
        options: {
          baseURL: apiBaseUrl,
          apiKey: '{env:NEWAPI_API_KEY}',
        },
        models: {
          [model]: { name: model },
        },
      },
    },
  }
  return `NEWAPI_API_KEY=${shellQuote(apiKey)} OPENCODE_CONFIG_CONTENT=${shellQuote(JSON.stringify(config))} opencode`
}
