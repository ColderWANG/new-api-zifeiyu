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

For commercial licensing, please contact support@quantumnous.com>.
*/
import { describe, expect, it } from 'vitest'

import {
  USER_ROLE_SEARCH_VALUES,
  USER_STATUS_SEARCH_VALUES,
} from '@/features/users/constants'

import { channelsSearchSchema } from '../_authenticated/channels'
import { modelsSearchSchema } from '../_authenticated/models/$section'
import { usageLogsSearchSchema } from '../_authenticated/usage-logs/$section'
import { usersSearchSchema } from '../_authenticated/users'

describe('table URL search contracts', () => {
  it('exports users enums from business constants', () => {
    expect(USER_STATUS_SEARCH_VALUES).toEqual(['-1', '1', '2'])
    expect(USER_ROLE_SEARCH_VALUES).toEqual(['1', '10', '100'])
  })

  it('clears only an invalid users field and preserves paging and token/filter state', () => {
    expect(
      usersSearchSchema.parse({
        page: 4,
        pageSize: 50,
        filter: 'root',
        status: '99',
        role: '100',
        group: 'vip',
      })
    ).toMatchObject({
      page: 4,
      pageSize: 50,
      filter: 'root',
      status: undefined,
      role: '100',
      group: ['vip'],
    })
  })

  it('compresses legacy repeated users values to one value', () => {
    expect(
      usersSearchSchema.parse({ status: ['1', '2'], role: ['10', '100'] })
    ).toEqual({ status: '1', role: '10' })
  })

  it('prioritizes URL channel filters and only falls back to all status locally', () => {
    expect(
      channelsSearchSchema.parse({
        page: 2,
        filter: 'openai',
        status: 'disabled',
        type: ['24', '1'],
        group: 'default',
      })
    ).toMatchObject({
      page: 2,
      filter: 'openai',
      status: 'disabled',
      type: '24',
      group: 'default',
    })

    expect(channelsSearchSchema.parse({ status: 'invalid' }).status).toBe('all')
    expect(
      channelsSearchSchema.parse({ type: 'not-a-number' }).type
    ).toBeUndefined()
  })

  it('tightens model filters and compresses legacy repeated values', () => {
    expect(
      modelsSearchSchema.parse({
        filter: 'gpt',
        status: ['disabled', 'enabled'],
        square_state: ['hidden', 'visible'],
        vendor: ['3', '4'],
        sync: ['no', 'yes'],
      })
    ).toMatchObject({
      filter: 'gpt',
      vendor: '3',
      status: 'disabled',
      square_state: 'hidden',
      sync: 'no',
    })
  })

  it('omits usage-log type=0 and rejects invalid type values without dropping other search state', () => {
    expect(
      usageLogsSearchSchema.parse({ type: '0', page: 9, token: 'sk' })
    ).toMatchObject({
      page: 9,
      type: undefined,
      token: 'sk',
    })

    expect(
      usageLogsSearchSchema.parse({ type: ['8', '2'], page: 9 }).type
    ).toBeUndefined()
    expect(usageLogsSearchSchema.parse({ type: '2', page: 9 }).type).toBe('2')
  })
})
