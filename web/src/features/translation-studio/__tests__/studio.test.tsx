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
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  act,
  cleanup,
  render,
  renderHook,
  screen,
  waitFor,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18next from 'i18next'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useSidebarData } from '@/hooks/use-sidebar-data'
import en from '@/i18n/locales/en.json'
import fr from '@/i18n/locales/fr.json'
import ja from '@/i18n/locales/ja.json'
import ru from '@/i18n/locales/ru.json'
import viLocale from '@/i18n/locales/vi.json'
import zhTW from '@/i18n/locales/zh-TW.json'
import zh from '@/i18n/locales/zh.json'
import { api } from '@/lib/api'
import { useAuthStore } from '@/stores/auth-store'

import { TranslationStudio } from '..'
import { translateSource } from '../api'
import type { TranslationOptions } from '../types'

let client: QueryClient
const user = {
  id: 21,
  username: 'translator',
  role: 1,
  group: 'translation-team',
}
const options: TranslationOptions = {
  model: 'visible-model',
  group: user.group,
  sourceLanguage: 'auto',
  targetLanguage: 'zh-CN',
  style: 'natural',
  instructions: '',
  units: [{ text: 'Invoice 42' }],
}
const completion = (content: string, reason = 'stop') => ({
  data: {
    choices: [
      { message: { role: 'assistant', content }, finish_reason: reason },
    ],
  },
})

beforeEach(() => {
  client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })
  useAuthStore.getState().auth.setUser(user)
  useAuthStore.setState((state) => ({
    auth: {
      ...state.auth,
      accessToken: 'test-session',
      accessExpiresAt: Math.floor(Date.now() / 1000) + 3600,
    },
  }))
  vi.spyOn(api, 'get').mockImplementation(async (url) => ({
    data: {
      success: true,
      data:
        url === '/api/user/models'
          ? ['visible-model', 'visible-image-model']
          : user,
    },
  }))
  vi.spyOn(api, 'post').mockResolvedValue(completion('Translated invoice 42'))
})
afterEach(async () => {
  cleanup()
  await i18next.changeLanguage('en')
  client.clear()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

function renderStudio() {
  return render(
    <QueryClientProvider client={client}>
      <TranslationStudio />
    </QueryClientProvider>
  )
}

describe('Translation Studio', () => {
  it.each(Object.entries({ en, zhCN: zh, zhTW, fr, ru, ja, vi: viLocale }))(
    'renders controls, guidance and file errors in interface language %s',
    async (language, locale) => {
      i18next.addResourceBundle(
        language,
        'translation',
        locale.translation,
        true,
        true
      )
      await act(async () => {
        await i18next.changeLanguage(language)
      })
      renderStudio()
      const copy = locale.translation
      expect(
        screen.getByRole('heading', { name: copy['Translation Studio'] })
      ).toBeVisible()
      expect(
        screen.getByText(
          copy[
            'Files are read locally and sent to the selected model only when you translate.'
          ]
        )
      ).toBeVisible()
      await waitFor(() =>
        expect(
          screen.getByRole('combobox', { name: copy['Translation model'] })
        ).toHaveValue('visible-model')
      )
      const file = new File(['test'], 'oversized.pdf', {
        type: 'application/pdf',
      })
      Object.defineProperty(file, 'size', { value: 11 * 1024 * 1024 })
      await userEvent.upload(
        screen.getByLabelText(copy['Upload translation source']),
        file
      )
      expect(await screen.findByRole('alert')).toHaveTextContent(
        copy['Choose a file smaller than 10 MB.']
      )
      expect(api.post).not.toHaveBeenCalled()
    }
  )

  it('lists account-visible models and translates through the existing group-scoped playground route', async () => {
    renderStudio()
    await waitFor(() =>
      expect(
        screen.getByRole('combobox', { name: 'Translation model' })
      ).toHaveValue('visible-model')
    )
    expect(api.get).toHaveBeenCalledWith('/api/user/models', {
      params: { group: 'translation-team' },
    })
    const actor = userEvent.setup()
    await actor.click(screen.getByRole('button', { name: 'Text' }))
    await actor.type(
      screen.getByRole('textbox', { name: 'Text to translate' }),
      'Invoice 42'
    )
    await actor.click(screen.getByRole('button', { name: 'Translate' }))
    expect(await screen.findByLabelText('Translated text')).toHaveTextContent(
      'Translated invoice 42'
    )
    expect(api.post).toHaveBeenCalledWith(
      '/pg/chat/completions',
      expect.objectContaining({
        model: 'visible-model',
        group: 'translation-team',
      }),
      expect.objectContaining({
        skipAuthRefresh: true,
        signal: expect.any(AbortSignal),
      })
    )
    expect(
      screen.getByRole('button', { name: 'Download translation' })
    ).toBeEnabled()
  })

  it('shows an empty account state and cannot submit without an available model', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { success: true, data: [] } })
    renderStudio()
    expect(
      await screen.findByText('No models are available in your current group.')
    ).toBeVisible()
    expect(screen.getByRole('button', { name: 'Translate' })).toBeDisabled()
  })

  it('aborts a running translation when the user stops it without resubmitting', async () => {
    vi.mocked(api.post).mockImplementation(
      (_url, _body, config) =>
        new Promise((_resolve, reject) => {
          config?.signal?.addEventListener?.('abort', () =>
            reject(new DOMException('Aborted', 'AbortError'))
          )
        })
    )
    renderStudio()
    await waitFor(() =>
      expect(
        screen.getByRole('combobox', { name: 'Translation model' })
      ).toHaveValue('visible-model')
    )
    const actor = userEvent.setup()
    await actor.click(screen.getByRole('button', { name: 'Text' }))
    await actor.type(screen.getByLabelText('Text to translate'), 'Hello')
    await actor.click(screen.getByRole('button', { name: 'Translate' }))
    await screen.findByRole('button', { name: 'Stop translation' })
    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1))
    await actor.click(screen.getByRole('button', { name: 'Stop translation' }))
    expect(
      await screen.findByText('Stopped. Completed sections are retained.')
    ).toBeVisible()
    expect(api.post).toHaveBeenCalledTimes(1)
  })

  it('clears private source and results when the account changes', async () => {
    renderStudio()
    await waitFor(() =>
      expect(
        screen.getByRole('combobox', { name: 'Translation model' })
      ).toHaveValue('visible-model')
    )
    const actor = userEvent.setup()
    await actor.click(screen.getByRole('button', { name: 'Text' }))
    await actor.type(
      screen.getByLabelText('Text to translate'),
      'private source'
    )
    act(() => useAuthStore.getState().auth.setUser({ ...user, id: 22 }))
    await actor.click(screen.getByRole('button', { name: 'Text' }))
    expect(screen.getByLabelText('Text to translate')).toHaveValue('')
  })

  it('localizes file validation failures without sending a model request', async () => {
    i18next.addResourceBundle('zh', 'translation', zh.translation, true, true)
    await act(async () => {
      await i18next.changeLanguage('zh')
    })
    renderStudio()
    const file = new File(['test'], 'oversized.pdf', {
      type: 'application/pdf',
    })
    Object.defineProperty(file, 'size', { value: 11 * 1024 * 1024 })
    await userEvent.upload(
      screen.getByLabelText(zh.translation['Upload translation source']),
      file
    )
    expect(await screen.findByRole('alert')).toHaveTextContent(
      zh.translation['Choose a file smaller than 10 MB.']
    )
    expect(api.post).not.toHaveBeenCalled()
  })

  it('shows a localized file error when the browser decoder returns an unknown message', async () => {
    i18next.addResourceBundle('fr', 'translation', fr.translation, true, true)
    await act(async () => {
      await i18next.changeLanguage('fr')
    })
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn().mockRejectedValue(new Error('decoder-internal-details'))
    )
    renderStudio()
    const actor = userEvent.setup()
    await actor.click(
      screen.getByRole('button', { name: fr.translation.Image })
    )
    const bytes = new Uint8Array([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ])
    const file = new File([bytes], 'broken.png', { type: 'image/png' })
    Object.defineProperty(file, 'arrayBuffer', {
      value: async () => bytes.buffer,
    })
    await actor.upload(
      screen.getByLabelText(fr.translation['Upload translation source']),
      file
    )
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(fr.translation['Unable to read this file.'])
    expect(alert).not.toHaveTextContent('decoder-internal-details')
    expect(api.post).not.toHaveBeenCalled()
  })

  it('uses right-to-left text flow when translating into Arabic', async () => {
    vi.mocked(api.post).mockResolvedValue(completion('فاتورة 42'))
    renderStudio()
    await waitFor(() =>
      expect(
        screen.getByRole('combobox', { name: 'Translation model' })
      ).toHaveValue('visible-model')
    )
    const actor = userEvent.setup()
    await actor.click(screen.getByRole('combobox', { name: 'Target language' }))
    await actor.click(screen.getByRole('option', { name: 'Arabic' }))
    await actor.click(screen.getByRole('button', { name: 'Text' }))
    await actor.type(screen.getByLabelText('Text to translate'), 'Invoice 42')
    await actor.click(screen.getByRole('button', { name: 'Translate' }))
    const result = await screen.findByLabelText('Translated text')
    expect(result).toHaveTextContent('فاتورة 42')
    expect(result).toHaveAttribute('lang', 'ar')
    expect(result).toHaveAttribute('dir', 'rtl')
  })

  it('places the independent Translation Studio immediately after Image Studio', () => {
    const { result } = renderHook(() => useSidebarData())
    const items =
      result.current.navGroups.find((group) => group.id === 'chat')?.items ?? []
    expect(items.slice(0, 3).map((item) => item.title)).toEqual([
      'Playground',
      'Image Studio',
      'Translation Studio',
    ])
    expect(items[2]).toMatchObject({ url: '/translation-studio' })
  })
})

describe('translation requests', () => {
  it('preserves completed sections when a later model response fails', async () => {
    vi.mocked(api.post)
      .mockResolvedValueOnce(completion('First translated section'))
      .mockRejectedValueOnce(new Error('Upstream unavailable'))
    const progress = vi.fn()
    await expect(
      translateSource(
        { ...options, units: [{ text: 'one' }, { text: 'two' }] },
        new AbortController().signal,
        progress
      )
    ).rejects.toThrow('Upstream unavailable')
    expect(progress).toHaveBeenCalledWith({
      completed: 1,
      total: 2,
      text: 'First translated section',
    })
    expect(api.post).toHaveBeenCalledTimes(2)
  })

  it('does not mark a truncated response as a complete translation', async () => {
    vi.mocked(api.post).mockResolvedValue(completion('Incomplete', 'length'))
    const progress = vi.fn()
    await expect(
      translateSource(options, new AbortController().signal, progress)
    ).rejects.toThrow('output limit')
    expect(progress).not.toHaveBeenCalled()
  })

  it('sends image data only in the explicit translation request', async () => {
    await translateSource(
      { ...options, units: [{ image: 'data:image/png;base64,AAAA' }] },
      new AbortController().signal,
      vi.fn()
    )
    expect(api.post).toHaveBeenCalledWith(
      '/pg/chat/completions',
      expect.objectContaining({
        messages: [
          expect.objectContaining({ role: 'system' }),
          expect.objectContaining({
            content: [
              expect.anything(),
              {
                type: 'image_url',
                image_url: { url: 'data:image/png;base64,AAAA' },
              },
            ],
          }),
        ],
      }),
      expect.anything()
    )
  })
})
