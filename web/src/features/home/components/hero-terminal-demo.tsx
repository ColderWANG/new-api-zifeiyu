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
import { useState, useEffect, useRef, type ReactNode } from 'react'

import { cn } from '@/lib/utils'

interface ApiDemoConfig {
  id: string
  label: string
  method: 'POST' | 'GET'
  endpoint: string
  headers: string[]
  request: string[]
  response: string[]
  tokens: number
  latency: number
}

const API_DEMOS: ApiDemoConfig[] = [
  {
    id: 'gpt-chat',
    label: 'Chat',
    method: 'POST',
    endpoint: '/v1/chat/completions',
    headers: ['"Authorization: Bearer sk-••••"'],
    request: [
      '"model": "your-model",',
      '"messages": [',
      '  { "role": "user", "content": "..." }',
      ']',
    ],
    response: [
      '{',
      '  "choices": [{ "content": <text> }],',
      '  "usage": { "total_tokens": <tokens> }',
      '}',
    ],
    tokens: 27,
    latency: 142,
  },
  {
    id: 'responses',
    label: 'Responses',
    method: 'POST',
    endpoint: '/v1/responses',
    headers: ['"Authorization: Bearer sk-••••"'],
    request: ['"model": "your-model",', '"input": "..."'],
    response: [
      '{',
      '  "output": [{ "text": <text> }],',
      '  "usage": { "total_tokens": <tokens> }',
      '}',
    ],
    tokens: 31,
    latency: 168,
  },
  {
    id: 'claude',
    label: 'Claude',
    method: 'POST',
    endpoint: '/v1/messages',
    headers: ['"x-api-key: sk-••••"', '"anthropic-version: 2023-06-01"'],
    request: [
      '"model": "your-model",',
      '"max_tokens": 1024,',
      '"messages": [',
      '  { "role": "user", "content": "..." }',
      ']',
    ],
    response: [
      '{',
      '  "content": [{ "text": <text> }],',
      '  "usage": { "input_tokens": <in>, "output_tokens": <out> }',
      '}',
    ],
    tokens: 29,
    latency: 156,
  },
  {
    id: 'gemini',
    label: 'Gemini',
    method: 'POST',
    endpoint: '/v1beta/models/{model}:generateContent',
    headers: ['"x-goog-api-key: sk-••••"'],
    request: [
      '"contents": [',
      '  { "role": "user",',
      '    "parts": [{ "text": "..." }] }',
      ']',
    ],
    response: [
      '{',
      '  "candidates": [{ "text": <text> }],',
      '  "usageMetadata": { "totalTokenCount": <tokens> }',
      '}',
    ],
    tokens: 25,
    latency: 93,
  },
]

const CYCLE_INTERVAL = 4500
const TRANSITION_MS = 220

interface HeroTerminalDemoProps {
  className?: string
}

export function HeroTerminalDemo(props: HeroTerminalDemoProps) {
  const [activeIndex, setActiveIndex] = useState(0)
  const [transitioning, setTransitioning] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval>>(undefined)
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (mq.matches) return

    intervalRef.current = setInterval(() => {
      setTransitioning(true)
      timeoutRef.current = setTimeout(() => {
        setActiveIndex((prev) => (prev + 1) % API_DEMOS.length)
        setTransitioning(false)
      }, TRANSITION_MS)
    }, CYCLE_INTERVAL)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [])

  const handleSelect = (index: number) => {
    if (index === activeIndex) return
    if (intervalRef.current) clearInterval(intervalRef.current)
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    setTransitioning(true)
    timeoutRef.current = setTimeout(() => {
      setActiveIndex(index)
      setTransitioning(false)
    }, TRANSITION_MS)
  }

  const demo = API_DEMOS[activeIndex]

  return (
    <div
      className={cn(
        'flex min-h-0 w-full max-w-none flex-1 flex-col',
        props.className
      )}
    >
      <div className='flex min-h-[32rem] w-full flex-1 flex-col border-t-2 border-black bg-white'>
        {/* Tab strip */}
        <div className='flex overflow-x-auto border-b border-black'>
          {API_DEMOS.map((item, index) => {
            const isActive = index === activeIndex
            return (
              <button
                key={item.id}
                type='button'
                onClick={() => handleSelect(index)}
                className={cn(
                  '-mb-px min-w-20 shrink-0 border-r border-black px-4 py-3 font-mono text-[10px] tracking-[0.18em] uppercase transition-none',
                  isActive
                    ? 'bg-black text-white'
                    : 'bg-white text-black hover:bg-neutral-100'
                )}
              >
                {item.label}
              </button>
            )
          })}
          <div className='ml-auto hidden min-w-24 items-center justify-end border-l border-black px-4 py-3 sm:flex'>
            <span className='mm-label'>200 OK</span>
          </div>
        </div>

        {/* Endpoint row */}
        <div className='flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-black px-5 py-4'>
          <span className='border border-black px-2 py-1 font-mono text-[10px] font-semibold tracking-[0.16em] uppercase'>
            {demo.method}
          </span>
          <code
            className={cn(
              'min-w-0 flex-1 truncate font-mono text-xs transition-opacity duration-100',
              transitioning ? 'opacity-0' : 'opacity-100'
            )}
          >
            {demo.endpoint}
          </code>
        </div>

        <div className='flex min-h-0 flex-1 flex-col font-mono text-[11px] leading-relaxed sm:text-xs'>
          <div className='min-h-0 flex-1'>
            <RequestBlock demo={demo} transitioning={transitioning} />
            <ResponseBlock demo={demo} transitioning={transitioning} />
          </div>

          <div className='mt-auto grid grid-cols-2 border-t-2 border-black bg-black text-white sm:grid-cols-4'>
            <MetricCell label='ms' value={String(demo.latency)} />
            <MetricCell label='tokens' value={String(demo.tokens)} />
            <MetricCell
              label='cost'
              value={`$${(demo.tokens * 0.00003).toFixed(5)}`}
            />
            <MetricCell label='stream' value='sse' />
          </div>
        </div>
      </div>
    </div>
  )
}

function MetricCell(props: { label: string; value: string }) {
  return (
    <div className='border-r border-white/20 px-3 py-3 last:border-r-0 sm:px-4'>
      <div className='mm-label text-white/55'>{props.label}</div>
      <div className='mt-2 font-mono text-sm tabular-nums'>{props.value}</div>
    </div>
  )
}

function RequestBlock(props: { demo: ApiDemoConfig; transitioning: boolean }) {
  const { demo, transitioning } = props

  return (
    <div className='relative min-w-0 px-4 py-3.5 sm:px-5 sm:py-4'>
      <SectionLabel>Request</SectionLabel>
      <div
        className={cn(
          'mt-2 transition-opacity duration-100',
          transitioning ? 'opacity-0' : 'opacity-100'
        )}
      >
        <CodeLine>
          <Command>curl</Command> <Flag>-X</Flag> <Flag>POST</Flag>{' '}
          <StringText>&quot;{demo.endpoint}&quot;</StringText>{' '}
          <Muted>{'\\'}</Muted>
        </CodeLine>
        {demo.headers.map((header) => (
          <CodeLine key={header} indent={2}>
            <Flag>-H</Flag> <StringText>{header}</StringText>{' '}
            <Muted>{'\\'}</Muted>
          </CodeLine>
        ))}
        <CodeLine indent={2}>
          <Flag>-d</Flag> <StringText>&apos;{'{'}</StringText>
        </CodeLine>
        {demo.request.map((line, i) => (
          // Static code lines can repeat and never reorder independently.
          // eslint-disable-next-line react/no-array-index-key
          <CodeLine key={i} indent={4}>
            {renderJsonLine(line)}
          </CodeLine>
        ))}
        <CodeLine indent={2}>
          <StringText>{'}'}&apos;</StringText>
        </CodeLine>
      </div>
    </div>
  )
}

function ResponseBlock(props: { demo: ApiDemoConfig; transitioning: boolean }) {
  const { demo, transitioning } = props

  return (
    <div className='relative min-w-0 border-t border-black bg-neutral-50 px-4 py-3.5 sm:px-5 sm:py-4'>
      <SectionLabel>Response</SectionLabel>
      <div
        className={cn(
          'mt-2 transition-opacity duration-100',
          transitioning ? 'opacity-0' : 'opacity-100'
        )}
      >
        {demo.response.map((line, i) => (
          // Static code lines can repeat and never reorder independently.
          // eslint-disable-next-line react/no-array-index-key
          <CodeLine key={i}>{renderResponseLine(line, demo)}</CodeLine>
        ))}
      </div>
    </div>
  )
}

function SectionLabel(props: { children: ReactNode }) {
  return <span className='mm-label text-neutral-500'>{props.children}</span>
}

const STRING_RE = /"[^"]*"/g
const PLACEHOLDER_RE = /<[a-z]+>/gi

function renderJsonLine(line: string): ReactNode {
  if (!line.trim()) return <Muted> </Muted>
  return tokenize(line)
}

function renderResponseLine(line: string, demo: ApiDemoConfig): ReactNode {
  if (!line.trim()) return <Muted> </Muted>

  const segments: ReactNode[] = []
  let cursor = 0
  const matches = [...line.matchAll(PLACEHOLDER_RE)]

  if (matches.length === 0) return tokenize(line)

  matches.forEach((match) => {
    const start = match.index ?? 0
    if (start > cursor) {
      segments.push(
        <span key={`pre-${start}`}>{tokenize(line.slice(cursor, start))}</span>
      )
    }
    const placeholder = match[0]
    if (placeholder === '<text>') {
      segments.push(
        <Accent key={`ph-${start}`}>{`"${truncateResponse(demo)}"`}</Accent>
      )
    } else if (placeholder === '<tokens>') {
      segments.push(<NumberText key={`ph-${start}`}>{demo.tokens}</NumberText>)
    } else if (placeholder === '<in>') {
      segments.push(
        <NumberText key={`ph-${start}`}>
          {Math.floor(demo.tokens * 0.4)}
        </NumberText>
      )
    } else if (placeholder === '<out>') {
      segments.push(
        <NumberText key={`ph-${start}`}>
          {Math.ceil(demo.tokens * 0.6)}
        </NumberText>
      )
    } else {
      segments.push(<Muted key={`ph-${start}`}>{placeholder}</Muted>)
    }
    cursor = start + placeholder.length
  })

  if (cursor < line.length) {
    segments.push(<span key='tail'>{tokenize(line.slice(cursor))}</span>)
  }

  return segments
}

function truncateResponse(demo: ApiDemoConfig): string {
  const map: Record<string, string> = {
    'gpt-chat': 'Chat request routed.',
    responses: 'Response workflow ready.',
    claude: 'Claude message routed.',
    gemini: 'Gemini request served.',
  }
  return map[demo.id] ?? '...'
}

function tokenize(input: string): ReactNode {
  // Split string into "..." string runs and the rest, then color keys/punct.
  const segments: ReactNode[] = []
  let cursor = 0
  const matches = [...input.matchAll(STRING_RE)]

  matches.forEach((match) => {
    const start = match.index ?? 0
    if (start > cursor) {
      segments.push(
        <Muted key={`m-${start}`}>{input.slice(cursor, start)}</Muted>
      )
    }
    const text = match[0]
    const after = input.slice(start + text.length).trimStart()
    const isKey = after.startsWith(':')
    if (isKey) {
      segments.push(<Key key={`k-${start}`}>{text}</Key>)
    } else {
      segments.push(<StringText key={`s-${start}`}>{text}</StringText>)
    }
    cursor = start + text.length
  })

  if (cursor < input.length) {
    segments.push(<Muted key='tail'>{input.slice(cursor)}</Muted>)
  }

  return segments
}

function CodeLine(props: { children: ReactNode; indent?: number }) {
  return (
    <div className='break-words whitespace-pre-wrap'>
      {props.indent ? (
        <span
          aria-hidden
          className='inline-block'
          style={{ width: `${props.indent}ch` }}
        />
      ) : null}
      {props.children}
    </div>
  )
}

function Command(props: { children: ReactNode }) {
  return <span className='font-semibold'>{props.children}</span>
}

function Flag(props: { children: ReactNode }) {
  return (
    <span className='underline decoration-2 underline-offset-4'>
      {props.children}
    </span>
  )
}

function Key(props: { children: ReactNode }) {
  return <span className='text-neutral-900'>{props.children}</span>
}

function StringText(props: { children: ReactNode }) {
  return <span className='text-neutral-600 italic'>{props.children}</span>
}

function NumberText(props: { children: ReactNode }) {
  return <span className='font-semibold'>{props.children}</span>
}

function Muted(props: { children: ReactNode }) {
  return <span className='text-neutral-500'>{props.children}</span>
}

function Accent(props: { children: ReactNode }) {
  return <span className='font-semibold'>{props.children}</span>
}
