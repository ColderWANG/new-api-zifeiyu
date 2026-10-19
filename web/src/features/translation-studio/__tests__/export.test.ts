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
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate'
import { describe, expect, it } from 'vitest'

import { exportDocx, readDocx } from '../lib/docx'
import { exportTranslation, translationDownloadName } from '../lib/export'
import {
  readImageTranslations,
  readSegmentTranslations,
} from '../lib/structured'
import type { TranslationFormat, TranslationSource } from '../types'

const namespace = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
const xml = `<w:document xmlns:w="${namespace}"><w:body><w:p><w:pPr><w:pStyle w:val="Title"/></w:pPr><w:r><w:rPr><w:b/></w:rPr><w:t>Hello </w:t></w:r><w:r><w:t>world</w:t></w:r></w:p><w:tbl><w:tr><w:tc><w:p><w:r><w:t>Price</w:t></w:r></w:p></w:tc></w:tr></w:tbl><w:sectPr><w:pgSz w:w="11906" w:h="16838"/></w:sectPr></w:body></w:document>`
const original = {
  '[Content_Types].xml': strToU8('<Types/>'),
  'word/document.xml': strToU8(xml),
  'word/header1.xml': strToU8(
    `<w:hdr xmlns:w="${namespace}"><w:p><w:r><w:t>Company</w:t></w:r></w:p></w:hdr>`
  ),
  'word/media/image1.png': new Uint8Array([137, 80, 78, 71, 1, 2, 3]),
  'word/styles.xml': strToU8('<styles>unchanged</styles>'),
  'word/_rels/document.xml.rels': strToU8(
    '<relationships>unchanged</relationships>'
  ),
}

function blobBytes(blob: Blob): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.addEventListener(
      'load',
      () => resolve(new Uint8Array(reader.result as ArrayBuffer)),
      { once: true }
    )
    reader.addEventListener('error', () => reject(reader.error), { once: true })
    reader.readAsArrayBuffer(blob)
  })
}

describe('original-format translation exports', () => {
  it('writes translations back into a real ZIP package without changing formatting, relationships or images', async () => {
    const source = await readDocx(zipSync(original))
    const blob = await exportDocx(source.template, {
      s0: 'Bonjour ',
      s1: 'monde & amis <3',
      s2: 'Prix',
      s3: 'Entreprise',
    })
    expect(blob.type).toBe(
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    )
    const files = unzipSync(await blobBytes(blob))
    expect(Object.keys(files).sort()).toEqual(Object.keys(original).sort())
    for (const name of [
      'word/styles.xml',
      'word/media/image1.png',
      'word/_rels/document.xml.rels',
    ]) {
      expect([...files[name]]).toEqual([
        ...original[name as keyof typeof original],
      ])
    }
    const document = new DOMParser().parseFromString(
      strFromU8(files['word/document.xml']),
      'application/xml'
    )
    expect(document.querySelector('parsererror')).toBeNull()
    expect(
      [...document.getElementsByTagNameNS(namespace, 't')].map(
        (node) => node.textContent
      )
    ).toEqual(['Bonjour ', 'monde & amis <3', 'Prix'])
    expect(document.getElementsByTagNameNS(namespace, 'b')).toHaveLength(1)
    expect(document.getElementsByTagNameNS(namespace, 'tbl')).toHaveLength(1)
    expect(
      document.getElementsByTagNameNS(namespace, 'pgSz')[0].getAttribute('w:w')
    ).toBe('11906')
    expect(strFromU8(files['word/header1.xml'])).toContain('Entreprise')
    expect(strFromU8(source.template.files['word/document.xml'])).toBe(xml)
  })

  it('keeps untranslated nodes intact in partial documents and labels partial files', async () => {
    const source = await readDocx(zipSync(original))
    const files = unzipSync(
      await blobBytes(await exportDocx(source.template, { s0: 'Bonjour ' }))
    )
    expect(strFromU8(files['word/document.xml'])).toContain('world')
    expect([...files['word/header1.xml']]).toEqual([
      ...original['word/header1.xml'],
    ])
    expect(
      translationDownloadName(
        { name: 'order.docx', format: 'docx' } as TranslationSource,
        'fr',
        true
      )
    ).toBe('order-fr-partial.docx')
  })

  it.each([
    'docx',
    'pdf',
    'png',
    'jpg',
    'jpeg',
    'webp',
    'md',
    'txt',
  ] as TranslationFormat[])(
    'keeps the %s extension instead of silently returning TXT',
    (format) => {
      expect(
        translationDownloadName(
          { name: `report.${format}`, format } as TranslationSource,
          'zh-CN',
          false
        )
      ).toBe(`report-zh-CN.${format}`)
    }
  )

  it('exports Markdown with its proper MIME type and preserves the text', async () => {
    const blob = await exportTranslation(
      { name: 'notes.md', format: 'md' } as TranslationSource,
      { text: '# Heading\n\n**Bold**', completed: 1, total: 1 },
      'en',
      new AbortController().signal
    )
    expect(blob.type).toBe('text/markdown;charset=utf-8')
    expect(strFromU8(await blobBytes(blob))).toBe('# Heading\n\n**Bold**')
  })

  it('rejects ZIP bombs before expanding their contents', async () => {
    const bytes = zipSync({
      'word/document.xml': strToU8('x'.repeat(8 * 1024 * 1024 + 1)),
    })
    await expect(readDocx(bytes)).rejects.toThrow('too large')
  })

  it('handles strict OOXML namespaces and Unicode across long runs', async () => {
    const text = `Hello ${String.fromCodePoint(0x1f30d).repeat(1500)}`
    const document = await readDocx(
      zipSync({
        'word/document.xml': strToU8(
          xml
            .replace(
              namespace,
              'http://purl.oclc.org/ooxml/wordprocessingml/main'
            )
            .replace('Hello ', text)
        ),
      })
    )
    const segments = document.units.flatMap((unit) => unit.segments ?? [])
    const ids = document.template.nodes[0].ids
    expect(
      segments
        .filter((segment) => ids.includes(segment.id))
        .map((segment) => segment.text)
        .join('')
    ).toBe(text)
    expect(
      segments.every((segment) => !/[\ud800-\udbff]$/.test(segment.text))
    ).toBe(true)
  })
})

describe('structured model response validation', () => {
  const segments = [
    { id: 's0', text: 'Hello ', paragraph: 'p0' },
    { id: 's1', text: 'world', paragraph: 'p0' },
  ]
  it('maps out-of-order responses to original formatting boundaries and preserves spaces', () => {
    expect(
      readSegmentTranslations(
        '```json\n{"translations":[{"id":"s1","text":"monde"},{"id":"s0","text":"Bonjour"}]}\n```',
        segments
      )
    ).toEqual({ s0: 'Bonjour ', s1: 'monde' })
  })
  it.each([
    '{"translations":[{"id":"s0","text":"Bonjour"}]}',
    '{"translations":[{"id":"s0","text":"Bonjour"},{"id":"s0","text":"monde"}]}',
    '{"translations":[{"id":"s0","text":"Bonjour"},{"id":"s9","text":"monde"}]}',
    '{"translations":[{"id":"s0","text":"Bonjour"},{"id":"s1","text":""}]}',
    'Unstructured text',
  ])(
    'rejects a response that would lose or misplace source content',
    (response) => {
      expect(() => readSegmentTranslations(response, segments)).toThrow(
        'document structure'
      )
    }
  )
  it('accepts valid OCR boxes and blank scanned pages', () => {
    expect(
      readImageTranslations(
        '{"regions":[{"box":[10,20,300,50],"text":"Bonjour"}]}',
        2
      )
    ).toEqual([{ id: 'p2ocr0', box: [10, 20, 300, 50], text: 'Bonjour' }])
    expect(readImageTranslations('{"regions":[]}', 1)).toEqual([])
  })
  it.each([
    [900, 0, 200, 20],
    [0, -1, 10, 20],
    [0, 0, 0, 30],
    [0, 0, '20', 30],
  ])('rejects invalid OCR boxes %#', (...box) => {
    expect(() =>
      readImageTranslations(
        JSON.stringify({ regions: [{ box, text: 'bad' }] }),
        1
      )
    ).toThrow('document structure')
  })
})

it('accepts bare OCR arrays returned by Ministral while retaining all region validation', () => {
  const regions = [{ box: [100, 120, 300, 50], text: 'Order AW-2026-041' }]
  const expected = readImageTranslations(JSON.stringify({ regions }), 1)
  expect(readImageTranslations(JSON.stringify(regions), 1)).toEqual(expected)
  expect(
    readImageTranslations(
      ['```json', JSON.stringify(regions), '```'].join('\n'),
      1
    )
  ).toEqual(expected)
  expect(() =>
    readImageTranslations('[{"box":[900,0,300,50],"text":"bad"}]', 1)
  ).toThrow('structure')
  expect(() =>
    readImageTranslations('[{"box":[0,0,300,50],"text":""}]', 1)
  ).toThrow('structure')
  expect(() =>
    readSegmentTranslations('[{"id":"s0","text":"Hello"}]', [
      { id: 's0', paragraph: 'p0', text: 'Hello' },
    ])
  ).toThrow('structure')
})
