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
import { zodResolver } from '@hookform/resolvers/zod'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useForm } from 'react-hook-form'
import { afterEach, expect, it, vi } from 'vitest'

import { Button } from '@/components/ui/button'
import { Form } from '@/components/ui/form'
import { api } from '@/lib/api'
import type { DailyQuota } from '@/lib/daily-quota'
import { useAuthStore } from '@/stores/auth-store'
import {
  DEFAULT_CURRENCY_CONFIG,
  useSystemConfigStore,
} from '@/stores/system-config-store'

import {
  transformFormDataToPayload,
  transformUserToFormDefaults,
  USER_FORM_DEFAULT_VALUES,
  userFormSchema,
  type UserFormValues,
} from '../../lib/user-form'
import type { User } from '../../types'
import { DailyQuotaFields } from '../daily-quota-fields'
import { UserQuotaCell } from '../user-quota-cell'
import { UsersMutateDrawer } from '../users-mutate-drawer'
import { UsersProvider } from '../users-provider'

const quota: DailyQuota = {
  group: 'workmate',
  limit_quota: 25_000_000,
  group_quota: 25_000_000,
  override_quota: null,
  source: 'group',
  period_id: 1,
  business_date: '2026-10-20',
  balance: 5_000_000,
  spent_quota: 20_000_000,
  pending_quota: 0,
  next_reset_at: 1792512000,
  timezone: 'Asia/Shanghai',
}
const clients: QueryClient[] = []

afterEach(() => {
  clients.splice(0).forEach((client) => client.clear())
  useAuthStore.getState().auth.reset()
  useSystemConfigStore.setState(useSystemConfigStore.getInitialState(), true)
})

function Fixture(props: {
  onSave: (payload: ReturnType<typeof transformFormDataToPayload>) => void
  joining?: boolean
}) {
  const form = useForm<UserFormValues>({
    resolver: zodResolver(userFormSchema),
    defaultValues: {
      ...USER_FORM_DEFAULT_VALUES,
      username: 'colleague',
      group: 'workmate',
    },
  })
  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit((values) =>
          props.onSave(transformFormDataToPayload(values, 2))
        )}
      >
        <DailyQuotaFields
          form={form}
          current={quota}
          joining={props.joining ?? false}
          disabled={false}
        />
        <Button type='submit'>Save</Button>
      </form>
    </Form>
  )
}

function renderFields(onSave = vi.fn(), joining = false) {
  useSystemConfigStore
    .getState()
    .setConfig({ currency: { ...DEFAULT_CURRENCY_CONFIG } })
  vi.spyOn(api, 'get').mockResolvedValue({
    data: {
      success: true,
      data: [
        {
          group: 'workmate',
          daily_quota: 25_000_000,
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
      <Fixture onSave={onSave} joining={joining} />
    </QueryClientProvider>
  )
  return onSave
}

it('switching to a personal zero override previews a negative wallet and submits zero', async () => {
  const onSave = renderFields()
  await screen.findByText('Daily reset amount: $50')
  await userEvent.click(
    screen.getByRole('combobox', { name: 'Daily reset source' })
  )
  await userEvent.click(
    screen.getByRole('option', { name: 'Personal override' })
  )
  const amount = screen.getByRole('spinbutton', {
    name: 'Personal daily reset amount (USD)',
  })
  expect(amount).toHaveValue(0)
  expect(
    screen.getByText('Immediate balance change: -$50; expected wallet: -$40')
  ).toBeVisible()
  await userEvent.click(screen.getByRole('button', { name: 'Save' }))
  await waitFor(() =>
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ daily_quota_override: 0 })
    )
  )
  await userEvent.click(
    screen.getByRole('combobox', { name: 'Daily reset source' })
  )
  await userEvent.click(
    screen.getByRole('option', { name: 'Inherit group amount' })
  )
  expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Save' }))
  await waitFor(() =>
    expect(onSave).toHaveBeenLastCalledWith(
      expect.objectContaining({ daily_quota_override: null })
    )
  )
})

it('joining workmate shows the overwrite and same-day rejoin rule', async () => {
  renderFields(vi.fn(), true)
  expect(screen.getByRole('alert')).toHaveTextContent(
    'First entry into workmate overwrites the existing wallet'
  )
  expect(screen.getByRole('alert')).toHaveTextContent(
    'Rejoining on the same day does not grant it again.'
  )
  expect(screen.queryByText(/Immediate balance change/)).not.toBeInTheDocument()
})

it('negative and empty personal amounts reject form submission and expose invalid state', async () => {
  const onSave = renderFields()
  await userEvent.click(
    screen.getByRole('combobox', { name: 'Daily reset source' })
  )
  await userEvent.click(
    screen.getByRole('option', { name: 'Personal override' })
  )
  const amount = screen.getByRole('spinbutton', {
    name: 'Personal daily reset amount (USD)',
  })
  await userEvent.clear(amount)
  await userEvent.click(screen.getByRole('button', { name: 'Save' }))
  await waitFor(() => expect(amount).toHaveAttribute('aria-invalid', 'true'))
  expect(onSave).not.toHaveBeenCalled()
})

it('form transformations preserve nullable inheritance, explicit zero, omitted overrides and negative wallet displays', () => {
  const user = {
    id: 2,
    username: 'colleague',
    display_name: '',
    role: 1,
    status: 1,
    quota: -500000,
    used_quota: 0,
    request_count: 0,
    group: 'workmate',
    daily_quota: { ...quota, override_quota: 0, source: 'user' },
  } as User
  const defaults = transformUserToFormDefaults(user)
  expect(defaults.daily_quota_override_dollars).toBe(0)
  expect(userFormSchema.safeParse(defaults).success).toBe(true)
  expect(
    transformFormDataToPayload(
      { ...defaults, daily_quota_override_dollars: undefined },
      2
    )
  ).not.toHaveProperty('daily_quota_override')
  expect(
    transformFormDataToPayload({ ...defaults, group: 'default' }, 2)
  ).not.toHaveProperty('daily_quota_override')
  expect(
    transformFormDataToPayload(
      { ...defaults, daily_quota_override_dollars: null },
      2
    )
  ).toHaveProperty('daily_quota_override', null)
  expect(
    userFormSchema.safeParse({ ...defaults, daily_quota_override_dollars: -1 })
      .success
  ).toBe(false)
})

it('daily wallet table details expose source, pending charges and reset schedule with keyboard access', async () => {
  useSystemConfigStore
    .getState()
    .setConfig({ currency: { ...DEFAULT_CURRENCY_CONFIG } })
  render(
    <UserQuotaCell
      remaining={-500000}
      used={1000000}
      dailyQuota={{
        ...quota,
        source: 'user',
        override_quota: 0,
        limit_quota: 0,
      }}
    />
  )
  expect(screen.getByText('Personal override')).toBeVisible()
  await userEvent.tab()
  await userEvent.keyboard('{Enter}')
  const dialog = await screen.findByRole('dialog')
  expect(dialog).toHaveTextContent('Daily reset source')
  expect(dialog).toHaveTextContent('Pending charges')
  expect(dialog).toHaveTextContent('00:00 Asia/Shanghai')
  await userEvent.keyboard('{Escape}')
  await waitFor(() =>
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  )
  expect(screen.getByRole('button')).toHaveFocus()
})

it('saving an unrelated workmate user edit leaves the personal override absent from the request', async () => {
  useAuthStore.getState().auth.setUser({ id: 1, username: 'root', role: 100 })
  useSystemConfigStore
    .getState()
    .setConfig({ currency: { ...DEFAULT_CURRENCY_CONFIG } })
  const target: User = {
    id: 2,
    username: 'colleague',
    display_name: 'Colleague',
    role: 1,
    status: 1,
    quota: 5_000_000,
    used_quota: 20_000_000,
    request_count: 0,
    group: 'workmate',
    daily_quota: quota,
  }
  vi.spyOn(api, 'get').mockImplementation(async (url) => {
    if (url === '/api/group/') {
      return { data: { success: true, data: ['workmate'] } }
    }
    if (url === '/api/group/quota-policies') {
      return {
        data: {
          success: true,
          data: [
            {
              group: 'workmate',
              daily_quota: 25_000_000,
              timezone: 'Asia/Shanghai',
              reset_time: '00:00',
            },
          ],
        },
      }
    }
    if (url === '/api/authz/catalog') {
      return { data: { success: true, data: { resources: [], roles: [] } } }
    }
    return { data: { success: true, data: target } }
  })
  const put = vi
    .spyOn(api, 'put')
    .mockResolvedValue({ data: { success: true } })
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  clients.push(client)
  render(
    <QueryClientProvider client={client}>
      <UsersProvider>
        <UsersMutateDrawer open onOpenChange={() => {}} currentRow={target} />
      </UsersProvider>
    </QueryClientProvider>
  )
  const name = await screen.findByRole('textbox', { name: 'Display Name' })
  await waitFor(() => expect(name).toHaveValue('Colleague'))
  await userEvent.clear(name)
  await userEvent.type(name, 'Updated colleague')
  await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))
  await waitFor(() => expect(put).toHaveBeenCalled())
  expect(put.mock.calls[0][1]).toMatchObject({
    id: 2,
    display_name: 'Updated colleague',
  })
  expect(put.mock.calls[0][1]).not.toHaveProperty('daily_quota_override')
})
