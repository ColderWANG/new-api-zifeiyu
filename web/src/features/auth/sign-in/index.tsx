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
import { Link, useSearch } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { useStatus } from '@/hooks/use-status'

import { AuthLayout } from '../auth-layout'
import { TermsFooter } from '../components/terms-footer'
import { UserAuthForm } from './components/user-auth-form'

export function SignIn() {
  const { t } = useTranslation()
  const { redirect } = useSearch({ from: '/(auth)/sign-in' })
  const { status } = useStatus()

  return (
    <AuthLayout>
      <div className='w-full space-y-8'>
        <div className='border-b-4 border-black pb-7'>
          <div className='mm-label mb-4'>Sign In</div>
          <h2 className='mm-display text-4xl uppercase sm:text-5xl'>
            {t('Welcome Back')}
          </h2>
          <p className='mt-4 max-w-md text-sm leading-relaxed text-neutral-600 sm:text-base'>
            {t('Sign in to your account to continue')}
          </p>
          {!status?.self_use_mode_enabled &&
            status?.register_enabled !== false && (
              <p className='mt-5 text-sm text-neutral-600'>
                {t("Don't have an account?")}{' '}
                <Link
                  to='/sign-up'
                  className='font-semibold text-black underline decoration-2 underline-offset-4'
                >
                  {t('Sign up')}
                </Link>
              </p>
            )}
        </div>

        <UserAuthForm redirectTo={redirect} />

        <TermsFooter
          variant='sign-in'
          status={status}
          className='text-center'
        />
      </div>
    </AuthLayout>
  )
}
