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
import { getCoreRowModel, useReactTable } from '@tanstack/react-table'
import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'

import { channelSchema } from '../../types'
import { ChannelCard } from '../channel-card'
import { useChannelsColumns } from '../channels-columns'
import { ChannelsProvider } from '../channels-provider'

function StatusCard({ status }: { status: number }) {
  const columns = useChannelsColumns({ enableSelection: false }).filter(
    (column) => 'accessorKey' in column && column.accessorKey === 'status'
  )
  const table = useReactTable({
    data: [
      channelSchema.parse({
        id: 1,
        type: 1,
        name: 'Preview channel',
        key: '',
        status,
        created_time: 1,
        test_time: 0,
        response_time: 0,
        balance_updated_time: 0,
      }),
    ],
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  return <ChannelCard row={table.getRowModel().rows[0]} isSelected={false} />
}

test.each([
  [1, 'Enabled'],
  [2, 'Disabled'],
  [3, 'Auto Disabled'],
] as const)(
  'shows the current status %s on a channel card as %s',
  (status, label) => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    const view = render(
      <QueryClientProvider client={client}>
        <ChannelsProvider>
          <StatusCard status={status} />
        </ChannelsProvider>
      </QueryClientProvider>
    )

    expect(screen.getByText(label, { exact: true })).toBeVisible()

    view.unmount()
    client.clear()
  }
)
