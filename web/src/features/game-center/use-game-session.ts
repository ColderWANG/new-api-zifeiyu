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
import { useCallback, useEffect, useRef, useState } from 'react'

import { sendInputs, getGameStatus, type GameRun } from './api'
import {
  gameCursor,
  isDone,
  newGame,
  step,
  TICK_MS,
  type GameState,
} from './engine'

export function useGameSession(onFinish: () => void) {
  const [run, setRun] = useState<GameRun | null>(null)
  const [display, setDisplay] = useState<GameState>(() => newGame(42))
  const [connection, setConnection] = useState<'online' | 'reconnecting'>(
    'online'
  )
  const state = useRef<GameState>(newGame(42))
  const session = useRef<GameRun | null>(null)
  const input = useRef({ direction: 0, dash: false, upgrade: 0 })
  const pending = useRef<number[]>([])
  const offset = useRef(0)
  const busy = useRef(false)
  const quitRequested = useRef(false)
  const onFinishRef = useRef(onFinish)
  onFinishRef.current = onFinish
  const install = useCallback((next: GameRun | null) => {
    session.current = next
    quitRequested.current = false
    state.current = next ? structuredClone(next.state) : newGame(42)
    pending.current = []
    offset.current = next ? Date.now() - next.server_time : 0
    setRun(next)
    setDisplay(structuredClone(state.current))
    setConnection('online')
  }, [])

  useEffect(() => {
    const simulate = window.setInterval(() => {
      const current = session.current
      if (!current || current.status !== 'running' || document.hidden) return
      const target =
        Math.floor(
          (Date.now() - offset.current - current.started_at) / TICK_MS
        ) - 1
      // A long gap is recovered from the server, never replayed as a paused game.
      if (
        target - gameCursor(state.current) > 50 ||
        pending.current.length >= 50
      ) {
        return
      }
      while (gameCursor(state.current) < target && !isDone(state.current)) {
        const value =
          input.current.direction |
          (input.current.dash ? 16 : 0) |
          (input.current.upgrade << 5)
        input.current.dash = false
        step(state.current, value)
        input.current.upgrade = 0
        pending.current.push(value)
      }
      setDisplay(structuredClone(state.current))
    }, TICK_MS)
    const sync = window.setInterval(async () => {
      const current = session.current
      if (
        !current ||
        current.status !== 'running' ||
        busy.current ||
        (document.hidden && !quitRequested.current)
      ) {
        return
      }
      busy.current = true
      const from = gameCursor(state.current) - pending.current.length
      const batch = [...pending.current]
      try {
        const next = await sendInputs(
          current.id,
          from,
          batch,
          quitRequested.current
        )
        if (session.current?.id !== current.id) return
        const remaining = pending.current.slice(
          Math.max(0, gameCursor(next.state) - from)
        )
        pending.current = remaining
        state.current = structuredClone(next.state)
        for (const value of remaining) step(state.current, value)
        session.current = next
        setRun(next)
        setDisplay(structuredClone(state.current))
        setConnection('online')
        if (next.status !== 'running') {
          pending.current = []
          onFinishRef.current()
        }
      } catch {
        setConnection('reconnecting')
      } finally {
        busy.current = false
      }
    }, 2000)
    const visibility = async () => {
      input.current = { direction: 0, dash: false, upgrade: 0 }
      if (document.hidden || !session.current || busy.current) return
      busy.current = true
      try {
        const data = await getGameStatus()
        install(data.run)
        if (data.run?.status !== 'running') onFinishRef.current()
      } catch {
        setConnection('reconnecting')
      } finally {
        busy.current = false
      }
    }
    document.addEventListener('visibilitychange', visibility)
    return () => {
      clearInterval(simulate)
      clearInterval(sync)
      document.removeEventListener('visibilitychange', visibility)
    }
  }, [install])

  const quit = async () => {
    quitRequested.current = true
    // Let an in-flight checkpoint finish before submitting the end command.
    while (busy.current) {
      await new Promise<void>((resolve) => setTimeout(resolve, 50))
    }
    const current = session.current
    if (!current || current.status !== 'running') return
    busy.current = true
    try {
      const next = await sendInputs(
        current.id,
        gameCursor(state.current) - pending.current.length,
        [],
        true
      )
      install(next)
      onFinishRef.current()
    } catch {
      setConnection('reconnecting')
    } finally {
      busy.current = false
    }
  }

  return { run, display, state, input, connection, install, quit }
}
