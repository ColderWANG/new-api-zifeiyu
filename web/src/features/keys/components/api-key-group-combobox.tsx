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
import { Check, ChevronsUpDown } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { useMediaQuery } from '@/hooks'
import { cn } from '@/lib/utils'

import {
  AUTO_GROUP_FRAME_CLASS_NAME,
  AutoGroupFlowBorder,
  GroupRatioBadge,
} from './auto-group-visuals'

export type ApiKeyGroupOption = {
  value: string
  label: string
  desc?: string
  ratio?: number | string
}

type ApiKeyGroupComboboxProps = {
  options: ApiKeyGroupOption[]
  value?: string
  onValueChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
}

export function ApiKeyGroupCombobox({
  options,
  value,
  onValueChange,
  placeholder,
  disabled,
}: ApiKeyGroupComboboxProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [searchValue, setSearchValue] = useState('')
  const shouldReduceMotion = useMediaQuery('(prefers-reduced-motion: reduce)')
  const selectedOption = options.find((option) => option.value === value)
  const isAutoSelected = selectedOption?.value === 'auto'

  const filteredOptions = useMemo(() => {
    const search = searchValue.trim().toLowerCase()
    if (!search) return options

    return options.filter((option) => {
      const ratioText = String(option.ratio ?? '').toLowerCase()
      return (
        option.value.toLowerCase().includes(search) ||
        option.label.toLowerCase().includes(search) ||
        option.desc?.toLowerCase().includes(search) ||
        ratioText.includes(search)
      )
    })
  }, [options, searchValue])

  const handleSelect = (selectedValue: string) => {
    onValueChange(selectedValue)
    setOpen(false)
    setSearchValue('')
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            type='button'
            variant='outline'
            role='combobox'
            aria-expanded={open}
            data-auto-group-effect={isAutoSelected ? 'trigger' : undefined}
            disabled={disabled}
            className={cn(
              'border border-border bg-popover hover:bg-accent hover:text-accent-foreground text-foreground relative h-auto min-h-14 w-full justify-between gap-2 rounded-none px-3 py-2 text-start shadow-none duration-100 sm:min-h-20 sm:gap-3 sm:px-4 sm:py-3',
              isAutoSelected &&
                cn(AUTO_GROUP_FRAME_CLASS_NAME, 'border border-border')
            )}
          />
        }
      >
        {isAutoSelected && (
          <AutoGroupFlowBorder shouldReduceMotion={shouldReduceMotion} />
        )}
        <span className='flex min-w-0 flex-1 items-center justify-between gap-2 sm:gap-3'>
          <span className='min-w-0'>
            <span className='block truncate font-medium'>
              {selectedOption?.label || placeholder || t('Select a group')}
            </span>
            {selectedOption?.desc && (
              <span className='text-muted-foreground block truncate text-[11px] sm:text-xs'>
                {selectedOption.desc}
              </span>
            )}
          </span>
          <span className='hidden sm:block'>
            <GroupRatioBadge
              ratio={selectedOption?.ratio}
              isAuto={isAutoSelected}
              shouldReduceMotion={shouldReduceMotion}
            />
          </span>
        </span>
        <ChevronsUpDown
          aria-hidden='true'
          className='size-4 shrink-0 opacity-60'
        />
      </PopoverTrigger>
      <PopoverContent
        className='border-border bg-popover w-[var(--anchor-width)] overflow-hidden rounded-none border p-0 shadow-none'
        onWheel={(event) => event.stopPropagation()}
        onTouchMove={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <Command shouldFilter={false} className='rounded-none'>
          <CommandInput
            placeholder={t('Search...')}
            value={searchValue}
            onValueChange={setSearchValue}
            className='border-border rounded-none border-b'
          />
          <CommandList className='max-h-[360px] rounded-none'>
            <CommandEmpty>{t('No group found.')}</CommandEmpty>
            <CommandGroup className='p-1'>
              {filteredOptions.map((option) => {
                const isAutoOption = option.value === 'auto'

                return (
                  <CommandItem
                    key={option.value}
                    value={option.value}
                    data-auto-group-effect={isAutoOption ? 'option' : undefined}
                    onSelect={() => handleSelect(option.value)}
                    className={cn(
                      'data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground items-start gap-3 rounded-none px-3 py-3 duration-75',
                      isAutoOption &&
                        cn(AUTO_GROUP_FRAME_CLASS_NAME, 'border-border')
                    )}
                  >
                    {isAutoOption && (
                      <AutoGroupFlowBorder
                        shouldReduceMotion={shouldReduceMotion}
                      />
                    )}
                    <Check
                      aria-hidden='true'
                      className={cn(
                        'mt-0.5 size-4',
                        value === option.value ? 'opacity-100' : 'opacity-0'
                      )}
                    />
                    <span className='min-w-0 flex-1'>
                      <span className='block truncate font-medium'>
                        {option.label}
                      </span>
                      {option.desc && (
                        <span className='text-muted-foreground block truncate text-xs'>
                          {option.desc}
                        </span>
                      )}
                    </span>
                    <GroupRatioBadge
                      ratio={option.ratio}
                      isAuto={isAutoOption}
                      shouldReduceMotion={shouldReduceMotion}
                    />
                  </CommandItem>
                )
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
