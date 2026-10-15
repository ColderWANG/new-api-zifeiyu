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

import { ArrowUpRight, Expand, Image, Scan } from 'lucide-react'
import { useState, type CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'

import { Dialog } from '@/components/dialog'
import { Button } from '@/components/ui/button'

import { STUDIO_RATIOS, type ReferenceImage, type StudioRatio } from '../types'

type StudioCanvasProps = {
  ratio: StudioRatio
  count: string
  reference: ReferenceImage | null
  onImageError: () => void
  onInspiration: (prompt: string) => void
}

export function StudioCanvas(props: StudioCanvasProps) {
  const { t } = useTranslation()
  const [expanded, setExpanded] = useState(false)
  const ratio =
    STUDIO_RATIOS.find((item) => item.value === props.ratio) ?? STUDIO_RATIOS[0]
  const inspirations = [
    {
      title: t('Architectural light'),
      prompt: t(
        'A minimalist white building by the sea, afternoon sunlight crossing an archway, quiet shadows, architectural photography, restrained composition.'
      ),
    },
    {
      title: t('Product still life'),
      prompt: t(
        'A clear glass perfume bottle on a stone plinth, soft side lighting, delicate reflections, an uncluttered backdrop, editorial product photography.'
      ),
    },
    {
      title: t('Botanical study'),
      prompt: t(
        'A single branch in a ceramic vase, fine leaf details, natural window light, generous negative space, black and white fine art photography.'
      ),
    },
  ]

  return (
    <section aria-label={t('Canvas preview')} className='studio-result min-w-0'>
      <div className='flex min-h-12 flex-wrap items-center justify-between gap-3 border-b border-neutral-200 pb-3'>
        <h2 className='flex items-center gap-2 text-sm font-semibold'>
          <Scan size={16} strokeWidth={1.5} aria-hidden='true' />
          {t('Canvas preview')}
        </h2>
        <span className='studio-caption font-mono'>
          {props.ratio} <span aria-hidden='true'>/</span>{' '}
          {t('Image count: {{count}}', { count: Number(props.count) })}
        </span>
      </div>

      <div className='studio-canvas'>
        <div className='studio-canvas-caption'>
          <span>
            {props.reference
              ? t('Reference preview')
              : t('Your creative space')}
          </span>
          <span className='font-mono'>{props.ratio}</span>
        </div>
        <div
          className='studio-paper'
          style={
            { '--studio-ratio': ratio.width / ratio.height } as CSSProperties
          }
        >
          <span className='studio-crop studio-crop-tl' aria-hidden='true' />
          <span className='studio-crop studio-crop-tr' aria-hidden='true' />
          <span className='studio-crop studio-crop-bl' aria-hidden='true' />
          <span className='studio-crop studio-crop-br' aria-hidden='true' />
          {props.reference ? (
            <img
              src={props.reference.url}
              alt={t('Reference preview')}
              className='size-full object-contain'
              onError={props.onImageError}
            />
          ) : (
            <div className='studio-paper-content'>
              <Image
                size={32}
                strokeWidth={1}
                className='mb-5 text-neutral-400'
                aria-hidden='true'
              />
              <h3 className='font-serif text-2xl leading-snug tracking-tight sm:text-3xl'>
                {t('Make room for imagination.')}
              </h3>
              <p className='mt-3 max-w-56 text-xs leading-relaxed text-neutral-500'>
                {t('Your generated images will appear here.')}
              </p>
            </div>
          )}
        </div>
        <div className='studio-canvas-bottom'>
          <span>
            {props.reference
              ? t('Original image · preview only')
              : t('Start with a description. Give your ideas a shape.')}
          </span>
          {props.reference && (
            <Button
              variant='ghost'
              size='icon'
              className='size-11 shrink-0'
              aria-label={t('Enlarge reference image')}
              onClick={() => setExpanded(true)}
            >
              <Expand size={16} aria-hidden='true' />
            </Button>
          )}
        </div>
      </div>

      <div className='pt-6'>
        <div className='mb-3 flex flex-wrap items-baseline justify-between gap-2'>
          <h3 className='text-sm font-semibold'>{t('A little inspiration')}</h3>
          <span className='studio-caption'>
            {t('Choose a starting point, make it yours.')}
          </span>
        </div>
        <div className='grid gap-2 sm:grid-cols-3'>
          {inspirations.map((item) => (
            <Button
              key={item.title}
              variant='outline'
              className='h-auto min-h-16 justify-between gap-3 border-neutral-200 px-4 py-3 text-left whitespace-normal hover:bg-neutral-50'
              onClick={() => props.onInspiration(item.prompt)}
            >
              <span className='text-xs leading-relaxed'>{item.title}</span>
              <ArrowUpRight size={15} strokeWidth={1.5} aria-hidden='true' />
            </Button>
          ))}
        </div>
      </div>
      <Dialog
        open={expanded && !!props.reference}
        onOpenChange={setExpanded}
        title={t('Reference preview')}
        description={props.reference?.file.name}
        contentClassName='sm:max-w-4xl'
      >
        {props.reference && (
          <img
            src={props.reference.url}
            alt={t('Reference image')}
            className='max-h-[70dvh] w-full object-contain'
          />
        )}
      </Dialog>
    </section>
  )
}
