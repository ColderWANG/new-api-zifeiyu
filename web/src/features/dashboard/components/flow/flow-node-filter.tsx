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
import { Filter, X } from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from '@/components/ui/popover'
import type {
  FlowNodeFilter,
  FlowNodeFilterOption,
  FlowNodeKind,
} from '@/features/dashboard/types'

interface FlowNodeFilterControlProps {
  stages: FlowNodeKind[]
  stageLabels: Record<FlowNodeKind, string>
  metricLabel: string
  formatMetricValue: (value: number) => string
  options: FlowNodeFilterOption[]
  selectedNodes: FlowNodeFilter[]
  onToggleNode: (filter: FlowNodeFilter) => void
  onRemoveNode: (filter: FlowNodeFilter) => void
  onClearNodes: () => void
}

function flowNodeFilterKey(filter: FlowNodeFilter): string {
  return `${filter.kind}\u0000${filter.id}`
}

export function FlowNodeFilterControl(props: FlowNodeFilterControlProps) {
  const { t } = useTranslation()
  const selectedKeys = useMemo(
    () => new Set(props.selectedNodes.map(flowNodeFilterKey)),
    [props.selectedNodes]
  )
  const optionLabels = useMemo(() => {
    const labels = new Map<string, FlowNodeFilterOption>()
    for (const option of props.options) {
      labels.set(
        flowNodeFilterKey({ kind: option.kind, id: option.value }),
        option
      )
    }
    return labels
  }, [props.options])
  const optionsByStage = useMemo(
    () =>
      props.stages
        .map((stage) => ({
          stage,
          options: props.options.filter((option) => option.kind === stage),
        }))
        .filter((group) => group.options.length > 0),
    [props.options, props.stages]
  )
  const selectedOptions = props.selectedNodes.map((filter) => {
    const option = optionLabels.get(flowNodeFilterKey(filter))
    return {
      ...filter,
      label: option?.label ?? filter.id,
    }
  })
  const selectedCount = selectedOptions.length

  return (
    <div className='flex min-w-0 flex-col gap-1.5'>
      <span className='font-mono text-xs font-medium tracking-wide text-neutral-500 uppercase'>
        {t('Node filters')}
      </span>
      <div className='flex min-w-0 flex-wrap items-center gap-1.5'>
        <Popover>
          <PopoverTrigger
            render={
              <Button
                type='button'
                variant='outline'
                size='sm'
                className='rounded-none border border-black bg-white font-mono text-xs font-medium text-black transition-none hover:bg-black hover:text-white'
                aria-label={t('Filter by node')}
              />
            }
          >
            <Filter data-icon='inline-start' aria-hidden='true' />
            {selectedCount > 0 ? t('Selected nodes') : t('All nodes')}
            {selectedCount > 0 && (
              <Badge
                variant='secondary'
                className='rounded-none border border-black/30 bg-neutral-100 px-1 font-mono text-[10px] text-black'
              >
                {selectedCount}
              </Badge>
            )}
          </PopoverTrigger>
          <PopoverContent
            className='w-[min(28rem,calc(100vw-2rem))] rounded-none border-2 border-black bg-white p-0 shadow-none'
            align='start'
          >
            <PopoverHeader className='border-b border-black/20 px-3 pt-3 pb-2'>
              <PopoverTitle className='font-mono text-sm font-bold tracking-wider text-black uppercase'>
                {t('Node filters')}
              </PopoverTitle>
              <PopoverDescription className='font-mono text-xs text-neutral-500'>
                {t('Value metric')}: {props.metricLabel}
              </PopoverDescription>
            </PopoverHeader>
            <Command>
              <CommandInput placeholder={t('Filter by node')} />
              <CommandList>
                <CommandEmpty>{t('No nodes')}</CommandEmpty>
                {optionsByStage.map((group) => {
                  const stageLabel = t(props.stageLabels[group.stage])
                  return (
                    <CommandGroup key={group.stage} heading={stageLabel}>
                      {group.options.map((option) => {
                        const key = flowNodeFilterKey({
                          kind: option.kind,
                          id: option.value,
                        })
                        const metricValueLabel = props.formatMetricValue(
                          option.valueRaw
                        )
                        return (
                          <CommandItem
                            key={key}
                            value={`${stageLabel} ${option.label} ${props.metricLabel} ${metricValueLabel}`}
                            data-checked={selectedKeys.has(key)}
                            onSelect={() =>
                              props.onToggleNode({
                                kind: option.kind,
                                id: option.value,
                              })
                            }
                          >
                            <span
                              className='size-2.5 shrink-0 rounded-none border border-black/30'
                              style={{ backgroundColor: option.color }}
                              aria-hidden='true'
                            />
                            <span className='min-w-0 flex-1 truncate'>
                              {option.label}
                            </span>
                            <span className='flex shrink-0 items-center gap-1 font-mono text-xs text-neutral-500'>
                              <span>{props.metricLabel}</span>
                              <span className='font-mono'>
                                {metricValueLabel}
                              </span>
                            </span>
                          </CommandItem>
                        )
                      })}
                    </CommandGroup>
                  )
                })}
                {selectedCount > 0 && (
                  <>
                    <CommandSeparator />
                    <CommandGroup>
                      <CommandItem
                        onSelect={props.onClearNodes}
                        className='justify-center text-center font-mono text-xs'
                      >
                        {t('Clear node filters')}
                      </CommandItem>
                    </CommandGroup>
                  </>
                )}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        {selectedOptions.map((option) => (
          <Badge
            key={flowNodeFilterKey(option)}
            variant='secondary'
            className='max-w-[14rem] rounded-none border border-black/30 bg-neutral-50 pr-1 font-mono text-xs text-black'
          >
            <span className='truncate'>
              {t(props.stageLabels[option.kind])}: {option.label}
            </span>
            <button
              type='button'
              className='flex size-4 shrink-0 items-center justify-center rounded-none transition-none hover:bg-black hover:text-white'
              aria-label={t('Remove node filter')}
              onClick={() =>
                props.onRemoveNode({ kind: option.kind, id: option.id })
              }
            >
              <X aria-hidden='true' />
            </button>
          </Badge>
        ))}

        {selectedCount > 1 && (
          <Button
            type='button'
            variant='ghost'
            size='xs'
            onClick={props.onClearNodes}
            className='rounded-none font-mono text-xs text-neutral-500 hover:bg-neutral-100 hover:text-black'
          >
            {t('Clear')}
          </Button>
        )}
      </div>
    </div>
  )
}
