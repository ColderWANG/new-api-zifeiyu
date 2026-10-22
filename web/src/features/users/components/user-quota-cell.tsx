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
import { useTranslation } from 'react-i18next'

import { QuotaDetailsPopover } from '@/components/quota-details-popover'
import { StatusBadge } from '@/components/status-badge'
import { formatQuotaWithCurrency, getCurrencyDisplay } from '@/lib/currency'
import type { DailyQuota } from '@/lib/daily-quota'
import { cn } from '@/lib/utils'
import { useSystemConfigStore } from '@/stores/system-config-store'

type UserQuotaCellProps = {
  remaining: number
  used: number
  dailyQuota?: DailyQuota | null
}

export function UserQuotaCell(props: UserQuotaCellProps) {
  const { t } = useTranslation()
  useSystemConfigStore((state) => state.config.currency)

  const { meta: currency } = getCurrencyDisplay()
  const quotaUnit = currency.kind === 'tokens' ? t('Tokens') : currency.symbol
  const hasQuota =
    props.remaining !== 0 || props.used !== 0 || !!props.dailyQuota
  const formattedRemaining = formatQuotaWithCurrency(props.remaining, {
    showSymbol: false,
  })
  const formattedUsed = formatQuotaWithCurrency(props.used, {
    showSymbol: false,
  })

  let triggerLabel = t('No Quota')
  if (hasQuota) {
    triggerLabel = `${t('Available Balance')} ${formattedRemaining}; ${t('Used amount')} ${formattedUsed}`
  }
  if (props.dailyQuota) {
    const source =
      props.dailyQuota.source === 'user'
        ? t('Personal override')
        : t('Inherit group amount')
    triggerLabel = `${t('Available Balance')} ${formattedRemaining}; ${t('Daily reset amount')} ${formatQuotaWithCurrency(props.dailyQuota.limit_quota, { showSymbol: false })}; ${source}`
  }

  return (
    <QuotaDetailsPopover
      title={`${t('Quota')} (${quotaUnit})`}
      triggerLabel={triggerLabel}
      details={[
        { label: t('Available Balance'), value: formattedRemaining },
        { label: t('Total Used'), value: formattedUsed },
        ...(props.dailyQuota
          ? [
              {
                label: t('Daily reset source'),
                value:
                  props.dailyQuota.source === 'user'
                    ? t('Personal override')
                    : t('Inherit group amount'),
              },
              {
                label: t('Daily reset amount'),
                value: formatQuotaWithCurrency(props.dailyQuota.limit_quota),
              },
              {
                label: t('Spent today'),
                value: formatQuotaWithCurrency(props.dailyQuota.spent_quota),
              },
              {
                label: t('Pending charges'),
                value: formatQuotaWithCurrency(props.dailyQuota.pending_quota),
              },
              { label: t('Reset schedule'), value: '00:00 Asia/Shanghai' },
            ]
          : []),
      ]}
      description={
        props.dailyQuota
          ? t(
              'Reset balances do not accumulate. Requests use the wallet only; subscriptions are preserved.'
            )
          : undefined
      }
    >
      {hasQuota ? (
        <span className='grid min-w-0 grid-cols-1 gap-y-1 text-sm tabular-nums'>
          <span
            className={cn(
              props.remaining < 0 && 'text-destructive',
              props.remaining === 0 && 'text-muted-foreground'
            )}
          >
            {formattedRemaining}
          </span>
          <span
            data-table-text='secondary'
            className='text-muted-foreground flex items-baseline gap-1 text-xs font-normal'
          >
            <span>
              {props.dailyQuota ? t('Daily reset amount') : t('Used amount')}
            </span>
            <span>
              {props.dailyQuota
                ? formatQuotaWithCurrency(props.dailyQuota.limit_quota, {
                    showSymbol: false,
                  })
                : formattedUsed}
            </span>
          </span>
          {props.dailyQuota && (
            <span className='text-muted-foreground text-xs'>
              {props.dailyQuota.source === 'user'
                ? t('Personal override')
                : t('Inherit group amount')}
            </span>
          )}
        </span>
      ) : (
        <StatusBadge
          label={t('No Quota')}
          variant='neutral'
          copyable={false}
          className='-ml-1.5 font-normal'
        />
      )}
    </QuotaDetailsPopover>
  )
}
