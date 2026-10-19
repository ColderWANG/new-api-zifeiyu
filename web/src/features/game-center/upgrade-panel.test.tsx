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
import { fireEvent, render, screen, cleanup } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'

import { newGame, step, upgradePending } from './engine'
import { UpgradePanel } from './upgrade-panel'

afterEach(cleanup)
it('supports pointer and keyboard choices without a movement key choosing an upgrade', () => {
  const onChoose = vi.fn()
  const state = newGame(42)
  state.tick = 200
  state.clock_tick = 200
  render(<UpgradePanel state={state} onChoose={onChoose} />)
  expect(screen.getByRole('button', { name: /1. Power/ })).toHaveFocus()
  fireEvent.keyDown(window, { key: 'w' })
  expect(onChoose).not.toHaveBeenCalled()
  fireEvent.keyDown(window, { key: '2' })
  expect(onChoose).toHaveBeenLastCalledWith(2)
  fireEvent.click(screen.getByRole('button', { name: /3. Multishot/ }))
  expect(onChoose).toHaveBeenLastCalledWith(3)
})
it('holds combat at the checkpoint until the timeout then adds one target without healing', () => {
  const state = newGame(42)
  state.tick = 200
  state.clock_tick = 200
  state.hp = 40
  for (let i = 0; i < 99; i++) step(state, 3 | 16)
  expect(state.tick).toBe(200)
  expect(state.hp).toBe(40)
  expect(state.x).toBe(5000)
  expect(upgradePending(state)).toBe(true)
  step(state, 0)
  expect(state.hp).toBe(40)
  expect(state.extra_targets).toBe(1)
  expect(state.upgrades).toBe(1)
  expect(state.tick).toBe(200)
  step(state, 0)
  expect(state.tick).toBe(201)
})

it('previews the new target count and preserves legacy repair choices', () => {
  const state = newGame(42)
  state.tick = 400
  state.upgrades = 1
  state.extra_targets = 1
  const view = render(<UpgradePanel state={state} onChoose={vi.fn()} />)
  expect(screen.getByText('Move +25% · fire +25%')).toBeVisible()
  expect(screen.getByText('Targets 2 → 3')).toBeVisible()
  expect(screen.queryByText('Repair')).not.toBeInTheDocument()
  view.rerender(
    <UpgradePanel state={{ ...state, version: 2 }} onChoose={vi.fn()} />
  )
  expect(screen.getByRole('button', { name: /3. Repair/ })).toBeVisible()
  expect(screen.getByText('+20 speed')).toBeVisible()
})
