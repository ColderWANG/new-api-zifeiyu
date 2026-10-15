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
import { Download, Expand, ExternalLink, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Dialog } from '@/components/dialog'
import { Button } from '@/components/ui/button'
import { handleServerError } from '@/lib/handle-server-error'

import type { StudioImage } from '../types'

type StudioResultsProps = {
  images: StudioImage[]
  generating: boolean
  error: string | null
}

export function StudioResults(props: StudioResultsProps) {
  const { t } = useTranslation()
  const [expanded, setExpanded] = useState<StudioImage | null>(null)
  const [downloading, setDownloading] = useState<number | null>(null)
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set())

  async function download(image: StudioImage, index: number) {
    try {
      setDownloading(index)
      // Never send dashboard credentials to an upstream image host.
      const response = await fetch(image.src, {
        credentials: 'omit',
        referrerPolicy: 'no-referrer',
      })
      if (!response.ok) {
        throw new Error(
          t(
            'Could not download this image. Open the original image to save it.'
          )
        )
      }
      const blob = await response.blob()
      if (!/^image\/(png|jpeg|webp|gif)$/.test(blob.type)) {
        throw new Error(t('The downloaded file is not a supported image.'))
      }
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `image-${index + 1}.${blob.type.split('/')[1]}`
      link.click()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch {
      handleServerError(
        new Error(
          t(
            'Could not download this image. Open the original image to save it.'
          )
        )
      )
    } finally {
      setDownloading(null)
    }
  }

  return (
    <section aria-label={t('Generated images')} className='min-w-0'>
      <h2 className='mb-4 border-b border-neutral-200 pb-4 text-sm font-semibold'>
        {t('Generated images')}
      </h2>
      {props.generating && (
        <div
          role='status'
          className='mb-5 flex items-center gap-3 bg-neutral-50 p-5 text-sm'
        >
          <Loader2
            className='size-5 animate-spin motion-reduce:animate-none'
            aria-hidden='true'
          />
          <div>
            {t('Generating images…')}
            <p className='mt-2 text-xs text-neutral-500'>
              {t('This may take several minutes. Please do not submit again.')}
            </p>
          </div>
        </div>
      )}
      {props.error && (
        <p
          role='alert'
          className='mb-5 border-l-2 border-black bg-neutral-50 p-4 text-sm leading-relaxed break-words'
        >
          {props.error}
        </p>
      )}
      <div className='grid min-w-0 gap-6 sm:grid-cols-2'>
        {props.images.map((image, index) => (
          <article
            key={image.src}
            className={props.images.length === 1 ? 'sm:col-span-2' : ''}
          >
            <div className='flex min-h-48 items-center justify-center bg-neutral-50'>
              {failedImages.has(image.src) ? (
                <p className='p-6 text-sm'>
                  {t(
                    'Image preview unavailable. Try opening the original image.'
                  )}
                </p>
              ) : (
                <img
                  src={image.src}
                  alt={t('Generated image {{number}}', { number: index + 1 })}
                  className='max-h-[65dvh] w-full object-contain'
                  referrerPolicy='no-referrer'
                  onError={() =>
                    setFailedImages((previous) =>
                      new Set(previous).add(image.src)
                    )
                  }
                />
              )}
            </div>
            <div className='flex flex-wrap items-center justify-between gap-2 border-b border-neutral-200 py-2'>
              <span className='text-xs text-neutral-500'>
                {t('Generated image {{number}}', { number: index + 1 })}
              </span>
              <div className='flex gap-1'>
                <Button
                  variant='ghost'
                  className='size-11'
                  aria-label={t('Enlarge image')}
                  onClick={() => setExpanded(image)}
                >
                  <Expand size={16} aria-hidden='true' />
                </Button>
                <Button
                  variant='ghost'
                  className='size-11'
                  aria-label={t('Download image')}
                  disabled={downloading !== null}
                  onClick={() => {
                    void download(image, index)
                  }}
                >
                  <Download size={16} aria-hidden='true' />
                </Button>
                {/^https?:/i.test(image.src) && (
                  <Button
                    variant='ghost'
                    className='size-11'
                    aria-label={t('Open original image')}
                    render={
                      <a
                        href={image.src}
                        target='_blank'
                        rel='noopener noreferrer'
                      />
                    }
                  >
                    <ExternalLink size={16} aria-hidden='true' />
                  </Button>
                )}
              </div>
            </div>
            {image.revisedPrompt && (
              <p className='mt-3 text-xs leading-relaxed break-words text-neutral-500'>
                {image.revisedPrompt}
              </p>
            )}
          </article>
        ))}
      </div>
      <Dialog
        open={!!expanded}
        onOpenChange={(open) => {
          if (!open) setExpanded(null)
        }}
        title={t('Generated images')}
        contentClassName='sm:max-w-5xl'
      >
        {expanded && (
          <img
            src={expanded.src}
            alt={t('Generated images')}
            referrerPolicy='no-referrer'
            className='max-h-[75dvh] w-full object-contain'
          />
        )}
      </Dialog>
    </section>
  )
}
