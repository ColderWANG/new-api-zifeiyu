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
import { Link } from '@tanstack/react-router'
import { ArrowRight, Flame, ShieldCheck, TrendingDown } from 'lucide-react'
import { useMemo, type CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'

import { StaggerContainer, StaggerItem } from '@/components/page-transition'
import { Button } from '@/components/ui/button'
import { getUserQuotaDates } from '@/features/dashboard/api'
import { useSummaryCardsConfig } from '@/features/dashboard/hooks/use-dashboard-config'
import type { QuotaDataItem } from '@/features/dashboard/types'
import { useStatus } from '@/hooks/use-status'
import { getSelf } from '@/lib/api'
import { getCurrencyLabel, isCurrencyDisplayEnabled } from '@/lib/currency'
import { formatNumber, formatQuota } from '@/lib/format'
import { requireServerSuccess } from '@/lib/server-error-message'
import { computeTimeRange } from '@/lib/time'
import { cn } from '@/lib/utils'
import { useAuthStore, type AuthUser } from '@/stores/auth-store'

import { StatCard } from '../ui/stat-card'
import { DailyWalletCard } from './daily-wallet-card'

const SUMMARY_SPARKLINE_BUCKETS = 12

type SummarySparklineKey = 'balance' | 'usage' | 'requests'

function getBucketIndex(
  timestamp: number,
  start: number,
  end: number,
  bucketCount: number
): number {
  if (end <= start) return 0
  const ratio = (timestamp - start) / (end - start)
  return Math.min(bucketCount - 1, Math.max(0, Math.floor(ratio * bucketCount)))
}

function buildSummarySparklines(
  data: QuotaDataItem[],
  currentBalance: number,
  start: number,
  end: number
): Record<SummarySparklineKey, number[]> {
  const usage = Array.from({ length: SUMMARY_SPARKLINE_BUCKETS }, () => 0)
  const requests = Array.from({ length: SUMMARY_SPARKLINE_BUCKETS }, () => 0)

  for (const item of data) {
    const timestamp = Number(item.created_at) || start
    const index = getBucketIndex(
      timestamp,
      start,
      end,
      SUMMARY_SPARKLINE_BUCKETS
    )
    usage[index] += Number(item.quota) || 0
    requests[index] += Number(item.count) || 0
  }

  let balance = currentBalance
  const balanceTrend = Array.from(
    { length: SUMMARY_SPARKLINE_BUCKETS },
    () => 0
  )

  for (let index = SUMMARY_SPARKLINE_BUCKETS - 1; index >= 0; index--) {
    balanceTrend[index] = Math.max(0, balance)
    balance += usage[index]
  }

  return {
    balance: balanceTrend,
    usage,
    requests,
  }
}

function getSummarySparkline(
  key: string,
  sparklineData: Record<SummarySparklineKey, number[]>
): number[] | undefined {
  if (key === 'usage') return sparklineData.usage
  if (key === 'requests') return sparklineData.requests
  return undefined
}

function getRunwayDays(
  remainQuota: number,
  recentUsage: number
): number | null {
  if (remainQuota <= 0 || recentUsage <= 0) return null
  const days = remainQuota / recentUsage
  if (!Number.isFinite(days)) return null
  return days
}

type HealthLevel = 'healthy' | 'caution' | 'critical'

function getHealthLevel(remainQuota: number, recentUsage: number): HealthLevel {
  if (remainQuota <= 0) return 'critical'
  const days = getRunwayDays(remainQuota, recentUsage)
  if (days !== null && days < 3) return 'caution'
  return 'healthy'
}

const HEALTH_CONFIG: Record<
  HealthLevel,
  { dotClass: string; labelKey: string }
> = {
  healthy: {
    dotClass: 'bg-black',
    labelKey: 'Healthy',
  },
  caution: {
    dotClass: 'bg-black/40',
    labelKey: 'Low balance',
  },
  critical: {
    dotClass: 'border border-black bg-white',
    labelKey: 'Balance depleted',
  },
}

export function SummaryCards() {
  const { t } = useTranslation()
  const user = useAuthStore((state) => state.auth.user)
  const { status, loading } = useStatus()
  const walletQuery = useQuery({
    queryKey: ['daily-wallet-self', user?.id],
    queryFn: async (): Promise<AuthUser> =>
      requireServerSuccess(await getSelf()).data,
    enabled: user?.group === 'workmate',
    refetchInterval: 30_000,
    staleTime: 15_000,
  })
  const dailyQuota = walletQuery.data
    ? walletQuery.data.daily_quota
    : user?.daily_quota

  const summaryTimeRange = useMemo(() => computeTimeRange(1), [])
  const remainQuota = Number(user?.quota ?? 0)
  const usedQuota = Number(user?.used_quota ?? 0)
  const requestCount = Number(user?.request_count ?? 0)

  const usageTrendQuery = useQuery({
    queryKey: [
      'dashboard',
      'overview',
      'summary-sparklines',
      summaryTimeRange.start_timestamp,
      summaryTimeRange.end_timestamp,
    ],
    queryFn: async () =>
      requireServerSuccess(
        await getUserQuotaDates({
          start_timestamp: summaryTimeRange.start_timestamp,
          end_timestamp: summaryTimeRange.end_timestamp,
          default_time: 'hour',
        })
      ),
    staleTime: 60 * 1000,
  })

  const summaryValues = useMemo(() => {
    return {
      usedDisplay: formatQuota(usedQuota),
      requestCountDisplay: formatNumber(requestCount),
    }
  }, [requestCount, usedQuota])

  const currencyEnabledFromStore = isCurrencyDisplayEnabled()
  const statusCurrencyFlag =
    typeof status?.display_in_currency === 'boolean'
      ? Boolean(status.display_in_currency)
      : undefined
  const currencyEnabled =
    statusCurrencyFlag !== undefined
      ? statusCurrencyFlag
      : currencyEnabledFromStore
  const currencyLabel = currencyEnabled ? getCurrencyLabel() : 'Tokens'

  const sparklineData = useMemo(
    () =>
      buildSummarySparklines(
        usageTrendQuery.data?.data ?? [],
        remainQuota,
        summaryTimeRange.start_timestamp,
        summaryTimeRange.end_timestamp
      ),
    [
      remainQuota,
      summaryTimeRange.end_timestamp,
      summaryTimeRange.start_timestamp,
      usageTrendQuery.data?.data,
    ]
  )

  const recentUsage = useMemo(
    () =>
      (usageTrendQuery.data?.data ?? []).reduce(
        (total, item) => total + (Number(item.quota) || 0),
        0
      ),
    [usageTrendQuery.data?.data]
  )

  const healthLevel = getHealthLevel(remainQuota, recentUsage)
  const healthCfg = HEALTH_CONFIG[healthLevel]
  const runwayDays = getRunwayDays(remainQuota, recentUsage)

  const todayUsageDisplay = formatQuota(recentUsage)
  const balanceDisplay = formatQuota(remainQuota)
  let runwayDisplay: string
  if (runwayDays !== null) {
    if (runwayDays < 1) {
      runwayDisplay = t('Less than 1 day left')
    } else if (runwayDays > 999) {
      runwayDisplay = `999+ ${t('days')}`
    } else {
      runwayDisplay = `~${formatNumber(Math.floor(runwayDays))} ${t('days')}`
    }
  } else if (remainQuota <= 0) {
    runwayDisplay = t('Balance depleted')
  } else {
    runwayDisplay = t('No recent usage')
  }

  const items = useSummaryCardsConfig({
    ...summaryValues,
    todayUsageDisplay,
    currencyEnabled,
    currencyLabel,
  }).map((config, index) => {
    const tones = ['accent-1', 'accent-2', 'accent-3'] as const

    return {
      key: config.key,
      title: config.title,
      value: config.value,
      desc: config.description,
      icon: config.icon,
      tone: tones[index] ?? 'accent-3',
      sparkline:
        config.key === 'todayUsage'
          ? sparklineData.usage
          : getSummarySparkline(config.key, sparklineData),
      sparklineVariant: 'line' as const,
    }
  })

  return (
    <section className='border-b border-black/12 bg-white'>
      <div className='grid lg:grid-cols-[minmax(0,1fr)_22rem]'>
        <div className='flex flex-col gap-5 p-5 sm:p-6'>
          <div className='flex flex-wrap items-end justify-between gap-4'>
            <div>
              <div className='mm-label'>{t('Usage at a glance')}</div>
              <h3 className='mm-display mt-3 text-3xl uppercase sm:text-4xl'>
                {t('Usage at a glance')}
              </h3>
              <p aria-hidden className='mt-2 text-sm text-neutral-600'>
                {t('Monitor balance, usage, and request volume')}
              </p>
            </div>
          </div>

          <StaggerContainer className='grid grid-cols-1 sm:grid-cols-3'>
            {items.map((it) => (
              <StaggerItem
                key={it.key}
                className='group bg-white p-5 transition-colors duration-100 hover:bg-neutral-50 sm:not-last:border-r sm:not-last:border-black/10'
              >
                <StatCard
                  title={it.title}
                  value={it.value}
                  description={it.desc}
                  icon={it.icon}
                  tone={it.tone}
                  sparkline={it.sparkline}
                  sparklineVariant={it.sparklineVariant}
                  loading={loading}
                  compactMobile
                />
              </StaggerItem>
            ))}
          </StaggerContainer>
        </div>

        <aside className='@container flex min-w-0 flex-col justify-between gap-5 bg-white p-5 sm:p-6 lg:border-l lg:border-black/10'>
          {dailyQuota ? (
            <DailyWalletCard quota={dailyQuota} />
          ) : (
            <div className='flex flex-col gap-5'>
              <div className='flex items-center justify-between'>
                <span className='mm-label text-neutral-600'>
                  {t('Credit remaining')}
                </span>
                <span className='flex items-center gap-1.5 text-[11px] font-medium text-neutral-600'>
                  <span
                    className={cn('size-1.5 bg-current', healthCfg.dotClass)}
                    aria-hidden='true'
                  />
                  {t(healthCfg.labelKey)}
                </span>
              </div>

              <div
                className='max-w-full font-mono text-[length:clamp(1rem,var(--balance-font-size),2.75rem)] leading-tight font-bold tracking-tight wrap-anywhere text-black tabular-nums'
                // Size against the card, not the viewport. Keep the complete value;
                // exceptionally long currency labels can wrap at the readable minimum.
                style={
                  {
                    '--balance-font-size': `${150 / balanceDisplay.length}cqi`,
                  } as CSSProperties
                }
              >
                {balanceDisplay}
              </div>

              <Button
                variant='outline'
                className='h-10 rounded-none border border-black bg-white px-5 font-mono text-xs tracking-[0.14em] text-black uppercase transition-none hover:bg-black hover:text-white'
                render={<Link to='/wallet' />}
              >
                {t('Wallet')}
                <ArrowRight data-icon='inline-end' />
              </Button>

              <div className='grid gap-0 border border-white/25 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2'>
                <div className='border-black/10 bg-white px-4 py-3'>
                  <div className='flex items-center gap-1.5 text-[11px] font-medium text-neutral-600'>
                    <Flame className='size-3.5 shrink-0' aria-hidden='true' />
                    <span className='truncate'>{t('Last 24h usage')}</span>
                  </div>
                  <div className='mt-2 truncate text-sm font-semibold text-black tabular-nums'>
                    {formatQuota(recentUsage)}
                  </div>
                </div>
                <div className='border-black/10 bg-white px-4 py-3'>
                  <div className='flex items-center gap-1.5 text-[11px] font-medium text-neutral-600'>
                    {runwayDays !== null && runwayDays < 3 ? (
                      <TrendingDown
                        className='size-3.5 shrink-0'
                        aria-hidden='true'
                      />
                    ) : (
                      <ShieldCheck
                        className='size-3.5 shrink-0'
                        aria-hidden='true'
                      />
                    )}
                    <span className='truncate'>{t('Runway')}</span>
                  </div>
                  <div
                    className={cn(
                      'mt-2 truncate text-sm font-semibold text-black tabular-nums',
                      healthLevel === 'critical' && 'text-black',
                      healthLevel === 'caution' && 'text-black'
                    )}
                  >
                    {runwayDisplay}
                  </div>
                </div>
              </div>
            </div>
          )}
        </aside>
      </div>
    </section>
  )
}
