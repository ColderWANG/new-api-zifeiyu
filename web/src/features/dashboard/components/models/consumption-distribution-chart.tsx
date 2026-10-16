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
import { VChart } from '@visactor/react-vchart'
import { AreaChart, BarChart3, WalletCards } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useThemeCustomization } from '@/context/theme-customization-provider'
import {
  CONSUMPTION_DISTRIBUTION_CHART_OPTIONS,
  DEFAULT_TIME_GRANULARITY,
} from '@/features/dashboard/constants'
import { processChartData } from '@/features/dashboard/lib'
import type {
  ConsumptionDistributionChartType,
  QuotaDataItem,
} from '@/features/dashboard/types'
import type { TimeGranularity } from '@/lib/time'
import { useChartTheme } from '@/lib/use-chart-theme'
import { VCHART_OPTION } from '@/lib/vchart'

interface ConsumptionDistributionChartProps {
  data: QuotaDataItem[]
  loading?: boolean
  timeGranularity?: TimeGranularity
  defaultChartType?: ConsumptionDistributionChartType
}

const CHART_TYPE_ICONS: Record<
  ConsumptionDistributionChartType,
  typeof BarChart3
> = {
  bar: BarChart3,
  area: AreaChart,
}

export function ConsumptionDistributionChart(
  props: ConsumptionDistributionChartProps
) {
  const { t } = useTranslation()
  const { themeReady } = useChartTheme()
  const { customization } = useThemeCustomization()
  const [chartType, setChartType] = useState<ConsumptionDistributionChartType>(
    props.defaultChartType ?? 'bar'
  )
  const timeGranularity = props.timeGranularity ?? DEFAULT_TIME_GRANULARITY

  useEffect(() => {
    if (props.defaultChartType) setChartType(props.defaultChartType)
  }, [props.defaultChartType])

  const chartData = useMemo(
    () => processChartData(props.loading ? [] : props.data, timeGranularity, t),
    [props.data, props.loading, timeGranularity, t]
  )
  const spec = chartType === 'bar' ? chartData.spec_line : chartData.spec_area
  const specType = typeof spec?.type === 'string' ? spec.type : chartType
  const chartKey = [
    chartType,
    specType,
    props.loading ? 'loading' : 'ready',
    props.data.length,
    customization.preset,
  ].join('-')

  return (
    <div className='border-border bg-card overflow-hidden rounded-none border'>
      <div className='border-border bg-card flex w-full flex-col gap-1.5 border-b px-3 py-2 sm:gap-3 sm:px-5 sm:py-3 lg:flex-row lg:items-center lg:justify-between'>
        <div className='flex items-center gap-2'>
          <div className='border-border bg-background text-foreground flex size-7 shrink-0 items-center justify-center rounded-none border [&>svg]:size-3.5'>
            <WalletCards />
          </div>
          <div className='text-foreground font-mono text-sm font-bold tracking-wider uppercase'>
            {t('Quota Distribution')}
          </div>
          <span className='border-border bg-muted text-muted-foreground rounded-none border px-2 py-0.5 font-mono text-xs'>
            {t('Total:')} {chartData.totalQuotaDisplay}
          </span>
        </div>

        <div className='border-border bg-background inline-flex h-7 w-full overflow-x-auto rounded-none border p-0.5 sm:h-8 sm:w-auto'>
          {CONSUMPTION_DISTRIBUTION_CHART_OPTIONS.map((item) => {
            const Icon = CHART_TYPE_ICONS[item.value]
            return (
              <button
                key={item.value}
                type='button'
                onClick={() => setChartType(item.value)}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-none px-3 font-mono text-xs font-medium transition-none ${
                  chartType === item.value
                    ? 'bg-foreground text-background'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                <Icon className='size-3.5' />
                {t(item.labelKey)}
              </button>
            )
          })}
        </div>
      </div>

      <div className='h-[300px] p-1.5 sm:h-96 sm:p-2'>
        {themeReady && spec && (
          <VChart
            key={chartKey}
            spec={{
              ...spec,
              theme: 'light',
              background: 'transparent',
            }}
            option={VCHART_OPTION}
          />
        )}
      </div>
    </div>
  )
}
