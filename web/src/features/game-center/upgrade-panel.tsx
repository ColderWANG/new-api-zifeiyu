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
import { Crosshair, Shield, Split, Zap } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'

import { type GameState, UPGRADE_PAUSE_TICKS } from './engine'

export function UpgradePanel({
  state,
  onChoose,
}: {
  state: GameState
  onChoose: (choice: number) => void
}) {
  const { t } = useTranslation()
  const first = useRef<HTMLButtonElement>(null)
  const choose = useRef(onChoose)
  choose.current = onChoose
  useEffect(() => {
    const previous = document.activeElement
    first.current?.focus({ preventScroll: true })
    const keydown = (event: KeyboardEvent) => {
      if (['1', '2', '3'].includes(event.key) && !event.repeat) {
        event.preventDefault()
        choose.current(Number(event.key))
      }
    }
    window.addEventListener('keydown', keydown)
    return () => {
      window.removeEventListener('keydown', keydown)
      if (previous instanceof HTMLElement) {
        previous.focus({ preventScroll: true })
      }
    }
  }, [])
  const seconds = Math.max(
    0,
    Math.ceil((UPGRADE_PAUSE_TICKS - (state.pause_ticks ?? 0)) / 10)
  )
  let upgradeHint = t('Choose an upgrade. The clock keeps running.')
  if (state.version >= 2) {
    upgradeHint = t(
      'Combat resumes after your choice. Repair is selected when time runs out.'
    )
  }
  if (state.version >= 3) {
    upgradeHint = t(
      'Bonuses stack from base stats. Multishot is selected when time runs out.'
    )
  }
  return (
    <div className='bg-background/65 absolute inset-0 z-10 flex items-center justify-center p-3 backdrop-blur-sm'>
      <div
        role='dialog'
        aria-label={t('Choose your upgrade')}
        className='bg-card w-full max-w-lg border p-3 shadow-lg sm:p-5'
      >
        <div className='mb-3 flex items-center justify-between gap-2'>
          <div>
            <p className='text-muted-foreground text-[10px] font-medium tracking-wider'>
              {state.version >= 2 ? t('Combat paused') : t('Upgrade ready')}
            </p>
            <h2 className='mt-1 text-base font-semibold sm:text-xl'>
              {t('Choose your upgrade')}
            </h2>
          </div>
          {state.version >= 2 && (
            <span
              className='bg-muted flex size-10 items-center justify-center font-mono text-lg tabular-nums'
              aria-label={t('Seconds to choose')}
            >
              {seconds}
            </span>
          )}
        </div>
        <div className='grid grid-cols-3 gap-2'>
          {[
            {
              id: 1,
              icon: Crosshair,
              label: t('Power'),
              detail: t('+2 damage'),
            },
            {
              id: 2,
              icon: Zap,
              label: t('Agility'),
              detail:
                state.version >= 3
                  ? t('Move +25% · fire +25%')
                  : t('+20 speed'),
            },
            {
              id: 3,
              icon: state.version >= 3 ? Split : Shield,
              label: state.version >= 3 ? t('Multishot') : t('Repair'),
              detail:
                state.version >= 3
                  ? t('Targets {{from}} → {{to}}', {
                      from: 1 + (state.extra_targets ?? 0),
                      to: 2 + (state.extra_targets ?? 0),
                    })
                  : t('+35 health'),
            },
          ].map((item) => (
            <Button
              ref={item.id === 1 ? first : undefined}
              key={item.id}
              variant='outline'
              className='h-auto min-h-20 flex-col gap-1 px-1 py-2 whitespace-normal sm:min-h-28 sm:gap-2'
              onClick={() => onChoose(item.id)}
            >
              <item.icon className='size-5' />
              <span>
                {item.id}. {item.label}
              </span>
              <span className='text-muted-foreground text-[10px] font-normal sm:text-xs'>
                {item.detail}
              </span>
            </Button>
          ))}
        </div>
        <p className='text-muted-foreground mt-3 text-center text-[10px] sm:text-xs'>
          {upgradeHint}
        </p>
      </div>
    </div>
  )
}
