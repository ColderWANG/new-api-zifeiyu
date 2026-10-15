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
import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { SidebarProvider } from '@/components/ui/sidebar'
import { STATUS_QUERY_KEY } from '@/lib/status-query'

import { SystemBrand } from '../system-brand'

let client: QueryClient

afterEach(() => client?.clear())

describe('console system brand', () => {
  it.each(['v0.0.0', 'v1.2.3', undefined])(
    'shows the brand without version or fallback text when version is %s',
    (version) => {
      client = new QueryClient({
        defaultOptions: { queries: { retry: false, gcTime: 0 } },
      })
      client.setQueryData(STATUS_QUERY_KEY, {
        system_name: 'Console Brand',
        version,
      })

      render(
        <QueryClientProvider client={client}>
          <SidebarProvider>
            <SystemBrand variant='sidebar' />
          </SidebarProvider>
        </QueryClientProvider>
      )

      expect(screen.getByText('Console Brand')).toBeVisible()
      expect(screen.getByRole('img', { name: 'Logo' })).toBeInTheDocument()
      expect(
        screen.queryByText(version ?? 'Unknown version')
      ).not.toBeInTheDocument()
    }
  )
})
