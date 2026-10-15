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
import {
  BookOpen,
  Check,
  ChevronDown,
  ChevronUp,
  Circle,
  Copy,
  CreditCard,
  FileText,
  KeyRound,
  ListChecks,
  RadioTower,
  ShieldCheck,
  TerminalSquare,
  Timer,
  type LucideIcon,
} from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { useId, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { SectionPageLayout } from '@/components/layout'
import {
  CardStaggerContainer,
  CardStaggerItem,
} from '@/components/page-transition'
import { Button } from '@/components/ui/button'
import type { IconBadgeTone } from '@/components/ui/icon-badge'
import { fetchTokenKey, getApiKeys } from '@/features/keys/api'
import type { ApiKey } from '@/features/keys/types'
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard'
import { getUserModels } from '@/lib/api'
import { handleServerError } from '@/lib/handle-server-error'
import { MOTION_TRANSITION } from '@/lib/motion'
import { ROLE } from '@/lib/roles'
import { requireServerSuccess } from '@/lib/server-error-message'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth-store'

import {
  useApiInfo,
  useDashboardContentVisibility,
} from '../../hooks/use-status-data'
import { AnnouncementsPanel } from './announcements-panel'
import { ApiInfoPanel } from './api-info-panel'
import { FAQPanel } from './faq-panel'
import { PerformanceHealthPanel } from './performance-health-panel'
import { SummaryCards } from './summary-cards'
import { UptimePanel } from './uptime-panel'

const SETUP_GUIDE_VISIBILITY_STORAGE_KEY =
  'dashboard_overview_setup_guide_expanded'

type DashboardActionPath =
  | '/keys'
  | '/wallet'
  | '/playground'
  | '/channels'
  | '/usage-logs'
  | '/pricing'

interface StartStep {
  title: string
  description: string
  to: DashboardActionPath
  icon: LucideIcon
  completed: boolean
}

interface QuickAction {
  title: string
  description: string
  to: DashboardActionPath
  icon: LucideIcon
  adminOnly?: boolean
}

interface RequestExample {
  endpoint: string
  model: string
  keyName: string
  keyId?: number
  displayKey: string
  ready: boolean
}

interface HeroSignal {
  label: string
  value: string
  icon: LucideIcon
  tone: IconBadgeTone
}

function getSavedSetupGuideExpanded(): boolean | null {
  if (typeof window === 'undefined') return null
  const saved = window.localStorage.getItem(SETUP_GUIDE_VISIBILITY_STORAGE_KEY)
  if (saved === 'expanded') return true
  if (saved === 'collapsed') return false
  return null
}

function saveSetupGuideExpanded(expanded: boolean): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(
    SETUP_GUIDE_VISIBILITY_STORAGE_KEY,
    expanded ? 'expanded' : 'collapsed'
  )
}

function getCurrentOrigin(): string {
  if (typeof window === 'undefined') return ''
  return window.location.origin
}

function normalizeEndpoint(sourceUrl?: string): string {
  const fallback = `${getCurrentOrigin()}/v1/chat/completions`
  const trimmed = sourceUrl?.trim()
  if (!trimmed) return fallback

  const withoutTrailingSlash = trimmed.replace(/\/+$/, '')
  if (withoutTrailingSlash.endsWith('/v1/chat/completions')) {
    return withoutTrailingSlash
  }
  if (withoutTrailingSlash.endsWith('/v1')) {
    return `${withoutTrailingSlash}/chat/completions`
  }
  return `${withoutTrailingSlash}/v1/chat/completions`
}

function getPreferredKey(keys: ApiKey[]): ApiKey | null {
  return keys.find((item) => item.status === 1) ?? keys[0] ?? null
}

function formatDisplayKey(key?: string): string {
  if (!key) return 'sk-...'
  if (key.length <= 14) return key
  return `${key.slice(0, 7)}...${key.slice(-4)}`
}

function buildCurlCommand(args: {
  endpoint: string
  apiKey: string
  model: string
}): string {
  return [
    `curl ${args.endpoint} \\`,
    '  -H "Content-Type: application/json" \\',
    `  -H "Authorization: Bearer ${args.apiKey}" \\`,
    `  -d '{"model":"${args.model}","messages":[{"role":"user","content":"Say hello in one sentence."}]}'`,
  ].join('\n')
}

function SetupGuideBackdrop(props: { compact?: boolean }) {
  return (
    <div
      aria-hidden
      className='pointer-events-none absolute inset-0 overflow-hidden'
    >
      <div className='absolute inset-0 bg-[linear-gradient(to_right,#00000006_1px,transparent_1px),linear-gradient(to_bottom,#00000006_1px,transparent_1px)] [background-size:2.5rem_2.5rem]' />
      {props.compact && (
        <div className='absolute inset-y-0 right-0 w-1/2 border-l border-black' />
      )}
    </div>
  )
}
function StartStepItem(props: {
  step: StartStep
  index: number
  isLast: boolean
}) {
  const Icon = props.step.icon
  const StatusIcon = props.step.completed ? Check : Circle

  return (
    <li className='group relative min-w-0'>
      <Link
        to={props.step.to}
        className='relative flex h-full min-w-0 flex-col gap-8 p-6 transition-colors outline-none focus-visible:ring-2 focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 sm:p-7'
      >
        <div
          aria-hidden='true'
          className='absolute inset-x-0 bottom-0 h-[3px] origin-left scale-x-0 bg-black transition-transform duration-500 group-hover:scale-x-100'
        />
        <div className='flex items-start justify-between gap-4'>
          <span className='flex size-12 items-center justify-center border border-black/12 bg-white text-black'>
            <Icon className='size-5' aria-hidden='true' />
          </span>
          <span className='font-mono text-[3rem] leading-none font-semibold tracking-tighter text-black/10 transition-colors group-hover:text-black/20'>
            {String(props.index + 1).padStart(2, '0')}
          </span>
        </div>
        <div>
          <div className='flex items-center gap-2'>
            <StatusIcon
              className={cn(
                'size-4',
                props.step.completed ? 'text-black' : 'text-black/25'
              )}
              aria-hidden='true'
            />
            <h4 className='text-lg font-semibold tracking-tight'>
              {props.step.title}
            </h4>
          </div>
          <p className='mt-2 max-w-sm text-sm leading-relaxed text-neutral-600'>
            {props.step.description}
          </p>
        </div>
      </Link>
    </li>
  )
}

function RequestPreview(props: {
  example: RequestExample
  signals: HeroSignal[]
}) {
  const { t } = useTranslation()
  const shouldReduceMotion = useReducedMotion()
  const [isCopying, setIsCopying] = useState(false)
  const { copyToClipboard } = useCopyToClipboard({ notify: false })
  const previewCurl = buildCurlCommand({
    endpoint: props.example.endpoint,
    apiKey: props.example.displayKey,
    model: props.example.model,
  })
  const previewLines = previewCurl.split('\n')
  const handleCopyRequest = async () => {
    if (!props.example.keyId || isCopying) return

    setIsCopying(true)
    try {
      const result = await fetchTokenKey(props.example.keyId)
      const key = result.success && result.data?.key ? result.data.key : ''
      if (!key) {
        handleServerError(result, t('Failed to copy to clipboard'))
        return
      }

      const realCurl = buildCurlCommand({
        endpoint: props.example.endpoint,
        apiKey: `sk-${key}`,
        model: props.example.model,
      })
      const copied = await copyToClipboard(realCurl)
      if (copied) {
        toast.success(t('Copied to clipboard'))
      } else {
        toast.error(t('Failed to copy to clipboard'))
      }
    } catch (error) {
      handleServerError(error, t('Failed to copy to clipboard'))
    } finally {
      setIsCopying(false)
    }
  }

  return (
    <motion.div
      initial={shouldReduceMotion ? false : { opacity: 0, y: 10, scale: 0.98 }}
      animate={shouldReduceMotion ? undefined : { opacity: 1, y: 0, scale: 1 }}
      transition={MOTION_TRANSITION.slow}
      className='relative overflow-hidden bg-neutral-50 p-4'
    >
      {!shouldReduceMotion && (
        <motion.div
          className='via-foreground/30 pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent to-transparent'
          animate={{ x: ['-100%', '100%'] }}
          transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
          aria-hidden='true'
        />
      )}

      <div className='flex items-center justify-between gap-3 border-b border-black/10 pb-3'>
        <div className='flex min-w-0 items-center gap-2'>
          <span className='flex size-8 shrink-0 items-center justify-center border border-black/15 bg-black text-white'>
            <TerminalSquare className='size-4' />
          </span>
          <div className='min-w-0'>
            <div className='truncate text-sm font-medium'>
              {t('First API request')}
            </div>
            <div className='truncate text-xs text-black/55'>
              {props.example.ready
                ? props.example.keyName
                : t('Create an API key to unlock the real request')}
            </div>
          </div>
        </div>
        {props.example.ready ? (
          <Button
            variant='outline'
            size='sm'
            className='h-7 gap-1.5 rounded-none border border-black bg-white px-2 text-xs text-black transition-none hover:bg-black hover:text-white'
            disabled={isCopying}
            onClick={handleCopyRequest}
            aria-label={t('Copy ready-to-run curl')}
          >
            <Copy data-icon='inline-start' />
            {isCopying ? t('Loading') : t('Copy')}
          </Button>
        ) : (
          <Button
            size='sm'
            variant='outline'
            className='rounded-none border border-black bg-white px-3 text-xs text-black transition-none hover:bg-black hover:text-white'
            render={<Link to='/keys' />}
          >
            {t('Create API Key')}
          </Button>
        )}
      </div>

      <div className='my-3 bg-white p-3 font-mono text-xs'>
        <div className='mb-2 flex items-center gap-1.5'>
          <span className='size-2 bg-black' />
          <span className='size-2 bg-black/60' />
          <span className='size-2 bg-black' />
        </div>
        <div className='flex flex-col gap-1 overflow-hidden'>
          {previewLines.map((line) => (
            <code key={line} className='truncate text-black/70' title={line}>
              {line}
            </code>
          ))}
        </div>
      </div>

      <div className='grid gap-2'>
        {props.signals.map((signal) => {
          const Icon = signal.icon

          return (
            <div
              key={signal.label}
              className='flex items-center justify-between gap-3 bg-white px-3 py-2'
            >
              <span className='flex min-w-0 items-center gap-2'>
                <span className='flex size-6 shrink-0 items-center justify-center border border-black/12 bg-neutral-100 text-black'>
                  <Icon className='size-3.5' />
                </span>
                <span className='truncate text-xs font-medium'>
                  {signal.label}
                </span>
              </span>
              <span className='shrink-0 font-mono text-xs text-black/55'>
                {signal.value}
              </span>
            </div>
          )
        })}
      </div>
    </motion.div>
  )
}

function QuickActionItem(props: { action: QuickAction }) {
  const Icon = props.action.icon

  return (
    <Button
      variant='outline'
      className='group/action h-auto justify-start rounded-none border border-black/12 bg-white px-3 py-3 text-left font-medium transition-none hover:bg-black hover:text-white'
      render={<Link to={props.action.to} />}
    >
      <span className='flex size-9 shrink-0 items-center justify-center rounded-none border border-black/12 bg-white text-black transition-colors group-hover/action:border-white/30 group-hover/action:bg-white group-hover/action:text-black'>
        <Icon className='size-4' aria-hidden='true' />
      </span>
      <span className='flex min-w-0 flex-1 flex-col gap-0.5'>
        <span className='truncate text-sm font-medium'>
          {props.action.title}
        </span>
        <span className='line-clamp-2 text-xs leading-relaxed text-black/55 group-hover/action:text-white/70'>
          {props.action.description}
        </span>
      </span>
    </Button>
  )
}

function CompactQuickAction(props: { action: QuickAction }) {
  const Icon = props.action.icon

  return (
    <Button
      variant='outline'
      size='sm'
      className='h-8 min-w-24 gap-1.5 rounded-none border border-black/12 bg-white px-3 text-xs font-semibold text-black transition-none hover:bg-black hover:text-white'
      render={<Link to={props.action.to} />}
    >
      <Icon data-icon='inline-start' />
      <span>{props.action.title}</span>
    </Button>
  )
}

export function OverviewDashboard() {
  const { t } = useTranslation()
  const setupGuideId = useId()
  const setupGuideToggleRef = useRef<HTMLButtonElement>(null)
  const user = useAuthStore((state) => state.auth.user)
  const { items: apiInfoItems } = useApiInfo()
  const {
    apiInfo: showApiInfoPanel,
    announcements: showAnnouncementsPanel,
    faq: showFAQPanel,
    uptimeKuma: showUptimePanel,
  } = useDashboardContentVisibility()
  const [manualSetupGuideExpanded, setManualSetupGuideExpanded] = useState<
    boolean | null
  >(() => getSavedSetupGuideExpanded())

  const requestCount = Number(user?.request_count ?? 0)
  const remainQuota = Number(user?.quota ?? 0)
  const usedQuota = Number(user?.used_quota ?? 0)
  const isAdmin = Boolean(user?.role && user.role >= ROLE.ADMIN)

  const apiKeysQuery = useQuery({
    queryKey: ['dashboard', 'overview', 'api-keys'],
    queryFn: async () => {
      const result = requireServerSuccess(await getApiKeys({ p: 1, size: 10 }))
      return result.success ? (result.data?.items ?? []) : []
    },
    staleTime: 60 * 1000,
  })

  const modelsQuery = useQuery({
    queryKey: ['dashboard', 'overview', 'user-models'],
    queryFn: async () => {
      const result = requireServerSuccess(await getUserModels())
      return result.success ? (result.data ?? []) : []
    },
    staleTime: 5 * 60 * 1000,
  })

  const preferredKey = useMemo(
    () => getPreferredKey(apiKeysQuery.data ?? []),
    [apiKeysQuery.data]
  )

  const startSteps = useMemo<StartStep[]>(
    () => [
      {
        title: t('Create API Key'),
        description: t('Create a key for your app or service'),
        to: '/keys',
        icon: KeyRound,
        completed: Boolean(preferredKey),
      },
      {
        title: t('Add credits'),
        description: t('Keep enough balance before production traffic'),
        to: '/wallet',
        icon: CreditCard,
        completed: remainQuota > 0 || usedQuota > 0,
      },
      {
        title: t('Send a request'),
        description: t('Verify routing with Playground or your client'),
        to: '/playground',
        icon: TerminalSquare,
        completed: requestCount > 0,
      },
    ],
    [preferredKey, remainQuota, requestCount, t, usedQuota]
  )

  const quickActions = useMemo<QuickAction[]>(
    () => [
      {
        title: t('API Keys'),
        description: t('Create a key for your app or service'),
        to: '/keys',
        icon: KeyRound,
      },
      {
        title: t('Channels'),
        description: t('Configure upstream providers and routing.'),
        to: '/channels',
        icon: RadioTower,
        adminOnly: true,
      },
      {
        title: t('Usage Logs'),
        description: t('Inspect requests, errors, and billing details'),
        to: '/usage-logs',
        icon: FileText,
      },
      {
        title: t('Pricing'),
        description: t('Review model rates before scaling traffic'),
        to: '/pricing',
        icon: BookOpen,
      },
    ],
    [t]
  )

  const visibleQuickActions = useMemo(
    () => quickActions.filter((action) => !action.adminOnly || isAdmin),
    [isAdmin, quickActions]
  )

  const heroSignals = useMemo<HeroSignal[]>(
    () => [
      {
        label: t('Route active'),
        value: apiInfoItems.length > 0 ? t('Online') : t('Current domain'),
        icon: RadioTower,
        tone: 'info',
      },
      {
        label: t('Auth configured'),
        value: preferredKey ? t('Secured') : t('Needs API key'),
        icon: ShieldCheck,
        tone: 'success',
      },
      {
        label: t('Model selected'),
        value: modelsQuery.data?.[0] ?? t('Loading'),
        icon: Timer,
        tone: 'chart-4',
      },
    ],
    [apiInfoItems.length, modelsQuery.data, preferredKey, t]
  )

  const requestExample = useMemo<RequestExample>(() => {
    const endpoint = normalizeEndpoint(apiInfoItems[0]?.url)
    const model = modelsQuery.data?.[0] ?? 'gpt-4o-mini'
    const keyName = preferredKey?.name ?? t('No API key yet')
    const ready = Boolean(preferredKey?.id && model)

    return {
      endpoint,
      model,
      keyName,
      keyId: preferredKey?.id,
      displayKey: preferredKey
        ? formatDisplayKey(`sk-${preferredKey.key}`)
        : 'sk-...',
      ready,
    }
  }, [apiInfoItems, modelsQuery.data, preferredKey, t])

  const completedStepCount = startSteps.filter((step) => step.completed).length
  const setupComplete = completedStepCount === startSteps.length
  const setupStatusReady = apiKeysQuery.isFetched && Boolean(user)
  const setupGuideExpanded =
    manualSetupGuideExpanded ?? (setupStatusReady && !setupComplete)
  const showLeftContentPanels =
    isAdmin || showApiInfoPanel || showAnnouncementsPanel || showFAQPanel
  const showContentPanels = showLeftContentPanels || showUptimePanel

  const handleSetupGuideToggle = () => {
    const nextExpanded = !setupGuideExpanded
    setManualSetupGuideExpanded(nextExpanded)
    saveSetupGuideExpanded(nextExpanded)
    if (!nextExpanded && setupComplete) {
      setupGuideToggleRef.current?.focus()
    }
  }

  return (
    <SectionPageLayout>
      <SectionPageLayout.Title>{t('Overview')}</SectionPageLayout.Title>
      <SectionPageLayout.Actions>
        {setupStatusReady && setupComplete && (
          <Button
            ref={setupGuideToggleRef}
            variant='outline'
            size='sm'
            className='h-8 rounded-none border border-black bg-white px-3 font-mono text-xs text-black uppercase transition-none hover:bg-black hover:text-white'
            aria-expanded={setupGuideExpanded}
            aria-controls={setupGuideId}
            onClick={handleSetupGuideToggle}
          >
            <ListChecks data-icon='inline-start' />
            {t('Setup guide')}
          </Button>
        )}
      </SectionPageLayout.Actions>
      <SectionPageLayout.Content>
        <div className='relative flex flex-col gap-6'>
          <div aria-hidden='true' className='hidden' />

          <div id={setupGuideId} hidden={!setupGuideExpanded}>
            {setupGuideExpanded && (
              <CardStaggerContainer className='space-y-5'>
                <CardStaggerItem className='relative overflow-hidden border border-black/12 bg-white'>
                  <div className='relative grid gap-0 p-6 sm:p-8 lg:grid-cols-[1.05fr_0.95fr]'>
                    <SetupGuideBackdrop />
                    <div className='relative flex min-w-0 flex-col justify-between gap-8'>
                      <div>
                        <div className='flex flex-wrap items-center gap-3'>
                          <span className='inline-flex items-center gap-2 border border-black bg-black px-3 py-1.5 font-mono text-[10px] font-semibold tracking-[0.16em] text-white uppercase'>
                            <RadioTower
                              className='size-3.5'
                              aria-hidden='true'
                            />
                            {t('Get started')}
                          </span>
                          <span className='font-mono text-xs text-black/45'>
                            {completedStepCount}/{startSteps.length}
                          </span>
                        </div>
                        <h3 className='mt-5 max-w-xl text-[clamp(2rem,3.8vw,3.25rem)] leading-[0.95] font-semibold tracking-[-0.055em] text-black'>
                          {t('Build on your API gateway in minutes')}
                        </h3>
                        <p className='mt-4 max-w-lg text-sm leading-relaxed text-neutral-600 sm:text-base'>
                          {t(
                            'A focused home for keys, balance, routing, and service health.'
                          )}
                        </p>
                      </div>

                      <div className='flex flex-wrap items-center gap-3'>
                        <Button
                          className='h-11 rounded-none border border-black bg-black px-6 text-white transition-none hover:bg-white hover:text-black'
                          render={<Link to='/keys' />}
                        >
                          <KeyRound data-icon='inline-start' />
                          {t('Create API Key')}
                        </Button>
                        <Button
                          variant='outline'
                          className='h-11 rounded-none border border-black bg-white px-5 font-mono text-xs tracking-[0.14em] text-black uppercase transition-none hover:bg-black hover:text-white'
                          aria-expanded={setupGuideExpanded}
                          aria-controls={setupGuideId}
                          onClick={handleSetupGuideToggle}
                        >
                          <ChevronUp data-icon='inline-start' />
                          {t('Hide setup guide')}
                        </Button>
                      </div>
                    </div>

                    <div className='relative flex min-w-0 flex-col gap-5 lg:pl-7'>
                      <RequestPreview
                        example={requestExample}
                        signals={heroSignals}
                      />
                    </div>
                  </div>
                </CardStaggerItem>

                <CardStaggerItem className='overflow-hidden border border-black/12 bg-white'>
                  <div className='grid divide-y divide-black sm:grid-cols-3 sm:divide-x sm:divide-y-0'>
                    {startSteps.map((step, index) => (
                      <StartStepItem
                        key={step.title}
                        step={step}
                        index={index}
                        isLast={index === startSteps.length - 1}
                      />
                    ))}
                  </div>
                </CardStaggerItem>

                <CardStaggerItem className='border border-black/12 bg-white p-5'>
                  <div className='flex flex-wrap items-center justify-between gap-5'>
                    <div>
                      <div className='text-xs font-semibold tracking-[0.18em] text-black uppercase'>
                        {t('Recommended actions')}
                      </div>
                      <h3 className='mt-2 text-xl font-semibold tracking-tight'>
                        {t('Keep the platform ready')}
                      </h3>
                    </div>
                    <div className='grid w-full gap-3 sm:grid-cols-2 xl:w-auto xl:grid-cols-4'>
                      {visibleQuickActions.map((action) => (
                        <QuickActionItem key={action.title} action={action} />
                      ))}
                    </div>
                  </div>
                </CardStaggerItem>
              </CardStaggerContainer>
            )}
          </div>

          {!setupGuideExpanded && !setupComplete && (
            <CardStaggerContainer>
              <CardStaggerItem className='relative overflow-hidden border border-black/12 bg-white'>
                <div className='relative flex flex-wrap items-center justify-between gap-4 p-5'>
                  <SetupGuideBackdrop compact />
                  <div className='relative flex min-w-0 flex-1 items-center gap-4'>
                    <span className='flex size-11 items-center justify-center border border-black/12 bg-white text-black'>
                      <Check className='size-5' aria-hidden='true' />
                    </span>
                    <div className='min-w-0'>
                      <div className='flex flex-wrap items-center gap-2'>
                        <h3 className='truncate text-base font-semibold'>
                          {t('Setup guide')}
                        </h3>
                        <span className='border border-black/15 bg-white px-2.5 py-1 font-mono text-[10px] font-semibold tracking-[0.14em] uppercase'>
                          {t('Setup progress: {{completed}}/{{total}}', {
                            completed: completedStepCount,
                            total: startSteps.length,
                          })}
                        </span>
                      </div>
                      <p className='mt-1 line-clamp-1 text-xs text-neutral-600'>
                        {t('Setup guide is collapsed. Expand it anytime.')}
                      </p>
                    </div>
                  </div>
                  <div className='relative flex flex-wrap items-center gap-2'>
                    {visibleQuickActions.map((action) => (
                      <CompactQuickAction key={action.title} action={action} />
                    ))}
                    <Button
                      variant='outline'
                      size='sm'
                      className='h-9 rounded-none border border-black bg-white px-4 font-mono text-xs tracking-[0.14em] text-black uppercase transition-none hover:bg-black hover:text-white'
                      aria-expanded={setupGuideExpanded}
                      aria-controls={setupGuideId}
                      onClick={handleSetupGuideToggle}
                    >
                      <ChevronDown data-icon='inline-start' />
                      {t('Show setup guide')}
                    </Button>
                  </div>
                </div>
              </CardStaggerItem>
            </CardStaggerContainer>
          )}

          <SummaryCards />

          {showContentPanels && (
            <CardStaggerContainer
              className={cn(
                'grid grid-cols-1 gap-5',
                showLeftContentPanels &&
                  showUptimePanel &&
                  'xl:grid-cols-[minmax(0,1fr)_21rem]'
              )}
            >
              {showLeftContentPanels && (
                <div
                  className={cn(
                    'grid min-w-0 grid-cols-1 gap-5',
                    (showApiInfoPanel ||
                      showAnnouncementsPanel ||
                      showFAQPanel) &&
                      'lg:grid-cols-2'
                  )}
                >
                  {isAdmin && (
                    <CardStaggerItem className='lg:col-span-2'>
                      <PerformanceHealthPanel />
                    </CardStaggerItem>
                  )}
                  {showApiInfoPanel && (
                    <CardStaggerItem>
                      <ApiInfoPanel />
                    </CardStaggerItem>
                  )}
                  {showAnnouncementsPanel && (
                    <CardStaggerItem>
                      <AnnouncementsPanel />
                    </CardStaggerItem>
                  )}
                  {showFAQPanel && (
                    <CardStaggerItem>
                      <FAQPanel />
                    </CardStaggerItem>
                  )}
                </div>
              )}
              {showUptimePanel && (
                <CardStaggerItem>
                  <UptimePanel />
                </CardStaggerItem>
              )}
            </CardStaggerContainer>
          )}
        </div>
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}
