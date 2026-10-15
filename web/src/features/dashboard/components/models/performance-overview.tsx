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
import { Gauge, HeartPulse, Timer } from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { Skeleton } from '@/components/ui/skeleton'
import { getPerfMetricsSummary } from '@/features/performance-metrics/api'
import {
  formatLatency,
  formatThroughput,
  formatUptimePct,
  getSuccessRateTextClass,
} from '@/features/performance-metrics/lib/format'
import type { PerfModelSummary } from '@/features/performance-metrics/types'
import { requireServerSuccess } from '@/lib/server-error-message'
import { cn } from '@/lib/utils'

const PERFORMANCE_WINDOW_HOURS = 24
const TOP_MODEL_LIMIT = 6

export function PerformanceOverview() {
  const { t } = useTranslation()
  const metricsQuery = useQuery({
    queryKey: ['perf-metrics-summary', PERFORMANCE_WINDOW_HOURS],
    queryFn: async () =>
      requireServerSuccess(
        await getPerfMetricsSummary(PERFORMANCE_WINDOW_HOURS)
      ),
    staleTime: 60 * 1000,
    retry: false,
  })

  const models = useMemo(
    () => metricsQuery.data?.data.models ?? [],
    [metricsQuery.data]
  )
  const summary = metricsQuery.data?.data.summary
  const topModels = useMemo(() => models.slice(0, TOP_MODEL_LIMIT), [models])
  const loading = metricsQuery.isLoading
  const hasData = models.length > 0

  if (!loading && !hasData) {
    return (
      <div className='overflow-hidden rounded-none border border-black bg-white px-4 py-3 text-center font-mono text-xs text-neutral-500'>
        {t('No performance data available')}
      </div>
    )
  }

  return (
    <div className='overflow-hidden rounded-none border border-black bg-white'>
      <div className='flex flex-wrap items-center gap-x-5 gap-y-2.5 px-4 py-2.5 sm:px-5 sm:py-3'>
        {/* Title */}
        <div className='flex items-center gap-1.5'>
          <div className='flex size-6 shrink-0 items-center justify-center rounded-none border border-black/25 bg-white text-black [&>svg]:size-3.5'>
            <HeartPulse />
          </div>
          <span className='font-mono text-xs font-bold tracking-wider whitespace-nowrap text-black uppercase'>
            {t('Performance health')}
          </span>
        </div>

        {/* Separator */}
        <div className='hidden h-4 w-px bg-black/20 sm:block' />

        {/* 3 KPI inline metrics */}
        {loading ? (
          <div className='flex flex-wrap items-center gap-x-5 gap-y-2'>
            {['success', 'latency', 'throughput'].map((key) => (
              <div key={key} className='flex items-center gap-1.5'>
                <Skeleton className='h-3 w-14 rounded-none' />
                <Skeleton className='h-4 w-16 rounded-none' />
              </div>
            ))}
          </div>
        ) : (
          <div className='flex flex-wrap items-center gap-x-5 gap-y-2'>
            <InlineMetric
              icon={HeartPulse}
              label={t('Success rate')}
              value={formatUptimePct(summary?.success_rate ?? Number.NaN)}
              valueClassName={getSuccessRateTextClass(
                summary?.success_rate ?? Number.NaN
              )}
            />
            <InlineMetric
              icon={Timer}
              label={t('Average latency')}
              value={formatLatency(summary?.avg_latency_ms ?? 0)}
            />
            <InlineMetric
              icon={Gauge}
              label={t('Throughput')}
              value={formatThroughput(summary?.avg_tps ?? 0)}
            />
          </div>
        )}

        {/* Separator */}
        <div className='hidden h-4 w-px bg-black/20 lg:block' />

        {/* Top models inline badges */}
        {!loading && hasData && (
          <div className='flex flex-wrap items-center gap-1.5'>
            {topModels.map((model) => (
              <ModelBadge key={model.model_name} model={model} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function InlineMetric(props: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
  valueClassName?: string
}) {
  const Icon = props.icon

  return (
    <div className='flex items-center gap-1.5'>
      <div className='flex size-5 shrink-0 items-center justify-center rounded-none border border-black/20 bg-white text-black [&>svg]:size-3'>
        <Icon />
      </div>
      <span className='font-mono text-[11px] tracking-wide text-neutral-500 uppercase'>
        {props.label}
      </span>
      <span
        className={cn(
          'font-mono text-xs font-bold tabular-nums text-black',
          props.valueClassName
        )}
      >
        {props.value}
      </span>
    </div>
  )
}

function ModelBadge(props: { model: PerfModelSummary }) {
  const model = props.model

  return (
    <span className='inline-flex items-center gap-1.5 rounded-none border border-black/20 bg-neutral-50 px-2 py-0.5 text-black transition-colors hover:bg-neutral-100'>
      <span className='max-w-[10rem] truncate font-mono text-[11px]'>
        {model.model_name}
      </span>
      <span
        className='size-1.5 shrink-0 rounded-none bg-black'
        aria-hidden='true'
      />
      <span className='font-mono text-[11px] font-bold text-black tabular-nums'>
        {formatUptimePct(model.success_rate)}
      </span>
    </span>
  )
}
