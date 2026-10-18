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
import { Crown } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { formatQuota } from '@/lib/format'

export function WeeklyRewards(props: {
  prizes: number[]
  total: number
  legacy: boolean
  enabled?: boolean
  unavailable: boolean
  retry: () => void
}) {
  const { t } = useTranslation()
  const ranks = ['First place', 'Second place', 'Third place'] as const
  return (
    <section className='border p-5' aria-label={t('Weekly podium rewards')}>
      <h2 className='flex items-center gap-2 text-sm font-semibold'>
        <Crown className='size-4' />
        {t('Weekly podium rewards')}
      </h2>
      <div className='mt-4 grid grid-cols-3 divide-x border-y'>
        {ranks.map((rank, index) => (
          <div key={rank} className='min-w-0 px-2 py-4 text-center'>
            <p className='text-muted-foreground text-xs'>{t(rank)}</p>
            <p className='mt-2 font-mono text-lg font-medium [overflow-wrap:anywhere]'>
              {formatQuota(props.prizes[index] ?? 0)}
            </p>
          </div>
        ))}
      </div>
      <div className='mt-3 flex items-center justify-between gap-3 text-xs'>
        <span className='text-muted-foreground'>
          {t('Weekly prize pool')}
        </span>
        <strong className='font-mono'>{formatQuota(props.total)}</strong>
      </div>
      <p className='text-muted-foreground mt-3 text-xs leading-relaxed'>
        {t(
          'Weekly prizes settle after Monday 00:05 (UTC+8). Amounts update automatically when the administrator saves changes.'
        )}
      </p>
      {props.enabled === false && (
        <p className='text-muted-foreground mt-2 text-xs'>
          {t('Weekly rewards are not enabled for this week.')}
        </p>
      )}
      {props.legacy && (
        <p className='text-muted-foreground mt-2 text-xs'>
          {t(
            'This week still uses the previous percentage rules, including rewards for ranks 4–10.'
          )}
        </p>
      )}
      {props.unavailable && (
        <div role='status' className='mt-3 text-xs'>
          <p>
            {t(
              'Reward updates are temporarily unavailable. Showing the last loaded amounts.'
            )}
          </p>
          <Button variant='link' size='sm' onClick={props.retry}>
            {t('Retry')}
          </Button>
        </div>
      )}
    </section>
  )
}
