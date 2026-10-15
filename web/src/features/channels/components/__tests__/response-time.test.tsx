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

For commercial licensing, please contact support@quantumnous.com
*/
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { render, screen } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'

import { getResponseTimeConfig } from '../../lib/channel-utils'
import { channelSchema } from '../../types'
import { useChannelsColumns } from '../channels-columns'
import { ChannelsProvider } from '../channels-provider'

let client: QueryClient
afterEach(() => client?.clear())

function ResponseCell(props: { time: number }) {
  const table = useReactTable({
    data: [
      channelSchema.parse({
        id: 1,
        type: 1,
        key: '',
        name: 'Latency test',
        status: 1,
        created_time: 1,
        test_time: 1,
        response_time: props.time,
        balance_updated_time: 0,
      }),
    ],
    columns: useChannelsColumns({ enableSelection: false }),
    getCoreRowModel: getCoreRowModel(),
  })
  const cell = table
    .getRowModel()
    .rows[0].getAllCells()
    .find((item) => item.column.id === 'response_time')
  return cell ? flexRender(cell.column.columnDef.cell, cell.getContext()) : null
}

it.each([
  [1, '1ms', 'success', 'text-green-800', 'bg-green-50'],
  [5000, '5.00s', 'success', 'text-green-800', 'bg-green-50'],
  [5001, '5.00s', 'warning', 'text-yellow-800', 'bg-yellow-50'],
  [10000, '10.00s', 'warning', 'text-yellow-800', 'bg-yellow-50'],
  [10001, '10.00s', 'danger', 'text-red-800', 'bg-red-50'],
  [60000, '60.00s', 'danger', 'text-red-800', 'bg-red-50'],
] as const)(
  'renders %ims with its response-time color',
  (time, label, variant, color, background) => {
    client = new QueryClient()
    render(
      <QueryClientProvider client={client}>
        <ChannelsProvider>
          <ResponseCell time={time} />
        </ChannelsProvider>
      </QueryClientProvider>
    )
    expect(getResponseTimeConfig(time).variant).toBe(variant)
    expect(screen.getByTitle(label)).toHaveClass(color, background)
    expect(screen.getByText(label)).toBeVisible()
  }
)

it('keeps zero as Not tested rather than a successful response', () => {
  client = new QueryClient()
  render(
    <QueryClientProvider client={client}>
      <ChannelsProvider>
        <ResponseCell time={0} />
      </ChannelsProvider>
    </QueryClientProvider>
  )
  expect(getResponseTimeConfig(0).variant).toBe('neutral')
  expect(screen.getByTitle('Not tested')).toHaveClass('text-muted-foreground')
})
