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
import { z } from 'zod'

import {
  normalizeSingleSearchValue,
  toSingleSearchValue,
  urlArray,
  urlSingle,
} from '../url-array-schema'

describe('url search field schemas', () => {
  it('accepts scalar and repeated values for arrays', () => {
    const schema = urlArray(z.enum(['1', '2']))

    expect(schema.parse('1')).toEqual(['1'])
    expect(schema.parse(['2', '1'])).toEqual(['2', '1'])
    expect(schema.parse(undefined)).toBeUndefined()
  })

  it('catches an invalid field without making the whole search object invalid', () => {
    const schema = z.object({
      page: z.number().catch(1),
      filter: z.string().catch(''),
      status: urlArray(z.enum(['1', '2'])),
    })

    expect(schema.parse({ page: 3, filter: 'root', status: 'bad' })).toEqual({
      page: 3,
      filter: 'root',
      status: [],
    })
  })

  it('normalizes legacy repeated single-select values to the first value', () => {
    expect(normalizeSingleSearchValue(['2', '1'])).toBe('2')
    expect(normalizeSingleSearchValue('1')).toBe('1')
    expect(normalizeSingleSearchValue('')).toBeUndefined()
    expect(toSingleSearchValue(['2', '1'])).toBe('2')
    expect(toSingleSearchValue([])).toBeUndefined()
  })

  it('keeps unrelated fields when a single-select value is invalid', () => {
    const schema = z.object({
      token: z.string().catch(''),
      status: urlSingle(z.enum(['1', '2'])),
    })

    expect(schema.parse({ token: 'abc', status: ['3', '1'] })).toEqual({
      token: 'abc',
      status: undefined,
    })
  })
})
