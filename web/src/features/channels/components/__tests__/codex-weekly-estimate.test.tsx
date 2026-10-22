/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU Affero
General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'

import { CodexUsageDialog } from '../dialogs/codex-usage-dialog'

const usageData = {
  plan_type: 'plus',
  rate_limit: {
    allowed: true,
    secondary_window: {
      used_percent: 16,
      limit_window_seconds: 604800,
      reset_at: 1800259200,
    },
  },
}

it('shows the estimated weekly amount in USD with its observed basis', async () => {
  render(
    <CodexUsageDialog
      open
      onOpenChange={vi.fn()}
      response={{
        success: true,
        data: usageData,
        weekly_usd_estimate: {
          status: 'available',
          estimated_limit_usd: 100,
          estimated_remaining_usd: 84,
          observed_spend_usd: 4,
          observed_percent_points: 4,
          current_window_spend_usd: 6,
          sample_count: 2,
        },
      }}
    />
  )

  expect(await screen.findByText('$100.00')).toBeInTheDocument()
  expect(screen.getByText('$84.00')).toBeInTheDocument()
  expect(screen.getByText(/Channel billed this week/)).toBeInTheDocument()
  expect(screen.getByText('$6.00')).toBeInTheDocument()
  expect(
    screen.getByText(/Observed channel spend.*\$4\.00/)
  ).toBeInTheDocument()
  expect(screen.getByText(/not an official dollar limit/)).toBeInTheDocument()
})

it('explains that another sample is needed before showing an amount', async () => {
  render(
    <CodexUsageDialog
      open
      onOpenChange={vi.fn()}
      response={{
        success: true,
        data: usageData,
        weekly_usd_estimate: {
          status: 'insufficient_samples',
          estimated_limit_usd: null,
          estimated_remaining_usd: null,
          observed_spend_usd: null,
          observed_percent_points: null,
          current_window_spend_usd: 0,
          sample_count: 1,
        },
      }}
    />
  )

  expect(
    await screen.findByText(/collect a second weekly sample/)
  ).toBeInTheDocument()
  expect(screen.queryByText('$100.00')).not.toBeInTheDocument()
})
