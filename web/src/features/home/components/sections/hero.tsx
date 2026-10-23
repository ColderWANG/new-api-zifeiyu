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
import { Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'

import { HeroTerminalDemo } from '../hero-terminal-demo'

interface HeroProps {
  className?: string
  isAuthenticated?: boolean
}

export function Hero(props: HeroProps) {
  const { t } = useTranslation()
  return (
    <section className='relative z-10 border-b-4 border-black px-5 py-16 sm:px-8 md:py-24 lg:py-32'>
      <div className='mx-auto max-w-6xl'>
        <div className='grid gap-10 sm:gap-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] lg:gap-16'>
          <div className='min-w-0'>
            <div className='mb-8 flex items-center gap-3 sm:mb-10 sm:gap-4'>
              <span className='size-3 border-2 border-black' aria-hidden />
              <span className='mm-label'>{t('AI Gateway')}</span>
              <span className='h-px flex-1 bg-black' aria-hidden />
              <span className='mm-label'>{t('Docs')}</span>
            </div>

            <h1 className='mm-display text-[clamp(3.2rem,6vw,5.5rem)] uppercase'>
              {t('API')}
              <br />
              {t('Gateway')}
            </h1>

            <p className='mt-7 max-w-xl text-base leading-relaxed text-neutral-600 sm:mt-10 sm:text-lg sm:text-xl'>
              {t('One standard API for models, routing, and usage analytics.')}
            </p>

            <div className='mt-8 flex flex-col items-stretch gap-3 sm:mt-10 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4'>
              {props.isAuthenticated ? (
                <Button
                  className='h-12 rounded-none border-2 border-black bg-black px-6 font-mono text-xs tracking-[0.2em] text-white uppercase hover:bg-white hover:text-black sm:px-8'
                  render={<Link to='/dashboard' />}
                >
                  {t('Go to Dashboard')}
                </Button>
              ) : (
                <Button
                  className='h-12 rounded-none border-2 border-black bg-black px-6 font-mono text-xs tracking-[0.2em] text-white uppercase hover:bg-white hover:text-black sm:px-8'
                  render={<Link to='/sign-up' />}
                >
                  {t('Get Started')}
                </Button>
              )}
              <Button
                variant='outline'
                className='h-12 rounded-none border-2 border-black bg-transparent px-8 font-mono text-xs tracking-[0.2em] text-black uppercase hover:bg-black hover:text-white'
                render={<Link to='/pricing' />}
              >
                {t('View Pricing')}
              </Button>
            </div>

            <div className='mt-10 grid max-w-2xl grid-cols-1 gap-px border border-black bg-black sm:mt-14 sm:grid-cols-3'>
              {[
                t('Unified Routing'),
                t('Transparent Billing'),
                t('Team Collaboration'),
              ].map((tag) => (
                <div key={tag} className='bg-white px-5 py-5'>
                  <span className='mm-label'>{tag}</span>
                </div>
              ))}
            </div>
          </div>

          <div className='flex w-full min-w-0 flex-col overflow-hidden border-4 border-black bg-white lg:h-full'>
            <div className='flex shrink-0 items-center justify-between border-b border-black px-5 py-4'>
              <span className='mm-label'>Request</span>
              <span className='size-3 border-2 border-black' aria-hidden />
            </div>
            <div className='flex min-h-0 flex-1 flex-col'>
              <HeroTerminalDemo className='min-h-0 flex-1 border-0' />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
