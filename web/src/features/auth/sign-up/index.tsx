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

import { useStatus } from '@/hooks/use-status'
import { useSystemConfig } from '@/hooks/use-system-config'

import { AuthLayout } from '../auth-layout'
import { TermsFooter } from '../components/terms-footer'
import { SignUpForm } from './components/sign-up-form'

export function SignUp() {
  const { t } = useTranslation()
  const { status } = useStatus()
  const { systemName } = useSystemConfig()

  return (
    <AuthLayout>
      <div className='w-full space-y-8'>
        <div className='border-b-4 border-black pb-7'>
          <div className='mm-label mb-4'>Register</div>
          <h2 className='mm-display text-4xl uppercase sm:text-5xl'>
            {t('Create Account')}
          </h2>
          <p className='mt-4 max-w-md text-sm leading-relaxed text-neutral-600 sm:text-base'>
            {t('Sign up to start using {{siteName}}', {
              siteName: systemName,
            })}
          </p>
          <p className='mt-5 text-sm text-neutral-600'>
            {t('Already have an account?')}{' '}
            <Link
              to='/sign-in'
              className='font-semibold text-black underline decoration-2 underline-offset-4'
            >
              {t('Sign in')}
            </Link>
          </p>
        </div>

        <SignUpForm />

        <TermsFooter
          variant='sign-up'
          status={status}
          className='text-center'
        />
      </div>
    </AuthLayout>
  )
}
