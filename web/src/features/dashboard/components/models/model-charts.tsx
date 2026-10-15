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
import { PieChart as PieChartIcon } from 'lucide-react'
import { useEffect, useMemo, useState, useRef } from 'react'
import { useTranslation } from 'react-i18next'

import { useThemeCustomization } from '@/context/theme-customization-provider'
import { useTheme } from '@/context/theme-provider'
import {
  DEFAULT_TIME_GRANULARITY,
  MODEL_ANALYTICS_CHART_OPTIONS,
} from '@/features/dashboard/constants'
import { processChartData } from '@/features/dashboard/lib'
import type {
  ModelAnalyticsChartTab,
  QuotaDataItem,
} from '@/features/dashboard/types'
import type { TimeGranularity } from '@/lib/time'
import { VCHART_OPTION } from '@/lib/vchart'

let themeManagerPromise: Promise<
  (typeof import('@visactor/vchart'))['ThemeManager']
> | null = null

type ChartSpecKey = 'spec_model_line' | 'spec_pie' | 'spec_rank_bar'

const CHART_SPEC_KEYS: Record<ModelAnalyticsChartTab, ChartSpecKey> = {
  trend: 'spec_model_line',
  proportion: 'spec_pie',
  top: 'spec_rank_bar',
}

interface ModelChartsProps {
  data: QuotaDataItem[]
  loading?: boolean
  timeGranularity?: TimeGranularity
  defaultChartTab?: ModelAnalyticsChartTab
}

export function ModelCharts(props: ModelChartsProps) {
  const { t } = useTranslation()
  const { resolvedTheme } = useTheme()
  const { customization } = useThemeCustomization()
  const [activeTab, setActiveTab] = useState<ModelAnalyticsChartTab>(
    props.defaultChartTab ?? 'trend'
  )
  const [themeReady, setThemeReady] = useState(false)
  const themeManagerRef = useRef<
    (typeof import('@visactor/vchart'))['ThemeManager'] | null
  >(null)
  const timeGranularity = props.timeGranularity ?? DEFAULT_TIME_GRANULARITY

  useEffect(() => {
    if (props.defaultChartTab) setActiveTab(props.defaultChartTab)
  }, [props.defaultChartTab])

  useEffect(() => {
    const updateTheme = async () => {
      setThemeReady(false)

      if (!themeManagerPromise) {
        themeManagerPromise = import('@visactor/vchart').then(
          (m) => m.ThemeManager
        )
      }

      const ThemeManager = await themeManagerPromise
      themeManagerRef.current = ThemeManager
      ThemeManager.setCurrentTheme(resolvedTheme === 'dark' ? 'dark' : 'light')
      setThemeReady(true)
    }

    updateTheme()
  }, [resolvedTheme])

  const chartData = useMemo(
    () =>
      processChartData(
        props.loading ? [] : props.data,
        timeGranularity,
        t,
        undefined,
        resolvedTheme === 'dark' ? 'dark' : 'light'
      ),
    [props.data, props.loading, timeGranularity, t, resolvedTheme]
  )

  const spec = chartData[CHART_SPEC_KEYS[activeTab]]
  const specType = typeof spec?.type === 'string' ? spec.type : activeTab
  const chartKey = [
    activeTab,
    specType,
    props.loading ? 'loading' : 'ready',
    props.data.length,
    resolvedTheme,
    customization.preset,
  ].join('-')

  return (
    <div className='border-border bg-card overflow-hidden rounded-none border'>
      <div className='border-border bg-card flex w-full flex-col gap-1.5 border-b px-3 py-2 sm:gap-3 sm:px-5 sm:py-3 lg:flex-row lg:items-center lg:justify-between'>
        <div className='flex items-center gap-2'>
          <div className='border-border bg-background text-foreground flex size-7 shrink-0 items-center justify-center rounded-none border [&>svg]:size-3.5'>
            <PieChartIcon />
          </div>
          <div className='text-foreground font-mono text-sm font-bold tracking-wider uppercase'>
            {t('Model Call Analytics')}
          </div>
          <span className='border-border bg-muted text-muted-foreground rounded-none border px-2 py-0.5 font-mono text-xs'>
            {t('Total:')} {chartData.totalCountDisplay}
          </span>
        </div>

        <div className='border-border bg-background inline-flex h-7 w-full overflow-x-auto rounded-none border p-0.5 sm:h-8 sm:w-auto'>
          {MODEL_ANALYTICS_CHART_OPTIONS.map((tab) => (
            <button
              key={tab.value}
              type='button'
              onClick={() => setActiveTab(tab.value)}
              className={`shrink-0 rounded-none px-3 font-mono text-xs font-medium transition-none ${
                activeTab === tab.value
                  ? 'bg-foreground text-background'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              {t(tab.labelKey)}
            </button>
          ))}
        </div>
      </div>

      <div className='h-[300px] p-1.5 sm:h-96 sm:p-2'>
        {themeReady && spec && (
          <VChart
            key={chartKey}
            spec={{
              ...spec,
              theme: resolvedTheme === 'dark' ? 'dark' : 'light',
              background: 'transparent',
            }}
            option={VCHART_OPTION}
          />
        )}
      </div>
    </div>
  )
}
