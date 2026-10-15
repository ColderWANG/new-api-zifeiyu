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

import { ImagePlus, Replace, X } from 'lucide-react'
import { useRef } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'

import type { ReferenceImage } from '../types'

type ReferenceUploadProps = {
  image: ReferenceImage | null
  error: string | null
  onSelect: (file: File) => void
  onRemove: () => void
}

export function ReferenceUpload(props: ReferenceUploadProps) {
  const { t } = useTranslation()
  const input = useRef<HTMLInputElement>(null)

  return (
    <div className='space-y-3'>
      <div className='flex items-center justify-between gap-3'>
        <label htmlFor='studio-reference' className='text-sm font-semibold'>
          {t('Reference image')}
        </label>
        <span className='studio-caption'>
          {t('Uploaded only when generating')}
        </span>
      </div>
      {/* A single reference file is retained as a File for the multipart edit API.
          PromptInput attachments are chat message parts, not file form values. */}
      <input
        id='studio-reference'
        ref={input}
        type='file'
        accept='image/png,image/jpeg,image/webp'
        className='sr-only'
        tabIndex={-1}
        aria-describedby='studio-reference-help'
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) props.onSelect(file)
          event.target.value = ''
        }}
      />
      {props.image ? (
        <div className='flex items-center gap-3 border border-neutral-200 p-3'>
          <img
            src={props.image.url}
            alt={t('Reference image')}
            className='size-16 shrink-0 object-cover'
          />
          <div className='min-w-0 flex-1'>
            <p className='truncate text-xs' title={props.image.file.name}>
              {props.image.file.name}
            </p>
            <Button
              variant='ghost'
              className='mt-1 h-11 px-0 text-xs'
              onClick={() => input.current?.click()}
            >
              <Replace size={14} aria-hidden='true' />
              {t('Replace image')}
            </Button>
          </div>
          <Button
            variant='ghost'
            size='icon'
            className='size-11'
            aria-label={t('Remove reference image')}
            onClick={props.onRemove}
          >
            <X size={16} aria-hidden='true' />
          </Button>
        </div>
      ) : (
        <Button
          variant='outline'
          className='h-auto min-h-32 w-full flex-col gap-3 border-dashed border-neutral-300 py-6 text-sm hover:bg-neutral-50'
          onClick={() => input.current?.click()}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault()
            const file = event.dataTransfer.files[0]
            if (file) props.onSelect(file)
          }}
        >
          <ImagePlus size={24} strokeWidth={1.5} aria-hidden='true' />
          <span>{t('Upload or drop a reference image')}</span>
        </Button>
      )}
      <p id='studio-reference-help' className='studio-caption'>
        {t('PNG, JPG or WebP, up to 10 MB.')}
      </p>
      {props.error && (
        <p role='alert' className='text-xs leading-relaxed'>
          {t(props.error)}
        </p>
      )}
    </div>
  )
}
