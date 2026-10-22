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
import { Fragment } from 'react'
import { useTranslation } from 'react-i18next'

import { toIntlLocale } from '@/i18n/languages'
import type { DailyQuota } from '@/lib/daily-quota'
import { formatQuota } from '@/lib/format'
import { useSystemConfigStore } from '@/stores/system-config-store'

export function DailyWalletCard(props: { quota: DailyQuota }) {
  const { t, i18n } = useTranslation()
  useSystemConfigStore((state) => state.config.currency)
  const locale = toIntlLocale(i18n.resolvedLanguage || i18n.language)
  const resetDate = new Date(props.quota.next_reset_at * 1000)
  const nextReset = new Intl.DateTimeFormat(locale, {
    timeZone: 'Asia/Shanghai',
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(resetDate)
  const details = [
    {
      label: t('Daily reset amount'),
      value: formatQuota(props.quota.limit_quota),
    },
    { label: t('Spent today'), value: formatQuota(props.quota.spent_quota) },
    {
      label: t('Pending charges'),
      value: formatQuota(props.quota.pending_quota),
    },
  ]

  return (
    <section
      aria-label={t('Workmate daily wallet')}
      className='min-w-0 space-y-5'
    >
      <h3 className='mm-label'>{t('Workmate daily wallet')}</h3>
      <div>
        <p className='text-muted-foreground text-xs'>
          {t('Available Balance')}
        </p>
        <p className='mt-2 font-mono text-3xl font-bold wrap-anywhere tabular-nums'>
          {formatQuota(props.quota.balance)}
        </p>
      </div>
      <dl className='grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-x-3 gap-y-3 text-sm'>
        {details.map((detail) => (
          <Fragment key={detail.label}>
            <dt className='text-muted-foreground'>{detail.label}</dt>
            <dd className='text-right font-mono wrap-anywhere tabular-nums'>
              {detail.value}
            </dd>
          </Fragment>
        ))}
        <dt className='text-muted-foreground'>{t('Daily reset source')}</dt>
        <dd className='text-right wrap-anywhere'>
          {props.quota.source === 'user'
            ? t('Personal override')
            : t('Inherit group amount')}
        </dd>
      </dl>
      <div className='border-t border-black/10 pt-4 text-sm'>
        <p className='font-medium'>{t('Next reset')}</p>
        <time
          dateTime={resetDate.toISOString()}
          className='mt-1 block wrap-anywhere'
        >
          {nextReset} (Asia/Shanghai)
        </time>
        <p className='text-muted-foreground mt-3 text-xs leading-relaxed'>
          {t(
            'Resets at 00:00 Asia/Shanghai every day. Unused balance does not accumulate. This is not a daily spending cap.'
          )}
        </p>
        <p className='text-muted-foreground mt-2 text-xs leading-relaxed'>
          {t(
            'While in workmate, requests use the wallet only. Existing subscriptions are preserved.'
          )}
        </p>
      </div>
    </section>
  )
}
