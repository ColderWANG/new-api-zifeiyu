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

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Aperture } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { getUserModels } from '@/features/playground/api'
import { getSelf } from '@/lib/api'
import { useAuthStore } from '@/stores/auth-store'

import { generateStudioImages, type GenerateImageInput } from './api'
import { StudioCanvas } from './components/studio-canvas'
import { StudioControls } from './components/studio-controls'
import { StudioResults } from './components/studio-results'
import type {
  ReferenceImage,
  StudioMode,
  StudioRatio,
  StudioProtocol,
  StudioImage,
} from './types'

import './studio.css'

export function ImageStudio() {
  const userId = useAuthStore((state) => state.auth.user?.id)
  // Reset transient prompts and reference files when the signed-in account changes.
  return <ImageStudioWorkspace key={userId} />
}

function ImageStudioWorkspace() {
  const { t } = useTranslation()
  const user = useAuthStore((state) => state.auth.user)
  const group = user?.group ?? ''
  const [mode, setMode] = useState<StudioMode>('text')
  const [selectedModel, setSelectedModel] = useState('')
  const [prompt, setPrompt] = useState('')
  const [ratio, setRatio] = useState<StudioRatio>('1:1')
  const [count, setCount] = useState('1')
  const [reference, setReference] = useState<ReferenceImage | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [protocolOverride, setProtocolOverride] =
    useState<StudioProtocol | null>(null)
  const [images, setImages] = useState<StudioImage[]>([])
  const activeRequest = useRef<AbortController | null>(null)
  const queryClient = useQueryClient()
  useEffect(
    () => () => {
      activeRequest.current?.abort()
    },
    []
  )
  const generation = useMutation({
    mutationFn: async (input: GenerateImageInput) => {
      const controller = new AbortController()
      activeRequest.current = controller
      const result = await generateStudioImages(input, controller.signal)
      if (controller.signal.aborted) {
        throw new DOMException('Aborted', 'AbortError')
      }
      return result
    },
    retry: false,
    meta: { errorToast: false },
    onSuccess: (result) => {
      if (activeRequest.current?.signal.aborted) return
      setImages(result)
      void getSelf()
        .then((response) => {
          const auth = useAuthStore.getState().auth
          if (
            response.success &&
            response.data?.id === user?.id &&
            auth.user?.id === user?.id
          ) {
            auth.setUser(response.data)
          }
        })
        .catch(() => {
          /* A failed balance refresh must not discard generated images. */
        })
    },
    onSettled: () => {
      activeRequest.current = null
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })

  const modelsQuery = useQuery({
    queryKey: ['image-studio-models', user?.id, group],
    queryFn: () => getUserModels(group),
    enabled: !!user?.id && !!group,
    select: (models) =>
      models.filter((model) => model.value.toLowerCase().includes('image')),
    meta: { errorToast: false },
  })
  const models = modelsQuery.data ?? []
  const model =
    models.find((item) => item.value === selectedModel)?.value ??
    models[0]?.value ??
    ''
  const protocol =
    protocolOverride ??
    (model.toLowerCase().includes('gemini') ? 'chat' : 'images')
  const effectiveRatio =
    protocol === 'images' &&
    model.toLowerCase().includes('gpt-image') &&
    ratio === '16:9'
      ? '1:1'
      : ratio
  const effectiveCount = protocol === 'chat' ? '1' : count
  const canGenerate =
    !!model &&
    !!prompt.trim() &&
    !modelsQuery.isError &&
    !modelsQuery.isFetching &&
    (mode === 'text' || !!reference)

  function generate() {
    if (!canGenerate || generation.isPending || activeRequest.current) return
    generation.mutate({
      model,
      protocol,
      prompt: prompt.trim(),
      ratio: effectiveRatio,
      count: Number(effectiveCount),
      reference: mode === 'image' ? reference?.file : undefined,
    })
  }

  useEffect(() => {
    const url = reference?.url
    return () => {
      if (url) URL.revokeObjectURL(url)
    }
  }, [reference?.url])

  function selectReference(file: File) {
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      setUploadError('Please choose a PNG, JPG or WebP image.')
      return
    }
    if (file.size === 0 || file.size > 10 * 1024 * 1024) {
      setUploadError('Choose a non-empty image smaller than 10 MB.')
      return
    }
    setUploadError(null)
    setReference({ file, url: URL.createObjectURL(file) })
  }

  return (
    <div className='image-studio'>
      <header className='studio-heading'>
        <div>
          <div className='mb-3 flex items-center gap-2 text-xs font-medium text-neutral-500'>
            <Aperture size={16} strokeWidth={1.5} aria-hidden='true' />
            <span>{t('A workspace for visual ideas')}</span>
          </div>
          <h1 className='font-serif text-4xl font-medium tracking-tight sm:text-5xl'>
            {t('Image Studio')}
          </h1>
          <p className='mt-3 text-sm leading-relaxed text-neutral-500'>
            {t('From a few words to a new perspective.')}
          </p>
        </div>
        <span className='studio-preview-badge'>{t('Image creation')}</span>
      </header>
      <div className='studio-workspace'>
        <StudioControls
          protocol={protocol}
          onProtocolChange={setProtocolOverride}
          generating={generation.isPending}
          canGenerate={canGenerate}
          onGenerate={generate}
          group={group}
          models={models}
          model={model}
          loading={modelsQuery.isLoading}
          failed={modelsQuery.isError}
          onRetry={() => {
            void modelsQuery.refetch()
          }}
          onModelChange={(value) => {
            setSelectedModel(value)
            setProtocolOverride(null)
          }}
          mode={mode}
          onModeChange={setMode}
          prompt={prompt}
          onPromptChange={setPrompt}
          ratio={effectiveRatio}
          onRatioChange={setRatio}
          count={effectiveCount}
          onCountChange={setCount}
          reference={reference}
          uploadError={uploadError}
          onReferenceChange={selectReference}
          onReferenceRemove={() => {
            setReference(null)
            setUploadError(null)
          }}
        />
        {generation.isPending || generation.isError || images.length > 0 ? (
          <StudioResults
            images={images}
            generating={generation.isPending}
            error={generation.isError ? generation.error : null}
          />
        ) : (
          <StudioCanvas
            ratio={effectiveRatio}
            count={effectiveCount}
            reference={mode === 'image' ? reference : null}
            onImageError={() => {
              setReference(null)
              setUploadError(
                'This image could not be opened. Please choose another file.'
              )
            }}
            onInspiration={(value) => {
              setPrompt(value)
              document
                .querySelector<HTMLTextAreaElement>('#studio-prompt')
                ?.focus()
            }}
          />
        )}
      </div>
    </div>
  )
}
