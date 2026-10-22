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
import { useQuery } from '@tanstack/react-query'
import type { UseFormReturn } from 'react-hook-form'
import { useTranslation } from 'react-i18next'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { getCurrencyLabel } from '@/lib/currency'
import type { DailyQuota } from '@/lib/daily-quota'
import { formatQuota, parseQuotaFromDollars } from '@/lib/format'

import { getGroupQuotaPolicies } from '../api'
import type { UserFormValues } from '../lib/user-form'

type DailyQuotaFieldsProps = {
  form: UseFormReturn<UserFormValues>
  current?: DailyQuota | null
  joining: boolean
  disabled: boolean
}

export function DailyQuotaFields(props: DailyQuotaFieldsProps) {
  const { t } = useTranslation()
  const policies = useQuery({
    queryKey: ['group-quota-policies'],
    queryFn: getGroupQuotaPolicies,
  })
  const groupQuota = policies.data?.data?.find(
    (policy) => policy.group === 'workmate'
  )?.daily_quota
  const override = props.form.watch('daily_quota_override_dollars')
  const inherits = override == null
  const nextQuota = inherits ? groupQuota : parseQuotaFromDollars(override)
  const delta =
    nextQuota === undefined || !props.current
      ? undefined
      : nextQuota - props.current.limit_quota

  return (
    <div className='space-y-4'>
      <div className='space-y-2'>
        <Label htmlFor='daily-reset-source'>{t('Daily reset source')}</Label>
        <Select
          value={inherits ? 'group' : 'user'}
          disabled={props.disabled}
          onValueChange={(value) => {
            if (value !== 'group' && value !== 'user') return
            props.form.setValue(
              'daily_quota_override_dollars',
              value === 'group' ? null : (override ?? 0),
              { shouldDirty: true, shouldValidate: true }
            )
          }}
          items={[
            { value: 'group', label: t('Inherit group amount') },
            { value: 'user', label: t('Personal override') },
          ]}
        >
          <SelectTrigger id='daily-reset-source'>
            <SelectValue />
          </SelectTrigger>
          <SelectContent alignItemWithTrigger={false}>
            <SelectItem value='group'>{t('Inherit group amount')}</SelectItem>
            <SelectItem value='user'>{t('Personal override')}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {!inherits && (
        <FormField
          control={props.form.control}
          name='daily_quota_override_dollars'
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                {t('Personal daily reset amount ({{currency}})', {
                  currency: getCurrencyLabel(),
                })}
              </FormLabel>
              <FormControl>
                <Input
                  {...field}
                  type='number'
                  min={0}
                  step='any'
                  value={Number.isNaN(field.value) ? '' : (field.value ?? '')}
                  disabled={props.disabled}
                  onChange={(event) =>
                    field.onChange(
                      event.target.value === ''
                        ? Number.NaN
                        : Number(event.target.value)
                    )
                  }
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      )}
      {policies.isError && (
        <div role='alert' className='text-sm'>
          <p>{t('Failed to load group daily reset amount')}</p>
          <Button
            type='button'
            variant='outline'
            size='sm'
            onClick={() => {
              void policies.refetch()
            }}
          >
            {t('Retry')}
          </Button>
        </div>
      )}
      <p className='text-muted-foreground text-sm'>
        {t(
          'Zero is a valid override. Inherit uses the group amount. Reset balances do not accumulate and are not a spending cap.'
        )}
      </p>
      {nextQuota !== undefined && Number.isFinite(nextQuota) && (
        <p className='text-sm'>
          {t('Daily reset amount: {{amount}}', {
            amount: formatQuota(nextQuota),
          })}
        </p>
      )}
      {!props.joining && delta !== undefined && Number.isFinite(delta) && (
        <p aria-live='polite' className='text-sm'>
          {t(
            'Immediate balance change: {{delta}}; expected wallet: {{balance}}',
            {
              delta: formatQuota(delta),
              balance: formatQuota((props.current?.balance ?? 0) + delta),
            }
          )}
        </p>
      )}
      <Alert className='rounded-none'>
        <AlertDescription>
          {props.joining
            ? t(
                'First entry into workmate overwrites the existing wallet with the daily reset amount. Rejoining on the same day does not grant it again.'
              )
            : t(
                'Changes take effect immediately by the difference in reset amounts. The wallet may become negative.'
              )}{' '}
          {t(
            'While in workmate, requests use the wallet only. Existing subscriptions are preserved.'
          )}
        </AlertDescription>
      </Alert>
    </div>
  )
}
