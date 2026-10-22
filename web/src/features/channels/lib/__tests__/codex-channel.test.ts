/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.
*/
import { expect, test } from 'vitest'

import { CHANNEL_FORM_DEFAULT_VALUES, channelFormSchema } from '../channel-form'

function codexForm(key: string) {
  return {
    ...CHANNEL_FORM_DEFAULT_VALUES,
    name: 'Codex',
    type: 57,
    models: 'gpt-5',
    key,
  }
}

test('accepts a complete Codex auth.json credential', () => {
  const key = JSON.stringify({
    auth_mode: 'chatgpt',
    OPENAI_API_KEY: null,
    tokens: {
      id_token: 'id',
      access_token: 'access',
      refresh_token: 'refresh',
      account_id: 'account',
    },
    last_refresh: '2026-10-21T00:00:00Z',
  })
  expect(channelFormSchema.safeParse(codexForm(key)).success).toBe(true)
})

test('keeps flat Codex credentials valid', () => {
  const key = JSON.stringify({ access_token: 'access', account_id: 'account' })
  expect(channelFormSchema.safeParse(codexForm(key)).success).toBe(true)
})

test('rejects nested Codex credentials without an account ID', () => {
  const key = JSON.stringify({ tokens: { access_token: 'access' } })
  expect(channelFormSchema.safeParse(codexForm(key)).success).toBe(false)
})
