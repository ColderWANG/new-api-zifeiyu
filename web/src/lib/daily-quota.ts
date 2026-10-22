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
import { z } from 'zod'

export const dailyQuotaSchema = z.object({
  group: z.string(),
  limit_quota: z.number(),
  group_quota: z.number(),
  override_quota: z.number().nullable(),
  source: z.enum(['group', 'user']),
  period_id: z.number(),
  business_date: z.string(),
  balance: z.number(),
  spent_quota: z.number(),
  pending_quota: z.number(),
  next_reset_at: z.number(),
  timezone: z.string(),
})

export type DailyQuota = z.infer<typeof dailyQuotaSchema>

export type GroupQuotaPolicy = {
  group: string
  daily_quota: number
  timezone: 'Asia/Shanghai'
  reset_time: '00:00'
}
