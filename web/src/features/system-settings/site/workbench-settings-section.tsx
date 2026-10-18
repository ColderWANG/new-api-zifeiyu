import { zodResolver } from '@hookform/resolvers/zod'
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
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { useForm, type Resolver } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { z } from 'zod'

import { Button } from '@/components/ui/button'
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  getGameSettings,
  saveSettings,
  type GameSettings,
} from '@/features/game-center/api'
import { getCurrencyLabel } from '@/lib/currency'
import {
  formatQuota,
  getEditableQuotaStep,
  parseQuotaFromDollars,
  quotaUnitsToDollars,
} from '@/lib/format'
import { handleServerError } from '@/lib/handle-server-error'

import {
  SettingsForm,
  SettingsSwitchField,
} from '../components/settings-form-layout'
import { SettingsPageFormActions } from '../components/settings-page-context'
import { SettingsSection } from '../components/settings-section'

const amountSchema = z.preprocess(
  (value) =>
    typeof value === 'string' && value.trim() === '' ? Number.NaN : value,
  z.coerce.number().min(0)
)
const schema = z.object({
  enabled: z.boolean(),
  imageEnabled: z.boolean(),
  translationEnabled: z.boolean(),
  rewardsEnabled: z.boolean(),
  first: amountSchema,
  additional: amountSchema,
  dailyBudget: amountSchema,
  weeklyBudget: amountSchema,
})
type Values = z.infer<typeof schema>
export function WorkbenchSettingsSection({
  imageEnabled,
  translationEnabled,
}: {
  imageEnabled: boolean
  translationEnabled: boolean
}) {
  const { t } = useTranslation()
  const query = useQuery({
    queryKey: ['game-settings'],
    queryFn: getGameSettings,
  })
  if (query.isPending) return <Skeleton className='h-80 w-full' />
  if (query.isError || !query.data) {
    return (
      <div role='alert'>
        <p>{t('Unable to load game settings')}</p>
        <Button onClick={() => void query.refetch()}>{t('Retry')}</Button>
      </div>
    )
  }
  return (
    <WorkbenchSettingsForm
      settings={query.data}
      imageEnabled={imageEnabled}
      translationEnabled={translationEnabled}
    />
  )
}
function WorkbenchSettingsForm({
  settings,
  imageEnabled,
  translationEnabled,
}: {
  settings: GameSettings
  imageEnabled: boolean
  translationEnabled: boolean
}) {
  const { t } = useTranslation()
  const client = useQueryClient()
  const [saving, setSaving] = useState(false)
  const defaults = useMemo(
    () => ({
      enabled: settings.enabled,
      imageEnabled,
      translationEnabled,
      rewardsEnabled: settings.rewards_enabled,
      first: quotaUnitsToDollars(settings.first_token_quota),
      additional: quotaUnitsToDollars(settings.subsequent_token_quota),
      dailyBudget: quotaUnitsToDollars(settings.daily_budget),
      weeklyBudget: quotaUnitsToDollars(settings.weekly_budget),
    }),
    [settings, imageEnabled, translationEnabled]
  )
  const form = useForm<Values>({
    resolver: zodResolver(schema) as Resolver<Values>,
    defaultValues: defaults,
  })
  useEffect(() => {
    form.reset(defaults)
  }, [defaults, form])
  const first = form.watch('first'),
    additional = form.watch('additional')
  const maximum =
    parseQuotaFromDollars(Number(first)) +
    186 * parseQuotaFromDollars(Number(additional))
  async function submit(values: Values) {
    setSaving(true)
    try {
      await saveSettings({
        ...settings,
        enabled: values.enabled,
        image_studio_enabled: values.imageEnabled,
        translation_studio_enabled: values.translationEnabled,
        rewards_enabled: values.rewardsEnabled,
        reward_version: 2,
        daily_quota: 0,
        first_token_quota: parseQuotaFromDollars(values.first),
        subsequent_token_quota: parseQuotaFromDollars(values.additional),
        daily_budget: parseQuotaFromDollars(values.dailyBudget),
        weekly_budget: parseQuotaFromDollars(values.weeklyBudget),
      })
      form.reset(values)
      toast.success(t('Saved successfully'))
    } catch (error) {
      handleServerError(error)
    } finally {
      setSaving(false)
      await Promise.all([
        client.invalidateQueries({ queryKey: ['game-settings'] }),
        client.invalidateQueries({ queryKey: ['game-status'] }),
        client.invalidateQueries({ queryKey: ['status'] }),
        client.invalidateQueries({ queryKey: ['system-options'] }),
      ])
    }
  }
  return (
    <SettingsSection title={t('Studios and games')}>
      <SettingsForm onSubmit={form.handleSubmit(submit)}>
        <SettingsPageFormActions
          onSave={form.handleSubmit(submit)}
          isSaving={saving}
          isSaveDisabled={!form.formState.isDirty}
        />
        <FieldGroup>
          <FieldDescription>
            {t(
              'Feature switches disable the page and its studio requests. Navigation visibility is configured separately in Header navigation and Sidebar modules.'
            )}
          </FieldDescription>
          <div className='divide-y'>
            <SettingsSwitchField
              controlId='feature-games'
              label={t('Game Center')}
              checked={form.watch('enabled')}
              onCheckedChange={(v) =>
                form.setValue('enabled', v, { shouldDirty: true })
              }
              description={t(
                'Closing Game Center prevents new runs. Existing runs can finish and settle.'
              )}
            />
            <SettingsSwitchField
              controlId='feature-image-studio'
              label={t('Image Studio')}
              checked={form.watch('imageEnabled')}
              onCheckedChange={(v) =>
                form.setValue('imageEnabled', v, { shouldDirty: true })
              }
            />
            <SettingsSwitchField
              controlId='feature-translation-studio'
              label={t('Translation Studio')}
              checked={form.watch('translationEnabled')}
              onCheckedChange={(v) =>
                form.setValue('translationEnabled', v, { shouldDirty: true })
              }
            />
          </div>
          <div className='border-t pt-4'>
            <SettingsSwitchField
              controlId='game-rewards'
              label={t('Enable quota rewards')}
              checked={form.watch('rewardsEnabled')}
              onCheckedChange={(v) =>
                form.setValue('rewardsEnabled', v, { shouldDirty: true })
              }
            />
          </div>
          <div className='grid gap-5 sm:grid-cols-2'>
            <Field>
              <FieldLabel htmlFor='reward-first'>
                {t('First collected token')} ({getCurrencyLabel()})
              </FieldLabel>
              <Input
                id='reward-first'
                type='number'
                min={0}
                step={getEditableQuotaStep()}
                {...form.register('first')}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor='reward-additional'>
                {t('Each additional token')} ({getCurrencyLabel()})
              </FieldLabel>
              <Input
                id='reward-additional'
                type='number'
                min={0}
                step={getEditableQuotaStep()}
                {...form.register('additional')}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor='reward-daily-budget'>
                {t('Total daily reward budget')} ({getCurrencyLabel()})
              </FieldLabel>
              <Input
                id='reward-daily-budget'
                type='number'
                min={0}
                step={getEditableQuotaStep()}
                {...form.register('dailyBudget')}
              />
              <FieldDescription>
                {t(
                  'Zero means no total budget cap. A capped budget reserves the maximum reward before a run starts.'
                )}
              </FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor='reward-weekly-budget'>
                {t('Weekly leaderboard prize pool')} ({getCurrencyLabel()})
              </FieldLabel>
              <Input
                id='reward-weekly-budget'
                type='number'
                min={0}
                step={getEditableQuotaStep()}
                {...form.register('weeklyBudget')}
              />
            </Field>
          </div>
          {Object.keys(form.formState.errors).length > 0 && (
            <p role='alert' className='text-destructive text-sm'>
              {t('Invalid game reward settings')}
            </p>
          )}
          <div className='bg-muted/20 border p-4 text-sm'>
            <p>
              {t('Maximum reward for one run')}:{' '}
              <strong>{formatQuota(maximum)}</strong>
            </p>
            <p className='text-muted-foreground mt-2 text-xs'>
              {t(
                'Based on at most 187 collected tokens. No token means no reward; points and boss token values do not multiply payouts.'
              )}
            </p>
          </div>
          <FieldDescription>
            {t(
              'Feature availability changes immediately. Reward amounts and budgets apply to the next period once the current period has started.'
            )}
          </FieldDescription>
        </FieldGroup>
      </SettingsForm>
    </SettingsSection>
  )
}
