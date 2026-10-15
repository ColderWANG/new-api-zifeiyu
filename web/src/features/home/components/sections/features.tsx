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
import { Code, DollarSign, Gauge, KeyRound, Shield, Users } from 'lucide-react'
import { useTranslation } from 'react-i18next'

interface FeaturesProps {
  className?: string
}

export function Features(_props: FeaturesProps) {
  const { t } = useTranslation()

  const features = [
    {
      title: t('High Performance'),
      desc: t('Support for high concurrency with automatic load balancing'),
      icon: <Gauge className='size-6' strokeWidth={1.5} />,
    },
    {
      title: t('Secure & Reliable'),
      desc: t(
        'Enterprise-grade security with comprehensive permission management'
      ),
      icon: <Shield className='size-6' strokeWidth={1.5} />,
    },
    {
      title: t('Transparent Billing'),
      desc: t('Pay-as-you-go with real-time usage monitoring'),
      icon: <DollarSign className='size-6' strokeWidth={1.5} />,
    },
    {
      title: t('Team Collaboration'),
      desc: t('Multi-user management with flexible permission allocation'),
      icon: <Users className='size-6' strokeWidth={1.5} />,
    },
    {
      title: t('Developer Friendly'),
      desc: t('Compatible API routes for common AI application workflows'),
      icon: <Code className='size-6' strokeWidth={1.5} />,
    },
    {
      title: t('API Key Management'),
      desc: t('Create, rotate, and scope API keys with permission controls'),
      icon: <KeyRound className='size-6' strokeWidth={1.5} />,
    },
  ]

  return (
    <section className='relative z-10 bg-white px-5 py-16 sm:px-8 md:py-24'>
      <div className='mx-auto max-w-6xl'>
        <div className='mb-10 grid gap-7 sm:mb-16 sm:gap-8 md:grid-cols-[1fr_auto] md:items-end'>
          <div>
            <div className='mm-label mb-5'>{t('Index')}</div>
            <h2 className='mm-display text-[clamp(2.2rem,8vw,6rem)] uppercase'>
              {t('Core Features')}
            </h2>
          </div>
          <p className='max-w-xs border-l-2 border-black pl-5 text-sm leading-relaxed text-neutral-600'>
            {t('Built for developers, designed for scale')}
          </p>
        </div>

        <div className='grid gap-px border-4 border-black bg-black sm:grid-cols-2 lg:grid-cols-3'>
          {features.map((feature) => (
            <div
              key={feature.title}
              className='group bg-white p-5 transition-colors duration-100 hover:bg-black hover:text-white sm:p-8'
            >
              <div className='flex items-start justify-between gap-6'>
                <span className='text-black transition-colors group-hover:text-white'>
                  {feature.icon}
                </span>
                <span className='mm-label text-neutral-400 transition-colors group-hover:text-neutral-500'>
                  {t('Feature')}
                </span>
              </div>
              <h3 className='mt-8 text-xl font-semibold tracking-tight sm:mt-14 sm:text-2xl'>
                {feature.title}
              </h3>
              <p className='mt-3 text-sm leading-relaxed text-neutral-600 transition-colors group-hover:text-neutral-400'>
                {feature.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
