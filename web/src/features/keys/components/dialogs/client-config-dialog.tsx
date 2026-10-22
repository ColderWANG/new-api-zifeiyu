/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU
Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { CopyButton } from '@/components/copy-button'
import { Dialog } from '@/components/dialog'
import { Button } from '@/components/ui/button'
import { Combobox } from '@/components/ui/combobox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { useStatus } from '@/hooks/use-status'
import { getUserModels } from '@/lib/api'
import { requireServerSuccess } from '@/lib/server-error-message'

import {
  buildClientLaunchCommand,
  normalizeClientApiBaseUrl,
  type ClientApp,
  type OpenCodeApiMode,
} from '../../lib/client-config'
import type { ApiKey } from '../../types'

interface ClientConfigDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  apiKey: ApiKey
  tokenKey: string
}

export function ClientConfigDialog(props: ClientConfigDialogProps) {
  const { t } = useTranslation()
  const { status } = useStatus()
  const [app, setApp] = useState<ClientApp>('codex')
  const [model, setModel] = useState('')
  const [address, setAddress] = useState(
    (typeof status?.server_address === 'string' &&
      status.server_address.trim()) ||
      window.location.origin
  )
  const [apiMode, setApiMode] = useState<OpenCodeApiMode | null>(null)

  const { data: modelsData } = useQuery({
    queryKey: ['user-models-client-config', props.apiKey.group],
    queryFn: async () =>
      requireServerSuccess(
        await getUserModels(props.apiKey.group || undefined)
      ),
    enabled: props.open,
    staleTime: 5 * 60 * 1000,
  })

  const restrictedModels = useMemo(
    () =>
      props.apiKey.model_limits_enabled
        ? (props.apiKey.model_limits || '')
            .split(',')
            .map((value) => value.trim())
            .filter(Boolean)
        : null,
    [props.apiKey.model_limits_enabled, props.apiKey.model_limits]
  )
  const models = useMemo(() => {
    const available = modelsData?.data
    if (restrictedModels) {
      return available
        ? restrictedModels.filter((value) => available.includes(value))
        : restrictedModels
    }
    return available ?? []
  }, [modelsData?.data, restrictedModels])
  const options = models.map((value) => ({ value, label: value }))
  const suggestedModel =
    models.find((value) => value.toLowerCase().includes('codex')) ||
    models[0] ||
    ''
  const selectedModel = model || suggestedModel
  const selectedApiMode =
    apiMode ||
    (selectedModel.toLowerCase().includes('codex') ? 'responses' : 'chat')
  const apiBaseUrl = normalizeClientApiBaseUrl(address)
  const modelAllowed =
    !!selectedModel &&
    (!restrictedModels || restrictedModels.includes(selectedModel))
  const canCopy = !!props.tokenKey && !!apiBaseUrl && modelAllowed
  const command = canCopy
    ? buildClientLaunchCommand({
        app,
        apiKey: props.tokenKey,
        apiBaseUrl: apiBaseUrl || '',
        model: selectedModel,
        openCodeApiMode: selectedApiMode,
      })
    : ''
  const preview = canCopy
    ? buildClientLaunchCommand({
        app,
        apiKey: 'sk-••••••••',
        apiBaseUrl: apiBaseUrl || '',
        model: selectedModel,
        openCodeApiMode: selectedApiMode,
      })
    : ''

  return (
    <Dialog
      open={props.open}
      onOpenChange={props.onOpenChange}
      title={t('Copy client setup')}
      description={t(
        'Choose a model, then copy the command into a macOS or Linux terminal.'
      )}
      contentClassName='sm:max-w-xl'
      bodyClassName='space-y-4'
      footer={
        <>
          <Button variant='outline' onClick={() => props.onOpenChange(false)}>
            {t('Cancel')}
          </Button>
          {canCopy ? (
            <CopyButton
              value={command}
              variant='default'
              size='sm'
              aria-label={t('Copy setup command')}
            >
              {t('Copy setup command')}
            </CopyButton>
          ) : (
            <Button disabled>{t('Copy setup command')}</Button>
          )}
        </>
      }
    >
      <div className='space-y-2'>
        <Label>{t('Application')}</Label>
        <RadioGroup
          value={app}
          onValueChange={(value) => setApp(value as ClientApp)}
          className='flex gap-5'
        >
          <div className='flex items-center gap-2'>
            <RadioGroupItem value='codex' id='client-app-codex' />
            <Label htmlFor='client-app-codex'>Codex</Label>
          </div>
          <div className='flex items-center gap-2'>
            <RadioGroupItem value='opencode' id='client-app-opencode' />
            <Label htmlFor='client-app-opencode'>OpenCode</Label>
          </div>
        </RadioGroup>
      </div>

      <div className='space-y-2'>
        <Label htmlFor='client-config-model' required>
          {t('Primary Model')}
        </Label>
        <Combobox
          id='client-config-model'
          aria-label={t('Primary Model')}
          options={options}
          value={selectedModel}
          onValueChange={(value) => setModel(value ?? '')}
          placeholder={t('Select or enter model name')}
          emptyText={t('No models found')}
        />
      </div>

      <div className='space-y-2'>
        <Label htmlFor='client-config-address' required>
          {t('API address')}
        </Label>
        <Input
          id='client-config-address'
          value={address}
          onChange={(event) => setAddress(event.target.value)}
          aria-invalid={!!address && !apiBaseUrl}
          className='font-mono text-xs'
        />
        {address && !apiBaseUrl && (
          <p className='text-destructive text-xs'>
            {t('Enter a valid HTTPS API address.')}
          </p>
        )}
      </div>

      {app === 'opencode' && (
        <div className='space-y-2'>
          <Label>{t('OpenCode API mode')}</Label>
          <RadioGroup
            value={selectedApiMode}
            onValueChange={(value) => setApiMode(value as OpenCodeApiMode)}
            className='flex flex-wrap gap-5'
          >
            <div className='flex items-center gap-2'>
              <RadioGroupItem value='responses' id='client-mode-responses' />
              <Label htmlFor='client-mode-responses'>
                {t('Responses API')}
              </Label>
            </div>
            <div className='flex items-center gap-2'>
              <RadioGroupItem value='chat' id='client-mode-chat' />
              <Label htmlFor='client-mode-chat'>{t('Chat Completions')}</Label>
            </div>
          </RadioGroup>
        </div>
      )}

      {preview && (
        <div className='space-y-2'>
          <Label>{t('Command preview')}</Label>
          <pre className='border-border bg-muted max-h-32 overflow-auto rounded-none border p-3 font-mono text-xs break-all whitespace-pre-wrap'>
            {preview}
          </pre>
        </div>
      )}
      <p className='text-muted-foreground text-xs'>
        {t('The copied command contains your API key. Keep it private.')}
      </p>
    </Dialog>
  )
}
