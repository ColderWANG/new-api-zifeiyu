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
import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { useTableUrlState } from '../use-table-url-state'

function columnFilterSignature(filters: Array<{ id: string; value: unknown }>) {
  return JSON.stringify(
    [...filters]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((f) => [f.id, f.value])
  )
}

describe('useTableUrlState', () => {
  it('does not roll back an optimistic column filter while navigation is pending', () => {
    let search: Record<string, unknown> = {}
    const navigate = vi.fn(({ search: nextSearch }) => {
      if (typeof nextSearch === 'function') {
        search = nextSearch(search) as Record<string, unknown>
      }
    })
    const { result, rerender } = renderHook(() =>
      useTableUrlState({
        search,
        navigate: navigate as never,
        columnFilters: [
          { columnId: 'status', searchKey: 'status', type: 'array' },
        ],
      })
    )

    act(() => {
      result.current.onColumnFiltersChange([
        { id: 'status', value: ['enabled'] },
      ])
    })

    const optimistic = result.current.columnFilters
    // The router can still return the previous search object on the next
    // render before committing the new URL.
    rerender({ search: { other: Date.now() } })

    expect(columnFilterSignature(result.current.columnFilters)).toBe(
      columnFilterSignature(optimistic)
    )
    expect(navigate).toHaveBeenCalledTimes(1)
    expect(search.status).toEqual(['enabled'])
  })
})
