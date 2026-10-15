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

import { ArrowUpRight, ImagePlus, Layers, Type, Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Combobox } from '@/components/ui/combobox'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import type { ModelOption } from '@/features/playground/types'

import {
  STUDIO_RATIOS,
  type ReferenceImage,
  type StudioMode,
  type StudioRatio,
  type StudioProtocol,
} from '../types'
import { ReferenceUpload } from './reference-upload'

type StudioControlsProps = {
  protocol: StudioProtocol
  onProtocolChange: (value: StudioProtocol) => void
  generating: boolean
  canGenerate: boolean
  onGenerate: () => void
  group: string
  models: ModelOption[]
  model: string
  loading: boolean
  failed: boolean
  onRetry: () => void
  onModelChange: (value: string) => void
  mode: StudioMode
  onModeChange: (value: StudioMode) => void
  prompt: string
  onPromptChange: (value: string) => void
  ratio: StudioRatio
  onRatioChange: (value: StudioRatio) => void
  count: string
  onCountChange: (value: string) => void
  reference: ReferenceImage | null
  uploadError: string | null
  onReferenceChange: (file: File) => void
  onReferenceRemove: () => void
}

export function StudioControls(props: StudioControlsProps) {
  const { t } = useTranslation()

  return (
    <section aria-label={t('Creation settings')} className='studio-controls'>
      <fieldset disabled={props.generating} className='min-w-0'>
        <ToggleGroup
          disabled={props.generating}
          aria-label={t('Generation mode')}
          value={[props.mode]}
          onValueChange={(values) => {
            const value = values[0]
            if (value === 'text' || value === 'image') props.onModeChange(value)
          }}
          className='studio-modes w-full border-b border-neutral-200'
        >
          <ToggleGroupItem value='text' className='h-12 flex-1 gap-2'>
            <Type size={16} strokeWidth={1.5} aria-hidden='true' />
            {t('Text to image')}
          </ToggleGroupItem>
          <ToggleGroupItem value='image' className='h-12 flex-1 gap-2'>
            <ImagePlus size={16} strokeWidth={1.5} aria-hidden='true' />
            {t('Image to image')}
          </ToggleGroupItem>
        </ToggleGroup>

        <div className='space-y-6 py-6'>
          <div className='space-y-3'>
            <div className='flex min-w-0 items-center justify-between gap-3'>
              <Label htmlFor='studio-model'>{t('Model')}</Label>
              <span className='studio-caption flex min-w-0 items-center gap-1.5'>
                <Layers size={12} aria-hidden='true' />
                <span className='max-w-40 truncate' title={props.group}>
                  {props.group || '—'}
                </span>
              </span>
            </div>
            <Combobox
              id='studio-model'
              aria-label={t('Model')}
              aria-describedby='studio-model-help'
              options={props.models}
              value={props.model}
              onValueChange={(value) => {
                if (value) props.onModelChange(value)
              }}
              placeholder={
                props.loading
                  ? t('Loading models…')
                  : t('Select an image model')
              }
              disabled={
                props.generating ||
                props.loading ||
                props.models.length === 0 ||
                props.failed
              }
              className='studio-model-select'
            />
            <div
              id='studio-model-help'
              className='studio-caption leading-relaxed'
              role={props.failed ? 'alert' : undefined}
            >
              {props.failed ? (
                <span>
                  {t('Unable to load image models.')}{' '}
                  <Button
                    variant='link'
                    className='h-11 px-1 text-xs'
                    onClick={props.onRetry}
                  >
                    {t('Retry')}
                  </Button>
                </span>
              ) : (
                <span>
                  {!props.loading && props.models.length === 0
                    ? t('No image models are available in your group.')
                    : t('Image models available in your current group.')}
                </span>
              )}
            </div>
          </div>

          <div className='space-y-3'>
            <Label htmlFor='studio-protocol'>{t('Generation protocol')}</Label>
            <Select
              disabled={props.generating}
              items={{
                images: t('Images API'),
                chat: t('Chat API (Gemini images)'),
              }}
              value={props.protocol}
              onValueChange={(value) => {
                if (value === 'images' || value === 'chat') {
                  props.onProtocolChange(value)
                }
              }}
            >
              <SelectTrigger
                id='studio-protocol'
                className='border-neutral-200 data-[size=default]:h-11'
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='images'>{t('Images API')}</SelectItem>
                <SelectItem value='chat'>
                  {t('Chat API (Gemini images)')}
                </SelectItem>
              </SelectContent>
            </Select>
            <p className='studio-caption'>
              {t('Choose the protocol supported by your channel.')}
            </p>
          </div>
          {props.mode === 'image' && (
            <ReferenceUpload
              image={props.reference}
              error={props.uploadError}
              onSelect={props.onReferenceChange}
              onRemove={props.onReferenceRemove}
            />
          )}

          <div className='space-y-3'>
            <div className='flex items-center justify-between'>
              <Label htmlFor='studio-prompt'>{t('Describe your image')}</Label>
              <span className='studio-caption font-mono'>
                {props.prompt.length} / 2000
              </span>
            </div>
            <Textarea
              id='studio-prompt'
              className='studio-prompt min-h-40 resize-y border-neutral-200 p-4 leading-7'
              maxLength={2000}
              value={props.prompt}
              onChange={(event) => props.onPromptChange(event.target.value)}
              placeholder={
                props.mode === 'text'
                  ? t(
                      'Describe the subject, setting, light and style you have in mind…'
                    )
                  : t(
                      'Describe what to change or preserve in your reference image…'
                    )
              }
            />
          </div>

          <fieldset className='space-y-3'>
            <legend className='text-sm font-semibold'>
              {t('Aspect ratio')}
            </legend>
            <ToggleGroup
              aria-label={t('Aspect ratio')}
              value={[props.ratio]}
              onValueChange={(values) => {
                const ratio = STUDIO_RATIOS.find(
                  (item) => item.value === values[0]
                )
                if (ratio) props.onRatioChange(ratio.value)
              }}
              className='studio-ratios grid w-full grid-cols-4 gap-2'
            >
              {STUDIO_RATIOS.map((ratio) => (
                <ToggleGroupItem
                  key={ratio.value}
                  value={ratio.value}
                  disabled={
                    props.generating ||
                    (props.protocol === 'images' &&
                      props.model.toLowerCase().includes('gpt-image') &&
                      ratio.value === '16:9')
                  }
                  aria-label={ratio.value}
                  className='h-16 flex-col gap-2 border border-neutral-200 font-mono text-xs'
                >
                  <span
                    aria-hidden='true'
                    className='block max-h-5 border border-current'
                    style={{
                      width: (ratio.width / ratio.height) * 16,
                      height: 16,
                    }}
                  />
                  {ratio.value}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </fieldset>

          <div className='flex items-center justify-between gap-4'>
            <Label htmlFor='studio-count'>{t('Number of images')}</Label>
            <Select
              disabled={props.generating || props.protocol === 'chat'}
              value={props.count}
              onValueChange={(value) => {
                if (value) props.onCountChange(value)
              }}
            >
              <SelectTrigger
                id='studio-count'
                className='w-24 border-neutral-200 data-[size=default]:h-11'
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {['1', '2', '4'].map((count) => (
                  <SelectItem value={count} key={count}>
                    {count}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </fieldset>

      <div className='mt-auto space-y-3 border-t border-neutral-200 pt-6'>
        <Button
          disabled={!props.canGenerate || props.generating}
          onClick={props.onGenerate}
          aria-describedby='studio-preview-note'
          className='h-12 w-full justify-between px-5 disabled:opacity-60'
        >
          {props.generating ? t('Generating images…') : t('Generate image')}
          {props.generating ? (
            <Loader2
              size={18}
              className='animate-spin motion-reduce:animate-none'
              aria-hidden='true'
            />
          ) : (
            <ArrowUpRight size={18} aria-hidden='true' />
          )}
        </Button>
        <p id='studio-preview-note' className='studio-caption leading-relaxed'>
          {t(
            'Generation uses your account balance at the configured model price. Keep this page open while it finishes.'
          )}
        </p>
      </div>
    </section>
  )
}
