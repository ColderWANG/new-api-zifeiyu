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
import { Radio as RadioPrimitive } from '@base-ui/react/radio'
import { RadioGroup as RadioGroupPrimitive } from '@base-ui/react/radio-group'

import { cn } from '@/lib/utils'

function RadioGroup({ className, ...props }: RadioGroupPrimitive.Props) {
  return (
    <RadioGroupPrimitive
      data-slot='radio-group'
      className={cn('grid w-full gap-2', className)}
      {...props}
    />
  )
}

function RadioGroupItem({ className, ...props }: RadioPrimitive.Root.Props) {
  return (
    <RadioPrimitive.Root
      data-slot='radio-group-item'
      className={cn(
        'group/radio-group-item peer relative flex aspect-square size-4 shrink-0 items-center justify-center rounded-none border-2 border-black bg-white dark:border-white dark:bg-black outline-none after:absolute after:-inset-x-3 after:-inset-y-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-black dark:focus-visible:outline-white focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50 data-checked:border-black data-checked:bg-black text-white dark:data-checked:border-white dark:data-checked:bg-white dark:text-black',
        className
      )}
      {...props}
    >
      <RadioPrimitive.Indicator
        data-slot='radio-group-indicator'
        className='flex size-4 items-center justify-center'
      >
        <span className='size-2 rounded-none bg-white dark:bg-black' />
      </RadioPrimitive.Indicator>
    </RadioPrimitive.Root>
  )
}

export { RadioGroup, RadioGroupItem }
