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

interface CTAProps {
  className?: string
  isAuthenticated?: boolean
}

export function CTA(props: CTAProps) {
  const { t } = useTranslation()

  if (props.isAuthenticated) {
    return null
  }

  return (
    <section className='relative z-10 px-5 pb-16 sm:px-8 md:pb-24'>
      <div className='mx-auto max-w-6xl'>
        <div className='bg-black px-5 py-12 text-white sm:px-12 sm:py-16 md:py-24'>
          <div className='mm-label mb-8 text-neutral-400'>
            {t('Invitation')}
          </div>
          <h2 className='mm-display text-[clamp(2.1rem,9vw,7rem)] uppercase'>
            {t('Ready to simplify')}
            <br />
            {t('your AI integration?')}
          </h2>
          <p className='mt-8 max-w-xl text-lg leading-relaxed text-neutral-400'>
            {t(
              'Deploy your own gateway and start routing requests through your configured upstream services.'
            )}
          </p>
          <div className='mt-10 flex flex-col gap-3 sm:mt-12 sm:flex-row sm:flex-wrap sm:gap-4'>
            <Button
              className='h-12 rounded-none border-2 border-white bg-white px-8 font-mono text-xs tracking-[0.2em] text-black uppercase hover:bg-black hover:text-white'
              render={<Link to='/sign-up' />}
            >
              {t('Get Started')}
            </Button>
            <Button
              variant='outline'
              className='h-12 rounded-none border-2 border-white bg-black px-8 font-mono text-xs tracking-[0.2em] text-white uppercase hover:bg-white hover:text-black'
              render={<Link to='/pricing' />}
            >
              {t('View Pricing')}
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}
