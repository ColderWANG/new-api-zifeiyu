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
import type { Column } from '@tanstack/react-table'
import { Check as CheckIcon, PlusCircle as PlusCircledIcon } from 'lucide-react'
import * as React from 'react'
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
  PopoverTrigger,
} from '@/components/ui/popover'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'

type DataTableFacetedFilterProps<TData, TValue> = {
  column?: Column<TData, TValue>
  title?: string
  options: {
    label: string
    value: string
    icon?: React.ComponentType<{ className?: string }>
    iconNode?: React.ReactNode
    count?: number
  }[]
  /** Enable single select mode (only one option can be selected at a time) */
  singleSelect?: boolean
}

function DataTableFacetedFilterInner<TData, TValue>({
  column,
  title,
  options,
  singleSelect = false,
}: DataTableFacetedFilterProps<TData, TValue>) {
  const { t } = useTranslation()
  const facets = column?.getFacetedUniqueValues()
  const filterValue = Array.isArray(column?.getFilterValue())
    ? (column.getFilterValue() as unknown[])
    : []
  const selectedValues = new Set(filterValue.map(String))
  const selectedOptions = options.filter((option) =>
    selectedValues.has(option.value)
  )

  const handleOptionSelect = (optionValue: string) => {
    const nextSelectedValues = getNextSelectedValues(
      selectedValues,
      optionValue,
      singleSelect
    )

    column?.setFilterValue(
      nextSelectedValues.length ? nextSelectedValues : undefined
    )
  }

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            variant='outline'
            size='sm'
            className='h-8 rounded-none border-2 border-dashed border-black'
          />
        }
      >
        <PlusCircledIcon className='size-4' />
        {title}
        {selectedValues.size > 0 && (
          <>
            <Separator
              orientation='vertical'
              className='mx-2 h-4 bg-black/20'
            />
            <Badge
              variant='secondary'
              className='rounded-none px-1 font-mono text-xs'
            >
              {selectedOptions
                .slice(0, 2)
                .map((option) => t(option.label))
                .join(' / ')}
              {selectedValues.size > 2 && (
                <span className='ms-1'>+{selectedValues.size - 2}</span>
              )}
            </Badge>
          </>
        )}
      </PopoverTrigger>
      <PopoverContent
        className='max-w-[360px] min-w-[200px] rounded-none border-2 border-black p-0 shadow-none'
        align='start'
      >
        <Command className='rounded-none'>
          <CommandInput placeholder={title} />
          <CommandList>
            <CommandEmpty>{t('No results found.')}</CommandEmpty>
            <CommandGroup>
              {options.map((option) => {
                const isSelected = selectedValues.has(option.value)
                return (
                  <CommandItem
                    key={option.value}
                    onSelect={() => handleOptionSelect(option.value)}
                    aria-selected={isSelected}
                    data-filter-selected={isSelected}
                    className='rounded-none'
                  >
                    <div
                      className={cn(
                        'flex size-4 items-center justify-center rounded-none border-2 border-current',
                        isSelected
                          ? 'bg-black text-white'
                          : 'opacity-40 [&_svg]:hidden'
                      )}
                    >
                      <CheckIcon className='size-3.5 text-current' />
                    </div>
                    {option.iconNode ? (
                      <span className='text-muted-foreground flex size-4 items-center justify-center'>
                        {option.iconNode}
                      </span>
                    ) : null}
                    {!option.iconNode && option.icon ? (
                      <option.icon className='text-muted-foreground size-4' />
                    ) : null}
                    <span
                      className='min-w-0 flex-1 truncate'
                      title={t(option.label)}
                    >
                      {t(option.label)}
                    </span>
                    {typeof option.count === 'number' ? (
                      <span className='text-muted-foreground ms-auto flex h-4 min-w-4 items-center justify-center font-mono text-xs'>
                        {option.count}
                      </span>
                    ) : null}
                    {typeof option.count !== 'number' &&
                    facets?.get(option.value) ? (
                      <span className='ms-auto flex h-4 w-4 items-center justify-center font-mono text-xs'>
                        {facets.get(option.value)}
                      </span>
                    ) : null}
                  </CommandItem>
                )
              })}
            </CommandGroup>
            {selectedValues.size > 0 && (
              <>
                <CommandSeparator />
                <CommandGroup>
                  <CommandItem
                    onSelect={() => column?.setFilterValue(undefined)}
                    className='justify-center rounded-none text-center'
                  >
                    {t('Clear filters')}
                  </CommandItem>
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

export const DataTableFacetedFilter =
  DataTableFacetedFilterInner as typeof DataTableFacetedFilterInner

function getNextSelectedValues(
  selectedValues: Set<string>,
  optionValue: string,
  singleSelect: boolean
): string[] {
  if (singleSelect) {
    return selectedValues.has(optionValue) ? [] : [optionValue]
  }

  const nextSelectedValues = new Set(selectedValues)
  if (nextSelectedValues.has(optionValue)) {
    nextSelectedValues.delete(optionValue)
  } else {
    nextSelectedValues.add(optionValue)
  }

  return [...nextSelectedValues]
}
