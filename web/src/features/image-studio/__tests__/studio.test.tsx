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
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18next from 'i18next'
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

import { useSidebarData } from '@/hooks/use-sidebar-data'
import zh from '@/i18n/locales/zh.json'
import { api } from '@/lib/api'
import { useAuthStore } from '@/stores/auth-store'

import { ImageStudio } from '..'
import { generateStudioImages, parseStudioImages } from '../api'

let client: QueryClient
const revokeObjectURL = vi.fn()
const createObjectURL = vi.fn(() => 'blob:studio-reference')
const getAnimationsDescriptor = Object.getOwnPropertyDescriptor(
  HTMLElement.prototype,
  'getAnimations'
)

beforeAll(() => {
  // jsdom lacks the browser animation API used by the shared ScrollArea.
  Object.defineProperty(HTMLElement.prototype, 'getAnimations', {
    configurable: true,
    value: () => [],
  })
})

afterAll(() => {
  if (getAnimationsDescriptor) {
    Object.defineProperty(
      HTMLElement.prototype,
      'getAnimations',
      getAnimationsDescriptor
    )
  } else {
    Reflect.deleteProperty(HTMLElement.prototype, 'getAnimations')
  }
})

beforeEach(() => {
  client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })
  useAuthStore
    .getState()
    .auth.setUser({ id: 21, username: 'artist', role: 1, group: 'studio-team' })
  useAuthStore.setState((state) => ({
    auth: {
      ...state.auth,
      accessToken: 'test-session',
      accessExpiresAt: Math.floor(Date.now() / 1000) + 3600,
    },
  }))
  vi.spyOn(api, 'get').mockResolvedValue({
    data: {
      success: true,
      data: ['gpt-image-1', 'IMAGE-editor', 'text-model'],
    },
  })
  vi.spyOn(api, 'post')
  vi.stubGlobal(
    'URL',
    class extends URL {
      static createObjectURL = createObjectURL
      static revokeObjectURL = revokeObjectURL
    }
  )
})

afterEach(async () => {
  client.clear()
  useAuthStore.getState().auth.reset()
  vi.unstubAllGlobals()
  await i18next.changeLanguage('en')
})

function renderStudio() {
  return render(
    <QueryClientProvider client={client}>
      <ImageStudio />
    </QueryClientProvider>
  )
}

describe('image studio generation', () => {
  it('submits once, shows progress, then displays an image with preview and download actions', async () => {
    let finish!: (value: unknown) => void
    vi.mocked(api.post).mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve
        })
    )
    renderStudio()
    await waitFor(() =>
      expect(screen.getByRole('combobox', { name: 'Model' })).toHaveValue(
        'gpt-image-1'
      )
    )
    fireEvent.change(screen.getByLabelText('Describe your image'), {
      target: { value: 'A quiet landscape' },
    })
    await userEvent.click(
      screen.getByRole('button', { name: 'Generate image' })
    )
    expect(screen.getByRole('status')).toHaveTextContent('Generating images')
    expect(
      screen.getByRole('button', { name: 'Generating images…' })
    ).toBeDisabled()
    expect(api.post).toHaveBeenCalledTimes(1)
    expect(api.post).toHaveBeenCalledWith(
      '/pg/image-studio',
      expect.objectContaining({
        model: 'gpt-image-1',
        protocol: 'images',
        prompt: 'A quiet landscape',
        n: 1,
        size: '1024x1024',
      }),
      expect.objectContaining({ skipAuthRefresh: true })
    )
    await act(async () =>
      finish({ data: { data: [{ b64_json: 'aGVsbG8=' }] } })
    )
    expect(
      await screen.findByRole('img', { name: 'Generated image 1' })
    ).toHaveAttribute('src', 'data:image/png;base64,aGVsbG8=')
    expect(screen.getByRole('button', { name: 'Download image' })).toBeEnabled()
    await userEvent.click(screen.getByRole('button', { name: 'Enlarge image' }))
    expect(
      await screen.findByRole('dialog', { name: 'Generated images' })
    ).toBeVisible()
  })

  it('does not retry failed billable requests automatically, preserves the prompt and supports explicit retry', async () => {
    vi.mocked(api.post)
      .mockRejectedValueOnce(new Error('Provider unavailable'))
      .mockResolvedValueOnce({
        data: { choices: [{ message: { content: 'No image returned' } }] },
      })
    renderStudio()
    await waitFor(() =>
      expect(screen.getByRole('combobox', { name: 'Model' })).toHaveValue(
        'gpt-image-1'
      )
    )
    fireEvent.change(screen.getByLabelText('Describe your image'), {
      target: { value: 'Keep my prompt' },
    })
    await userEvent.click(
      screen.getByRole('button', { name: 'Generate image' })
    )
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Provider unavailable'
    )
    expect(screen.getByLabelText('Describe your image')).toHaveValue(
      'Keep my prompt'
    )
    expect(api.post).toHaveBeenCalledTimes(1)
    await userEvent.click(
      screen.getByRole('button', { name: 'Generate image' })
    )
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The model returned text instead of an image.'
    )
    expect(screen.getByRole('alert')).toHaveTextContent('No image returned')
    expect(api.post).toHaveBeenCalledTimes(2)
  })

  it.each([
    {
      label: 'explicit refusal',
      data: {
        choices: [{ message: { refusal: 'Cannot fulfill this request.' } }],
      },
      message: 'The model declined or blocked image generation.',
    },
    {
      label: 'unreadable image data',
      data: { data: [{ b64_json: 'not valid base64!' }] },
      message: 'Image data was returned, but its format could not be read.',
    },
    {
      label: 'empty response',
      data: {
        choices: [{ message: { content: null }, finish_reason: 'stop' }],
      },
      message: 'The model returned no image or explanation.',
    },
  ])(
    'shows an accurate error for $label without retrying',
    async ({ data, message }) => {
      vi.mocked(api.post).mockResolvedValue({ data })
      renderStudio()
      await waitFor(() =>
        expect(screen.getByRole('combobox', { name: 'Model' })).toHaveValue(
          'gpt-image-1'
        )
      )
      fireEvent.change(screen.getByLabelText('Describe your image'), {
        target: { value: 'A quiet landscape' },
      })
      await userEvent.click(
        screen.getByRole('button', { name: 'Generate image' })
      )
      expect(await screen.findByRole('alert')).toHaveTextContent(message)
      expect(screen.getByRole('alert')).not.toHaveTextContent(
        'Check the selected protocol'
      )
      expect(api.post).toHaveBeenCalledTimes(1)
    }
  )

  it('shows a bounded plain-text reply and request ID, translating the error after language changes', async () => {
    vi.mocked(api.post).mockResolvedValue({
      headers: { 'x-oneapi-request-id': 'studio-request-123' },
      data: {
        choices: [
          {
            message: {
              content: `<img src=x onerror=alert(1)> I can describe the scene. ${'detail '.repeat(500)}`,
            },
          },
        ],
      },
    })
    renderStudio()
    await waitFor(() =>
      expect(screen.getByRole('combobox', { name: 'Model' })).toHaveValue(
        'gpt-image-1'
      )
    )
    fireEvent.change(screen.getByLabelText('Describe your image'), {
      target: { value: 'A quiet landscape' },
    })
    await userEvent.click(
      screen.getByRole('button', { name: 'Generate image' })
    )
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Model reply (excerpt)')
    expect(
      within(alert).getByRole('region', { name: 'Model reply (excerpt)' })
    ).toBeVisible()
    expect(alert).toHaveTextContent('I can describe the scene.')
    expect(alert.textContent?.length).toBeLessThan(1600)
    expect(alert.querySelector('img')).toBeNull()
    expect(
      within(alert).getByRole('button', { name: 'Copy request ID' })
    ).toBeVisible()
    expect(alert).toHaveTextContent('studio-request-123')
    i18next.addResourceBundle('zh', 'translation', zh.translation, true, true)
    await act(async () => {
      await i18next.changeLanguage('zh')
    })
    expect(alert).toHaveTextContent('模型返回内容（摘要）')
    expect(alert).toHaveTextContent('模型只返回了文字，没有返回图片。')
    expect(alert).toHaveTextContent('I can describe the scene.')
    expect(alert).not.toHaveTextContent('Image data was returned')
  })

  it('uploads the actual reference only when generation is requested', async () => {
    vi.mocked(api.post).mockResolvedValue({
      data: { data: [{ url: 'https://images.example.test/result.png' }] },
    })
    renderStudio()
    await waitFor(() =>
      expect(screen.getByRole('combobox', { name: 'Model' })).toHaveValue(
        'gpt-image-1'
      )
    )
    await userEvent.click(
      screen.getByRole('button', { name: 'Image to image' })
    )
    const file = new File(['photo'], 'reference.png', { type: 'image/png' })
    fireEvent.change(
      screen.getByLabelText('Reference image', { selector: 'input' }),
      { target: { files: [file] } }
    )
    fireEvent.change(screen.getByLabelText('Describe your image'), {
      target: { value: 'Change the light' },
    })
    expect(api.post).not.toHaveBeenCalled()
    await userEvent.click(
      screen.getByRole('button', { name: 'Generate image' })
    )
    await screen.findByRole('img', { name: 'Generated image 1' })
    const body = vi.mocked(api.post).mock.calls[0][1] as FormData
    expect(body.get('image')).toBe(file)
    expect(body.get('prompt')).toBe('Change the light')
    expect(body.get('n')).toBe('1')
  })

  it('selects the Gemini chat protocol by default and restricts it to one image', async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: { success: true, data: ['gemini-image-test'] },
    })
    vi.mocked(api.post).mockResolvedValue({
      data: {
        choices: [
          { message: { content: '![image](data:image/png;base64,aGVsbG8=)' } },
        ],
      },
    })
    renderStudio()
    await waitFor(() =>
      expect(screen.getByRole('combobox', { name: 'Model' })).toHaveValue(
        'gemini-image-test'
      )
    )
    expect(
      screen.getByRole('combobox', { name: 'Generation protocol' })
    ).toHaveTextContent('Chat API')
    expect(
      screen.getByRole('combobox', { name: 'Number of images' })
    ).toBeDisabled()
    await userEvent.click(screen.getByRole('button', { name: '16:9' }))
    fireEvent.change(screen.getByLabelText('Describe your image'), {
      target: { value: 'A landscape' },
    })
    await userEvent.click(
      screen.getByRole('button', { name: 'Generate image' })
    )
    await screen.findByRole('img', { name: 'Generated image 1' })
    expect(api.post).toHaveBeenCalledWith(
      '/pg/image-studio',
      expect.objectContaining({ protocol: 'chat', n: 1, aspect_ratio: '16:9' }),
      expect.anything()
    )
  })

  it('aborts an in-flight request on account change and does not expose the old results', async () => {
    let finish!: (value: unknown) => void
    vi.mocked(api.post).mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve
        })
    )
    renderStudio()
    await waitFor(() =>
      expect(screen.getByRole('combobox', { name: 'Model' })).toHaveValue(
        'gpt-image-1'
      )
    )
    fireEvent.change(screen.getByLabelText('Describe your image'), {
      target: { value: 'Private prompt' },
    })
    await userEvent.click(
      screen.getByRole('button', { name: 'Generate image' })
    )
    const signal = vi.mocked(api.post).mock.calls[0][2]?.signal
    act(() =>
      useAuthStore
        .getState()
        .auth.setUser({ id: 22, username: 'other', role: 1, group: 'default' })
    )
    expect(signal?.aborted).toBe(true)
    await act(async () =>
      finish({ data: { data: [{ b64_json: 'cHJpdmF0ZQ==' }] } })
    )
    expect(
      screen.queryByRole('img', { name: 'Generated image 1' })
    ).not.toBeInTheDocument()
    expect(screen.getByLabelText('Describe your image')).toHaveValue('')
  })
})

describe('image response normalization', () => {
  it.each([
    {
      label: 'ordinary text',
      response: {
        choices: [{ message: { content: 'Please describe the scene.' } }],
      },
      kind: 'text-only',
    },
    {
      label: 'refusal wording without a structured signal',
      response: {
        choices: [
          { message: { content: 'I cannot generate images with this model.' } },
        ],
      },
      kind: 'text-only',
    },
    {
      label: 'structured refusal',
      response: { choices: [{ message: { refusal: 'Request declined.' } }] },
      kind: 'refused',
    },
    {
      label: 'content filter',
      response: {
        choices: [
          { message: { content: null }, finish_reason: 'content_filter' },
        ],
      },
      kind: 'refused',
    },
    {
      label: 'refusal content part',
      response: {
        choices: [
          {
            message: {
              content: [{ type: 'refusal', refusal: 'Request declined.' }],
            },
          },
        ],
      },
      kind: 'refused',
    },
    {
      label: 'Gemini prompt block',
      response: { promptFeedback: { blockReason: 'SAFETY' } },
      kind: 'refused',
    },
    {
      label: 'Gemini image safety stop',
      response: {
        candidates: [{ finishReason: 'IMAGE_SAFETY', content: { parts: [] } }],
      },
      kind: 'refused',
    },
    {
      label: 'unsupported Gemini image format',
      response: {
        candidates: [
          {
            content: {
              parts: [
                { inlineData: { mimeType: 'image/png', data: 'aGVsbG8=' } },
              ],
            },
          },
        ],
      },
      kind: 'unreadable-image',
    },
    {
      label: 'invalid encoded image',
      response: { data: [{ b64_json: 'not valid base64!' }] },
      kind: 'unreadable-image',
    },
    {
      label: 'unsafe image URL with accompanying text',
      response: {
        choices: [
          {
            message: {
              content: 'Here is your image.',
              images: [{ image_url: { url: 'javascript:alert(1)' } }],
            },
          },
        ],
      },
      kind: 'unreadable-image',
    },
    {
      label: 'truncated generation',
      response: {
        choices: [
          {
            message: { content: 'Working on the image.' },
            finish_reason: 'length',
          },
        ],
      },
      kind: 'incomplete',
    },
    {
      label: 'Gemini no-image stop without safety evidence',
      response: { candidates: [{ finishReason: 'NO_IMAGE' }] },
      kind: 'empty',
    },
    { label: 'empty choices', response: { choices: [] }, kind: 'empty' },
    { label: 'null response', response: null, kind: 'empty' },
    {
      label: 'HTML proxy response',
      response: '<html>upstream unavailable</html>',
      kind: 'invalid-response',
    },
    {
      label: 'unexpected JSON',
      response: { task_id: 'pending' },
      kind: 'invalid-response',
    },
  ])(
    'classifies $label without changing or replaying the generation request',
    async ({ response, kind }) => {
      vi.mocked(api.post).mockResolvedValue({ data: response })
      await expect(
        generateStudioImages(
          {
            model: 'gemini-image-test',
            protocol: 'chat',
            prompt: 'A house',
            ratio: '1:1',
            count: 1,
          },
          new AbortController().signal
        )
      ).rejects.toMatchObject({ kind })
      expect(api.post).toHaveBeenCalledTimes(1)
    }
  )

  it('omits reasoning, raw image data and credentials from response excerpts', async () => {
    vi.mocked(api.post).mockResolvedValue({
      data: {
        candidates: [
          {
            content: {
              parts: [
                { thought: true, text: 'private internal reasoning' },
                { type: 'reasoning', text: 'private internal reasoning' },
                {
                  text: `Image unavailable. Bearer secret-token sk-test-secret data:image/png;base64,${'A'.repeat(3000)}`,
                },
              ],
            },
          },
        ],
      },
    })
    const error = await generateStudioImages(
      {
        model: 'gemini-image-test',
        protocol: 'chat',
        prompt: 'A house',
        ratio: '1:1',
        count: 1,
      },
      new AbortController().signal
    ).catch((error: unknown) => error)
    expect(error).toMatchObject({
      reply: expect.stringContaining('Image unavailable.'),
    })
    const reply = (error as { reply: string }).reply
    expect(reply).not.toMatch(
      /private internal reasoning|secret-token|sk-test-secret|AAAA|data:image/
    )
  })

  it('keeps valid images even when a response also contains text or another refused choice', async () => {
    vi.mocked(api.post).mockResolvedValue({
      data: {
        choices: [
          {
            message: {
              content: 'An image.',
              images: [
                { image_url: { url: 'https://example.test/image.png' } },
              ],
            },
          },
          { message: { refusal: 'One alternative was declined.' } },
        ],
      },
    })
    await expect(
      generateStudioImages(
        {
          model: 'gemini-image-test',
          protocol: 'chat',
          prompt: 'A house',
          ratio: '1:1',
          count: 1,
        },
        new AbortController().signal
      )
    ).resolves.toEqual([
      { src: 'https://example.test/image.png', revisedPrompt: undefined },
    ])
  })

  it('accepts array and object image payloads, skips metadata and deduplicates URLs', () => {
    expect(
      parseStudioImages({
        data: {
          url: 'https://example.test/image.png',
          revised_prompt: 'Revised prompt',
        },
      })
    ).toEqual([
      {
        src: 'https://example.test/image.png',
        revisedPrompt: 'Revised prompt',
      },
    ])
    expect(
      parseStudioImages({
        data: [
          { revised_prompt: 'No image' },
          { b64_json: '/9j/aGVsbG8=' },
          { url: 'https://example.test/image.png' },
          { url: 'https://example.test/image.png' },
        ],
      })
    ).toHaveLength(2)
    expect(
      parseStudioImages({ data: [{ b64_json: '/9j/aGVsbG8=' }] })[0].src
    ).toContain('data:image/jpeg;')
  })

  it('handles chat markdown and structured image parts, rejecting executable or non-image URLs', () => {
    expect(
      parseStudioImages({
        choices: [
          { message: { content: '![image](data:image/png;base64,aGVsbG8=)' } },
          {
            message: {
              content: [
                {
                  type: 'image_url',
                  image_url: { url: 'https://example.test/output.png' },
                },
              ],
              images: [
                { image_url: { url: 'https://example.test/second.png' } },
              ],
            },
          },
        ],
      })
    ).toHaveLength(3)
    expect(
      parseStudioImages({
        data: [
          { url: 'javascript:alert(1)' },
          { url: 'data:image/svg+xml;base64,aGVsbG8=' },
          { url: 'file:///image.png' },
        ],
      })
    ).toEqual([])
    expect(() =>
      parseStudioImages({ error: { message: 'Quota exhausted' } })
    ).toThrow('Quota exhausted')
  })

  it('posts JSON without reference data for text mode and forwards cancellation', async () => {
    vi.mocked(api.post).mockResolvedValue({
      data: { data: { b64_json: 'aGVsbG8=' } },
    })
    const controller = new AbortController()
    await generateStudioImages(
      {
        model: 'gpt-image-1',
        protocol: 'images',
        prompt: 'A house',
        ratio: '3:2',
        count: 2,
      },
      controller.signal
    )
    expect(api.post).toHaveBeenCalledWith(
      '/pg/image-studio',
      {
        model: 'gpt-image-1',
        protocol: 'images',
        prompt: 'A house',
        n: 2,
        size: '1536x1024',
        aspect_ratio: '3:2',
      },
      expect.objectContaining({
        signal: controller.signal,
        timeout: 660000,
        skipAuthRefresh: true,
      })
    )
  })
})

describe('image studio preview', () => {
  it('lists image models from the signed-in group without generating or charging', async () => {
    renderStudio()
    const selector = screen.getByRole('combobox', { name: 'Model' })
    await waitFor(() => expect(selector).toHaveValue('gpt-image-1'))
    expect(api.get).toHaveBeenCalledWith('/api/user/models', {
      params: { group: 'studio-team' },
    })
    await userEvent.click(screen.getByRole('button', { name: 'Model' }))
    expect(
      await screen.findByRole('option', { name: 'IMAGE-editor' })
    ).toBeVisible()
    expect(
      screen.queryByRole('option', { name: 'text-model' })
    ).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('option', { name: 'IMAGE-editor' }))
    expect(selector).toHaveValue('IMAGE-editor')
    expect(
      screen.getByRole('button', { name: 'Generate image' })
    ).toBeDisabled()
    expect(api.post).not.toHaveBeenCalled()
  })

  it('changes modes and aspect ratio immediately, and applies an inspiration prompt', async () => {
    renderStudio()
    await userEvent.click(
      screen.getByRole('button', { name: 'Image to image' })
    )
    expect(
      screen.getByRole('button', { name: 'Image to image' })
    ).toHaveAttribute('aria-pressed', 'true')
    expect(
      screen.getByLabelText('Reference image', { selector: 'input' })
    ).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: '3:2' }))
    expect(screen.getByRole('button', { name: '3:2' })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
    expect(
      within(screen.getByRole('region', { name: 'Canvas preview' })).getByText(
        '3:2'
      )
    ).toBeVisible()
    await userEvent.click(
      screen.getByRole('button', { name: 'Architectural light' })
    )
    expect(screen.getByLabelText('Describe your image')).toHaveValue(
      'A minimalist white building by the sea, afternoon sunlight crossing an archway, quiet shadows, architectural photography, restrained composition.'
    )
    expect(screen.getByLabelText('Describe your image')).toHaveFocus()
    await userEvent.click(screen.getByRole('button', { name: 'Text to image' }))
    expect(
      screen.queryByLabelText('Reference image', { selector: 'input' })
    ).not.toBeInTheDocument()
  })

  it('previews and removes a local reference, rejecting invalid replacements', async () => {
    const view = renderStudio()
    await userEvent.click(
      screen.getByRole('button', { name: 'Image to image' })
    )
    const input = screen.getByLabelText('Reference image', {
      selector: 'input',
    })
    fireEvent.change(input, {
      target: {
        files: [new File(['photo'], 'reference.png', { type: 'image/png' })],
      },
    })
    expect(
      await screen.findByRole('img', { name: 'Reference preview' })
    ).toHaveAttribute('src', 'blob:studio-reference')
    fireEvent.change(input, {
      target: {
        files: [new File(['bad'], 'bad.svg', { type: 'image/svg+xml' })],
      },
    })
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Please choose a PNG, JPG or WebP image.'
    )
    expect(
      screen.getByRole('img', { name: 'Reference preview' })
    ).toBeInTheDocument()
    await userEvent.click(
      screen.getByRole('button', { name: 'Remove reference image' })
    )
    expect(
      screen.queryByRole('img', { name: 'Reference preview' })
    ).not.toBeInTheDocument()
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:studio-reference')
    expect(api.post).not.toHaveBeenCalled()
    view.unmount()
  })

  it('rejects empty and oversized images, and recovers from undecodable image content', async () => {
    renderStudio()
    await userEvent.click(
      screen.getByRole('button', { name: 'Image to image' })
    )
    const input = screen.getByLabelText('Reference image', {
      selector: 'input',
    })
    fireEvent.change(input, {
      target: { files: [new File([], 'empty.png', { type: 'image/png' })] },
    })
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Choose a non-empty image smaller than 10 MB.'
    )
    const large = new File(['photo'], 'large.png', { type: 'image/png' })
    Object.defineProperty(large, 'size', { value: 10 * 1024 * 1024 + 1 })
    fireEvent.change(input, { target: { files: [large] } })
    expect(createObjectURL).not.toHaveBeenCalled()
    fireEvent.change(input, {
      target: {
        files: [new File(['broken'], 'broken.png', { type: 'image/png' })],
      },
    })
    fireEvent.error(
      await screen.findByRole('img', { name: 'Reference preview' })
    )
    expect(screen.getByRole('alert')).toHaveTextContent(
      'This image could not be opened.'
    )
    expect(
      screen.queryByRole('img', { name: 'Reference preview' })
    ).not.toBeInTheDocument()
  })

  it('shows empty and failed model states without inserting fictional models, and supports retry', async () => {
    vi.mocked(api.get)
      .mockRejectedValueOnce(new Error('network unavailable'))
      .mockResolvedValueOnce({ data: { success: true, data: ['chat-only'] } })
    renderStudio()
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Unable to load image models.'
    )
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(
      await screen.findByText('No image models are available in your group.')
    ).toBeVisible()
    expect(screen.getByRole('combobox', { name: 'Model' })).toBeDisabled()
  })

  it('clears prompts and references and queries a new group when accounts change', async () => {
    renderStudio()
    fireEvent.change(screen.getByLabelText('Describe your image'), {
      target: { value: 'Private draft' },
    })
    await userEvent.click(
      screen.getByRole('button', { name: 'Image to image' })
    )
    fireEvent.change(
      screen.getByLabelText('Reference image', { selector: 'input' }),
      {
        target: {
          files: [new File(['photo'], 'private.png', { type: 'image/png' })],
        },
      }
    )
    act(() =>
      useAuthStore.getState().auth.setUser({
        id: 22,
        username: 'second-artist',
        role: 1,
        group: 'other-team',
      })
    )
    expect(screen.getByLabelText('Describe your image')).toHaveValue('')
    expect(
      screen.queryByRole('img', { name: 'Reference preview' })
    ).not.toBeInTheDocument()
    await waitFor(() =>
      expect(api.get).toHaveBeenCalledWith('/api/user/models', {
        params: { group: 'other-team' },
      })
    )
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:studio-reference')
  })

  it('places Image Studio directly after Playground and renders Chinese labels after switching languages', async () => {
    const sidebar = renderHook(useSidebarData)
    const items = sidebar.result.current.navGroups[0].items
    const playgroundIndex = items.findIndex(
      (item) => item.title === 'Playground'
    )
    expect(items[playgroundIndex + 1]).toMatchObject({
      title: 'Image Studio',
      url: '/image-studio',
    })
    renderStudio()
    i18next.addResourceBundle('zh', 'translation', zh.translation, true, true)
    await act(async () => {
      await i18next.changeLanguage('zh')
    })
    expect(screen.getByRole('heading', { name: '生图台' })).toBeVisible()
    expect(screen.getByRole('button', { name: '文生图' })).toBeVisible()
    expect(screen.getByRole('button', { name: '图生图' })).toBeVisible()
    expect(
      screen.getByText(
        '生成将按模型定价扣除账户额度，请保持页面打开，等待完成。'
      )
    ).toBeVisible()
  })
})
