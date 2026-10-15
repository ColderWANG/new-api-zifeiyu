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

import { Skeleton } from '@/components/ui/skeleton'
import { useSystemConfig } from '@/hooks/use-system-config'

type AuthLayoutProps = {
  children: React.ReactNode
}

export function AuthLayout({ children }: AuthLayoutProps) {
  const { t } = useTranslation()
  const { systemName, logo, loading } = useSystemConfig()

  return (
    <div className='mm mm-lines mm-noise relative flex min-h-svh flex-col overflow-hidden bg-white text-black'>
      <div
        aria-hidden
        className='pointer-events-none absolute inset-y-0 left-8 hidden w-px bg-black/10 lg:block'
      >
        <div className='absolute inset-y-0 right-8 w-px bg-black/10' />
      </div>

      <div className='relative flex flex-1 items-center justify-center px-5 py-16 sm:px-8'>
        <div className='w-full max-w-lg'>
          <Link to='/' className='group mb-10 flex items-center gap-4'>
            <div className='flex size-12 shrink-0 items-center justify-center overflow-hidden border-2 border-black bg-white p-1.5'>
              {loading ? (
                <Skeleton className='h-full w-full' />
              ) : (
                <img
                  src={logo}
                  alt={t('Logo')}
                  className='h-full w-full object-contain'
                />
              )}
            </div>
            <div className='min-w-0'>
              {loading ? (
                <Skeleton className='h-7 w-32' />
              ) : (
                <div className='text-xl font-semibold tracking-tight text-black'>
                  {systemName}
                </div>
              )}
              <div className='mm-label mt-1 text-neutral-500'>
                {t('Powerful API Management Platform')}
              </div>
            </div>
          </Link>

          <div className='border-4 border-black bg-white'>
            <div className='flex items-center justify-between border-b border-black px-6 py-4'>
              <span className='mm-label'>Authentication</span>
              <span className='size-3 border-2 border-black' aria-hidden />
            </div>
            <div className='p-6 sm:p-8'>{children}</div>
          </div>

          <div className='mt-8 flex items-center gap-3'>
            <span className='h-px flex-1 bg-black' aria-hidden />
            <span className='mm-label text-neutral-500'>
              &copy; {new Date().getFullYear()} {systemName}.{' '}
              {t('All rights reserved')}
            </span>
            <span className='h-px flex-1 bg-black' aria-hidden />
          </div>
        </div>
      </div>
    </div>
  )
}
