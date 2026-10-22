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
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, it, vi } from 'vitest'

import { api } from '@/lib/api'
import { useAuthStore } from '@/stores/auth-store'
import {
  DEFAULT_CURRENCY_CONFIG,
  useSystemConfigStore,
} from '@/stores/system-config-store'

import { GroupDailyQuota } from '../group-daily-quota'

const clients: QueryClient[] = []
afterEach(() => {
  clients.splice(0).forEach((client) => client.clear())
  useAuthStore.getState().auth.reset()
  useSystemConfigStore.setState(useSystemConfigStore.getInitialState(), true)
})

function renderEditor(role = 100) {
  useAuthStore.getState().auth.setUser({ id: 1, username: 'operator', role })
  useSystemConfigStore
    .getState()
    .setConfig({ currency: { ...DEFAULT_CURRENCY_CONFIG } })
  const get = vi.spyOn(api, 'get').mockResolvedValue({
    data: {
      success: true,
      data: [
        {
          group: 'workmate',
          daily_quota: 25000000,
          timezone: 'Asia/Shanghai',
          reset_time: '00:00',
        },
      ],
    },
  })
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  clients.push(client)
  render(
    <QueryClientProvider client={client}>
      <GroupDailyQuota />
    </QueryClientProvider>
  )
  return get
}

it('root can save a zero daily reset amount and sees the immediate inherited-wallet difference', async () => {
  const put = vi
    .spyOn(api, 'put')
    .mockResolvedValue({ data: { success: true } })
  renderEditor()
  const amount = await screen.findByRole('spinbutton', {
    name: 'Daily reset amount (USD)',
  })
  await waitFor(() => expect(amount).toHaveValue(50))
  fireEvent.change(amount, { target: { value: '0' } })
  expect(
    screen.getByText(/Inherited wallets change immediately by -\$50/)
  ).toBeVisible()
  await userEvent.click(
    screen.getByRole('button', { name: 'Save daily reset amount' })
  )
  await waitFor(() =>
    expect(put).toHaveBeenCalledWith('/api/group/quota-policies/workmate', {
      daily_quota: 0,
    })
  )
})

it('administrators can read the daily policy but cannot edit or submit it', async () => {
  renderEditor(10)
  expect(await screen.findByRole('spinbutton')).toBeDisabled()
  expect(
    screen.getByText('Only Root can change the group daily reset amount.')
  ).toBeVisible()
  expect(
    screen.queryByRole('button', { name: 'Save daily reset amount' })
  ).not.toBeInTheDocument()
})

it('load failure provides retry and recovers to the saved policy', async () => {
  useAuthStore.getState().auth.setUser({ id: 1, username: 'root', role: 100 })
  const get = vi
    .spyOn(api, 'get')
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValue({
      data: {
        success: true,
        data: [
          {
            group: 'workmate',
            daily_quota: 25000000,
            timezone: 'Asia/Shanghai',
            reset_time: '00:00',
          },
        ],
      },
    })
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  clients.push(client)
  render(
    <QueryClientProvider client={client}>
      <GroupDailyQuota />
    </QueryClientProvider>
  )
  await userEvent.click(await screen.findByRole('button', { name: 'Retry' }))
  expect(await screen.findByRole('spinbutton')).toBeEnabled()
  expect(get).toHaveBeenCalledTimes(2)
})

it('clearing the group amount rejects submission and focuses the invalid amount instead of saving zero', async () => {
  const put = vi
    .spyOn(api, 'put')
    .mockResolvedValue({ data: { success: true } })
  renderEditor()
  const amount = await screen.findByRole('spinbutton')
  await waitFor(() => expect(amount).toHaveValue(50))
  await userEvent.clear(amount)
  await userEvent.click(
    screen.getByRole('button', { name: 'Save daily reset amount' })
  )
  await waitFor(() => expect(amount).toHaveAttribute('aria-invalid', 'true'))
  await waitFor(() => expect(amount).toHaveFocus())
  expect(put).not.toHaveBeenCalled()
})
