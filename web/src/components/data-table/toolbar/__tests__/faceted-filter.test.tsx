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

For commercial licensing, please contact support@quantumnous.com.
*/
import {
  getCoreRowModel,
  getFilteredRowModel,
  useReactTable,
  type ColumnFiltersState,
} from '@tanstack/react-table'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { expect, it } from 'vitest'

import { DataTableToolbar } from '../toolbar'

const rows = [
  { name: 'Alpha', status: 1 },
  { name: 'Beta', status: 2 },
]

const options = [
  { value: '1', label: 'Enabled' },
  { value: '2', label: 'Disabled' },
]

function Fixture() {
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const table = useReactTable({
    data: rows,
    columns: [{ accessorKey: 'name' }, { accessorKey: 'status' }],
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    state: { columnFilters },
    onColumnFiltersChange: setColumnFilters,
  })

  return (
    <DataTableToolbar
      table={table}
      filters={[
        {
          columnId: 'status',
          title: 'Status',
          options,
        },
      ]}
    />
  )
}

it('reflects API-key-style numeric status selections immediately', async () => {
  const user = userEvent.setup()
  render(<Fixture />)

  await user.click(screen.getByRole('button', { name: /^Status/ }))
  await user.click(screen.getByRole('option', { name: /Enabled/ }))

  expect(screen.getByRole('button', { name: /^Status Enabled/ })).toBeVisible()
  expect(screen.getByRole('option', { name: /Enabled/ })).toHaveAttribute(
    'data-filter-selected',
    'true'
  )

  await user.click(screen.getByRole('option', { name: /Disabled/ }))
  expect(
    screen.getByRole('button', { name: /^Status Enabled \/ Disabled/ })
  ).toBeVisible()
  expect(screen.getByRole('option', { name: /Disabled/ })).toHaveAttribute(
    'data-filter-selected',
    'true'
  )

  // Selection order follows the actual filter array, so Disabled is visible too.
  await user.click(screen.getByRole('option', { name: /Enabled/ }))
  expect(screen.getByRole('button', { name: /^Status Disabled/ })).toBeVisible()
})
