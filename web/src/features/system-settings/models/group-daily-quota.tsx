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
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { z } from 'zod'

import { ErrorState } from '@/components/error-state'
import { LoadingState } from '@/components/loading-state'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import {
  getGroupQuotaPolicies,
  updateGroupQuotaPolicy,
} from '@/features/users/api'
import { getCurrencyLabel } from '@/lib/currency'
import {
  formatQuota,
  parseQuotaFromDollars,
  quotaUnitsToDollars,
} from '@/lib/format'
import { ROLE } from '@/lib/roles'
import { useAuthStore } from '@/stores/auth-store'
import { useSystemConfigStore } from '@/stores/system-config-store'

const schema = z.object({
  amount: z
    .number()
    .finite()
    .min(0)
    .refine(
      (amount) => Number.isSafeInteger(parseQuotaFromDollars(amount)),
      'Invalid amount'
    ),
})

export function GroupDailyQuota() {
  const { t } = useTranslation()
  const viewerRole = useAuthStore((state) => state.auth.user?.role)
  useSystemConfigStore((state) => state.config.currency)
  const queryClient = useQueryClient()
  const policies = useQuery({
    queryKey: ['group-quota-policies'],
    queryFn: getGroupQuotaPolicies,
  })
  const policy = policies.data?.data?.find((item) => item.group === 'workmate')
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { amount: 0 },
  })
  const canEdit = viewerRole === ROLE.SUPER_ADMIN
  const amount = form.watch('amount')
  const delta = parseQuotaFromDollars(amount) - (policy?.daily_quota ?? 0)

  useEffect(() => {
    if (policy) form.reset({ amount: quotaUnitsToDollars(policy.daily_quota) })
  }, [policy, form])

  const save = useMutation({
    mutationFn: (dailyQuota: number) =>
      updateGroupQuotaPolicy('workmate', dailyQuota),
    onSuccess: async () => {
      toast.success(t('Saved successfully'))
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['group-quota-policies'] }),
        queryClient.invalidateQueries({ queryKey: ['users'] }),
        queryClient.invalidateQueries({ queryKey: ['daily-wallet-self'] }),
      ])
    },
  })

  return (
    <section
      aria-label={t('Workmate daily wallet')}
      className='space-y-4 border border-black/15 p-4 sm:p-6'
    >
      <div>
        <h3 className='text-sm font-semibold'>{t('Workmate daily wallet')}</h3>
        <p className='text-muted-foreground mt-2 text-sm'>
          {t(
            'Resets at 00:00 Asia/Shanghai every day. Unused balance does not accumulate. This is not a daily spending cap.'
          )}
        </p>
      </div>
      {policies.isPending && <LoadingState size='sm' />}
      {policies.isError && (
        <ErrorState
          title={t('Failed to load')}
          onRetry={() => {
            void policies.refetch()
          }}
        />
      )}
      {policies.isSuccess && !policy && (
        <p className='text-muted-foreground text-sm'>
          {t('No daily wallet policy configured')}
        </p>
      )}
      {policy && (
        <Form {...form}>
          <form
            className='space-y-4'
            onSubmit={form.handleSubmit((values) =>
              save.mutate(parseQuotaFromDollars(values.amount))
            )}
          >
            <FormField
              control={form.control}
              name='amount'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {t('Daily reset amount ({{currency}})', {
                      currency: getCurrencyLabel(),
                    })}
                  </FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      value={Number.isFinite(field.value) ? field.value : ''}
                      type='number'
                      min={0}
                      step='any'
                      disabled={!canEdit || save.isPending}
                      onChange={(event) =>
                        field.onChange(
                          event.target.value === ''
                            ? Number.NaN
                            : Number(event.target.value)
                        )
                      }
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {canEdit ? (
              <>
                <p aria-live='polite' className='text-muted-foreground text-sm'>
                  {t(
                    'Inherited wallets change immediately by {{delta}}. Personal overrides are unchanged. Balances may become negative.',
                    { delta: formatQuota(delta) }
                  )}
                </p>
                <Button
                  type='submit'
                  disabled={save.isPending || !form.formState.isDirty}
                >
                  {save.isPending
                    ? t('Saving...')
                    : t('Save daily reset amount')}
                </Button>
              </>
            ) : (
              <p className='text-muted-foreground text-sm'>
                {t('Only Root can change the group daily reset amount.')}
              </p>
            )}
          </form>
        </Form>
      )}
    </section>
  )
}
