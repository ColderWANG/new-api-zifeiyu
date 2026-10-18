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
import {
  ArrowRight,
  ArrowRightLeft,
  Download,
  Languages,
  Loader2,
  Square,
  Sparkles,
} from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { CopyButton } from '@/components/copy-button'
import { EmptyState } from '@/components/empty-state'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
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
import { getUserModels } from '@/features/playground/api'
import { getSelf } from '@/lib/api'
import {
  getServerErrorMessage,
  isServerErrorCancelled,
  translateServerText,
} from '@/lib/server-error-message'
import { useAuthStore } from '@/stores/auth-store'

import { translateSource } from './api'
import { TranslationSourcePanel } from './components/source-panel'
import { exportTranslation, translationDownloadName } from './lib/export'
import { readTranslationFile, splitTranslationText } from './lib/source'
import {
  TRANSLATION_LANGUAGES,
  type TranslationLanguage,
  type TranslationMode,
  type TranslationSource,
  type TranslationStyle,
  type TranslationProgress,
} from './types'

import './studio.css'

const EMPTY_PROGRESS: TranslationProgress = { completed: 0, total: 0, text: '' }

export function TranslationStudio() {
  const user = useAuthStore((state) => state.auth.user)
  return <TranslationWorkspace key={`${user?.id}:${user?.group}`} />
}

function TranslationWorkspace() {
  const { t, i18n } = useTranslation()
  const user = useAuthStore((state) => state.auth.user)
  const group = user?.group ?? ''
  const queryClient = useQueryClient()
  const [mode, setMode] = useState<TranslationMode>('document')
  const [text, setText] = useState('')
  const [selectedModel, setSelectedModel] = useState('')
  const [sourceLanguage, setSourceLanguage] = useState<
    TranslationLanguage | 'auto'
  >('auto')
  const [targetLanguage, setTargetLanguage] =
    useState<TranslationLanguage>('zh-CN')
  const [style, setStyle] = useState<TranslationStyle>('natural')
  const [instructions, setInstructions] = useState('')
  const [source, setSource] = useState<TranslationSource | null>(null)
  const [fileName, setFileName] = useState('')
  const [preparing, setPreparing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState(EMPTY_PROGRESS)
  const [runState, setRunState] = useState<
    'idle' | 'running' | 'complete' | 'stopped' | 'error'
  >('idle')
  const parsing = useRef<AbortController | null>(null)
  const translating = useRef<AbortController | null>(null)
  const downloading = useRef<AbortController | null>(null)

  const modelsQuery = useQuery({
    queryKey: ['translation-studio-models', user?.id, group],
    queryFn: () => getUserModels(group),
    enabled: !!user?.id && !!group,
    meta: { errorToast: false },
  })
  const models = modelsQuery.data ?? []
  const model =
    models.find((item) => item.value === selectedModel)?.value ??
    models[0]?.value ??
    ''
  const disabled = busy || preparing || exporting
  const canTranslate =
    !!model &&
    !!group &&
    !disabled &&
    !modelsQuery.isError &&
    !modelsQuery.isFetching &&
    (mode === 'text' ? !!text.trim() : !!source?.units.length)

  useEffect(
    () => () => {
      parsing.current?.abort()
      translating.current?.abort()
      downloading.current?.abort()
    },
    []
  )

  function clearResult() {
    setProgress(EMPTY_PROGRESS)
    setRunState('idle')
    setError(null)
  }

  function removeFile() {
    parsing.current?.abort()
    parsing.current = null
    setPreparing(false)
    setSource(null)
    setFileName('')
    clearResult()
  }

  async function selectFile(file: File) {
    if (busy || exporting) return
    parsing.current?.abort()
    const controller = new AbortController()
    parsing.current = controller
    setSource(null)
    setFileName(file.name)
    setMode(/\.(png|jpe?g|webp)$/i.test(file.name) ? 'image' : 'document')
    setPreparing(true)
    clearResult()
    try {
      const next = await readTranslationFile(file, controller.signal)
      if (!controller.signal.aborted) setSource(next)
    } catch (cause) {
      if (!controller.signal.aborted) {
        setFileName('')
        const message = getServerErrorMessage(
          cause,
          'Unable to read this file.'
        )
        setError(i18n.exists(message) ? message : 'Unable to read this file.')
      }
    } finally {
      if (parsing.current === controller) {
        parsing.current = null
        setPreparing(false)
      }
    }
  }

  async function translate() {
    if (!canTranslate || translating.current) return
    const controller = new AbortController()
    translating.current = controller
    setBusy(true)
    setError(null)
    setRunState('running')
    setProgress(EMPTY_PROGRESS)
    try {
      const units =
        mode === 'text' ? splitTranslationText(text) : (source?.units ?? [])
      setProgress({ ...EMPTY_PROGRESS, total: units.length })
      await translateSource(
        {
          model,
          group,
          sourceLanguage,
          targetLanguage,
          style,
          instructions,
          units,
        },
        controller.signal,
        (next) => {
          if (!controller.signal.aborted) setProgress(next)
        }
      )
      if (!controller.signal.aborted) setRunState('complete')
    } catch (cause) {
      if (controller.signal.aborted || isServerErrorCancelled(cause)) {
        setRunState('stopped')
      } else {
        setRunState('error')
        setError(
          getServerErrorMessage(
            cause,
            t('Translation failed. Try another visible model.')
          )
        )
      }
    } finally {
      if (translating.current === controller) {
        translating.current = null
        setBusy(false)
      }
      if (
        !controller.signal.aborted &&
        useAuthStore.getState().auth.user?.id === user?.id
      ) {
        void queryClient.invalidateQueries({ queryKey: ['dashboard'] })
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
            /* The translation remains available if balance refresh fails. */
          })
      }
    }
  }

  async function download() {
    if (downloading.current) return
    const controller = new AbortController()
    downloading.current = controller
    setExporting(true)
    setError(null)
    try {
      const fileSource = mode === 'text' ? null : source
      const blob = await exportTranslation(
        fileSource,
        progress,
        targetLanguage,
        controller.signal
      )
      controller.signal.throwIfAborted()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = translationDownloadName(
        fileSource,
        targetLanguage,
        runState !== 'complete'
      )
      link.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (cause) {
      if (!controller.signal.aborted) {
        setError(
          getServerErrorMessage(
            cause,
            t('Unable to export the translation. Please try again.')
          )
        )
      }
    } finally {
      if (downloading.current === controller) {
        downloading.current = null
        setExporting(false)
      }
    }
  }

  const downloadFormat =
    mode === 'text' ? 'TXT' : (source?.format ?? 'txt').toUpperCase()
  const downloadLabel = t('Download {{format}}', { format: downloadFormat })
  const languageItems = Object.fromEntries(
    TRANSLATION_LANGUAGES.map((language) => [language.value, t(language.label)])
  )
  let statusText = t('Ready when you are')
  if (busy) {
    statusText = t('Translating {{completed}} / {{total}} sections', progress)
  } else if (runState === 'complete') statusText = t('Translation complete')
  else if (runState === 'stopped') {
    statusText = t('Stopped. Completed sections are retained.')
  } else if (runState === 'error' && progress.text) {
    statusText = t('Partial translation. Completed sections are retained.')
  }
  let modelHelp: ReactNode = t(
    'Only models available to your account are listed.'
  )
  if (modelsQuery.isError) {
    modelHelp = (
      <>
        {t('Unable to load your models.')}{' '}
        <Button variant='link' onClick={() => void modelsQuery.refetch()}>
          {t('Retry')}
        </Button>
      </>
    )
  } else if (!modelsQuery.isFetching && !models.length) {
    modelHelp = t('No models are available in your current group.')
  }
  let resultContent = (
    <EmptyState
      icon={Languages}
      title={t('Your translation appears here')}
      description={t(
        'Add your source on the left, choose a model and a target language, then start translating.'
      )}
      className='translation-empty'
    />
  )
  if (progress.text) {
    resultContent = (
      <pre
        className='translation-result-text'
        aria-label={t('Translated text')}
        lang={targetLanguage}
        dir={targetLanguage === 'ar' ? 'rtl' : 'auto'}
      >
        {progress.text}
      </pre>
    )
  } else if (busy) {
    resultContent = (
      <div className='translation-reading'>
        <Loader2 className='animate-spin' aria-hidden='true' />
        <p>{t('Your model is translating the first section...')}</p>
      </div>
    )
  }

  return (
    <div className='translation-studio'>
      <header className='translation-heading'>
        <div>
          <p className='translation-eyebrow'>{t('Translation workspace')}</p>
          <h1 className='font-serif text-4xl font-medium tracking-tight sm:text-5xl'>
            {t('Translation Studio')}
          </h1>
          <p className='translation-subtitle'>
            {t(
              'Translate text, images and documents with the models available to your account.'
            )}
          </p>
        </div>
        <div className='translation-group'>
          <Languages size={16} aria-hidden='true' />
          <span>{group || '—'}</span>
          <span>{t('Your models, your workspace')}</span>
        </div>
      </header>

      <section
        className='translation-settings'
        aria-label={t('Translation settings')}
      >
        <div className='translation-model-field'>
          <Label htmlFor='translation-model'>{t('Model')}</Label>
          <Combobox
            id='translation-model'
            aria-label={t('Translation model')}
            aria-describedby='translation-model-help'
            options={models}
            value={model}
            onValueChange={(value) => {
              if (value) {
                setSelectedModel(value)
                clearResult()
              }
            }}
            disabled={
              disabled ||
              modelsQuery.isFetching ||
              modelsQuery.isError ||
              !models.length
            }
            placeholder={
              modelsQuery.isFetching
                ? t('Loading models...')
                : t('Choose a visible model')
            }
          />
          <p id='translation-model-help' className='translation-caption'>
            {modelHelp}
          </p>
        </div>
        <div className='translation-language-pair'>
          <div className='space-y-2'>
            <Label htmlFor='translation-source-language'>
              {t('Source language')}
            </Label>
            <Select
              items={{ auto: t('Detect language'), ...languageItems }}
              value={sourceLanguage}
              disabled={disabled}
              onValueChange={(value) => {
                if (value) {
                  setSourceLanguage(value as TranslationLanguage | 'auto')
                  clearResult()
                }
              }}
            >
              <SelectTrigger
                id='translation-source-language'
                className='w-full'
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent
                alignItemWithTrigger={false}
                className='max-w-[calc(100vw-1.5rem)] min-w-56'
              >
                <SelectItem value='auto'>{t('Detect language')}</SelectItem>
                {TRANSLATION_LANGUAGES.map((language) => (
                  <SelectItem key={language.value} value={language.value}>
                    {t(language.label)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            variant='ghost'
            size='icon'
            className='translation-swap'
            aria-label={t('Swap languages')}
            disabled={disabled || sourceLanguage === 'auto'}
            onClick={() => {
              if (sourceLanguage === 'auto') return
              setSourceLanguage(targetLanguage)
              setTargetLanguage(sourceLanguage)
              clearResult()
            }}
          >
            <ArrowRightLeft size={16} aria-hidden='true' />
          </Button>
          <div className='space-y-2'>
            <Label htmlFor='translation-target-language'>
              {t('Target language')}
            </Label>
            <Select
              items={languageItems}
              value={targetLanguage}
              disabled={disabled}
              onValueChange={(value) => {
                if (value) {
                  setTargetLanguage(value as TranslationLanguage)
                  clearResult()
                }
              }}
            >
              <SelectTrigger
                id='translation-target-language'
                className='w-full'
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent
                alignItemWithTrigger={false}
                className='max-w-[calc(100vw-1.5rem)] min-w-56'
              >
                {TRANSLATION_LANGUAGES.map((language) => (
                  <SelectItem key={language.value} value={language.value}>
                    {t(language.label)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className='space-y-2'>
          <Label htmlFor='translation-style'>{t('Translation style')}</Label>
          <Select
            items={{
              natural: t('Natural'),
              faithful: t('Faithful'),
              professional: t('Professional'),
            }}
            value={style}
            disabled={disabled}
            onValueChange={(value) => {
              if (value) {
                setStyle(value as TranslationStyle)
                clearResult()
              }
            }}
          >
            <SelectTrigger id='translation-style' className='w-full'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent
              alignItemWithTrigger={false}
              className='max-w-[calc(100vw-1.5rem)] min-w-56'
            >
              <SelectItem value='natural'>{t('Natural')}</SelectItem>
              <SelectItem value='faithful'>{t('Faithful')}</SelectItem>
              <SelectItem value='professional'>{t('Professional')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </section>

      <div className='translation-workspace'>
        <TranslationSourcePanel
          mode={mode}
          onModeChange={(next) => {
            removeFile()
            setMode(next)
          }}
          text={text}
          onTextChange={(value) => {
            setText(value)
            clearResult()
          }}
          source={source}
          fileName={fileName}
          preparing={preparing}
          busy={busy || exporting}
          onFile={(file) => void selectFile(file)}
          onRemove={removeFile}
        />
        <section
          className='translation-panel translation-result'
          aria-labelledby='translation-result-title'
          aria-busy={busy}
        >
          <div className='translation-panel-heading'>
            <h2 id='translation-result-title'>{t('Translation result')}</h2>
            <span>{languageItems[targetLanguage]}</span>
          </div>
          {resultContent}
          <div className='translation-result-footer'>
            <p role='status' aria-live='polite'>
              {statusText}
            </p>
            {progress.completed > 0 && (
              <div className='flex shrink-0 gap-1'>
                <CopyButton
                  value={progress.text}
                  aria-label={t('Copy translation')}
                />
                <Button
                  variant='ghost'
                  size='sm'
                  onClick={() => void download()}
                  disabled={busy || exporting}
                  aria-label={downloadLabel}
                >
                  {exporting ? (
                    <Loader2
                      size={16}
                      className='animate-spin'
                      aria-hidden='true'
                    />
                  ) : (
                    <Download size={16} aria-hidden='true' />
                  )}
                  {downloadLabel}
                </Button>
              </div>
            )}
          </div>
          {progress.completed > 0 &&
            runState !== 'complete' &&
            !busy &&
            mode !== 'text' &&
            (source?.docx || source?.renderedPages) && (
              <p className='translation-caption px-5 pb-3'>
                {t(
                  source?.docx
                    ? 'Partial file: untranslated sections remain in the original language.'
                    : 'Partial file: only completed translations are included.'
                )}
              </p>
            )}
          {busy && progress.total > 0 && (
            <progress
              className='translation-progress'
              aria-label={t('Translation progress')}
              value={progress.completed}
              max={progress.total}
            />
          )}
        </section>
      </div>

      {error && (
        <Alert variant='destructive' className='mt-4' role='alert'>
          <AlertTitle>{t('Translation needs your attention')}</AlertTitle>
          <AlertDescription>{translateServerText(t, error)}</AlertDescription>
        </Alert>
      )}
      <div className='translation-bottom'>
        <details className='translation-preferences'>
          <summary>
            <Sparkles size={14} aria-hidden='true' />
            {t('Terminology and preferences')}
          </summary>
          <Label htmlFor='translation-instructions' className='sr-only'>
            {t('Translation preferences')}
          </Label>
          <Textarea
            id='translation-instructions'
            maxLength={1500}
            value={instructions}
            readOnly={busy}
            onChange={(event) => {
              setInstructions(event.target.value)
              clearResult()
            }}
            placeholder={t(
              'For example: keep product names in English; keep API terminology consistent; use a formal tone.'
            )}
          />
        </details>
        <div className='translation-submit'>
          <p>
            {t(
              'Image and scanned PDF translation requires a model that can read images.'
            )}
          </p>
          {busy ? (
            <Button
              onClick={() => translating.current?.abort()}
              variant='outline'
              className='translation-run'
            >
              <Square size={14} aria-hidden='true' />
              {t('Stop translation')}
            </Button>
          ) : (
            <Button
              onClick={() => void translate()}
              disabled={!canTranslate}
              className='translation-run'
            >
              {t('Translate')}
              <ArrowRight size={16} aria-hidden='true' />
            </Button>
          )}
        </div>
      </div>
      <p className='translation-disclaimer'>
        {t(
          'Downloads keep the uploaded file format. PDF and images are rebuilt with a clean translation layout, without the original background or illustrations. PDF text can be selected and copied; long translations continue on new pages. DOCX retains its document structure. PDF input: up to 20 pages. Translation uses your account quota at the selected model rates.'
        )}
      </p>
    </div>
  )
}
