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
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

import { api } from '@/lib/api'
import { STATUS_QUERY_KEY } from '@/lib/status-query'
import { useAuthStore } from '@/stores/auth-store'
import {
  DEFAULT_CURRENCY_CONFIG,
  useSystemConfigStore,
} from '@/stores/system-config-store'

import { DailyWalletCard } from '../daily-wallet-card'
import { SummaryCards } from '../summary-cards'

let client: QueryClient

beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  client.setQueryData(STATUS_QUERY_KEY, { display_in_currency: true })
  useSystemConfigStore
    .getState()
    .setConfig({ currency: { ...DEFAULT_CURRENCY_CONFIG, quotaPerUnit: 1 } })
  vi.spyOn(api, 'get').mockResolvedValue({ data: { success: true, data: [] } })
})

afterEach(() => {
  client.clear()
  useAuthStore.setState(useAuthStore.getInitialState(), true)
  useSystemConfigStore.setState(useSystemConfigStore.getInitialState(), true)
  localStorage.clear()
})

it.each([
  [1000009711646.25, '$1,000,009,711,646.25'],
  [200, '$200'],
  [-1000009711646.25, '-$1,000,009,711,646.25'],
])(
  'keeps the full balance %s within a responsive, wrappable container',
  async (quota, text) => {
    useAuthStore.getState().auth.setUser({
      id: 1,
      username: 'balance-user',
      role: 1,
      quota,
      used_quota: 0,
      request_count: 0,
    })
    const router = createRouter({
      routeTree: createRootRoute({ component: SummaryCards }),
      history: createMemoryHistory({ initialEntries: ['/'] }),
    })
    await router.load()
    render(
      <QueryClientProvider client={client}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    )
    const amount = await screen.findByText(text)
    expect(amount).toHaveClass('wrap-anywhere', 'max-w-full')
    expect(amount).not.toHaveClass('truncate', 'whitespace-nowrap')
    expect(amount).toHaveClass(
      'text-[length:clamp(1rem,var(--balance-font-size),2.75rem)]'
    )
    expect(amount.style.getPropertyValue('--balance-font-size')).toMatch(
      /^\d+(\.\d+)?cqi$/
    )
    expect(screen.getByRole('complementary')).toHaveClass(
      '@container',
      'min-w-0'
    )
    expect(screen.getByRole('button', { name: 'Wallet' })).toHaveAttribute(
      'href',
      '/wallet'
    )
  }
)

it('daily wallet card keeps negative balances, pending costs and the Shanghai reset visible on narrow layouts', () => {
  render(
    <DailyWalletCard
      quota={{
        group: 'workmate',
        limit_quota: 50,
        group_quota: 50,
        override_quota: null,
        source: 'group',
        period_id: 1,
        business_date: '2026-10-20',
        balance: -10,
        spent_quota: 60,
        pending_quota: 5,
        next_reset_at: 1792512000,
        timezone: 'Asia/Shanghai',
      }}
    />
  )
  expect(
    screen.getByRole('region', { name: 'Workmate daily wallet' })
  ).toHaveClass('min-w-0')
  const balance = screen.getByText('-$10')
  expect(balance).toHaveClass('wrap-anywhere')
  expect(balance).not.toHaveClass('truncate')
  expect(screen.getByText('Daily reset amount')).toBeVisible()
  expect(screen.getByText('Spent today')).toBeVisible()
  expect(screen.getByText('Pending charges')).toBeVisible()
  expect(screen.getByText('$5')).toBeVisible()
  expect(screen.getByText(/Asia\/Shanghai\)$/)).toHaveAttribute(
    'datetime',
    new Date(1792512000 * 1000).toISOString()
  )
  expect(screen.getByText(/Asia\/Shanghai\)$/)).toHaveTextContent(
    'Oct 21, 2026, 12:00 AM'
  )
})
