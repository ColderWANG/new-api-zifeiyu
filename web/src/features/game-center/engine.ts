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
export const DURATION = 1800
export const TICK_MS = 100
export type Enemy = {
  id: number
  x: number
  y: number
  hp: number
  kind: number
}
export type Token = { x: number; y: number; value: number }
export type GameState = {
  version: number
  tick: number
  rng: number
  x: number
  y: number
  hp: number
  max_hp: number
  score: number
  kills: number
  collected: number
  picked_tokens: number
  power: number
  speed: number
  upgrades: number
  dash_until: number
  dash_ready: number
  hurt_until: number
  beam_x: number
  beam_y: number
  beam_until: number
  next_id: number
  enemies: Enemy[]
  tokens: Token[]
}
export function newGame(seed: number): GameState {
  return {
    version: 1,
    tick: 0,
    rng: seed,
    x: 5000,
    y: 3500,
    hp: 100,
    max_hp: 100,
    score: 0,
    kills: 0,
    collected: 0,
    picked_tokens: 0,
    power: 3,
    speed: 140,
    upgrades: 0,
    dash_until: 0,
    dash_ready: 0,
    hurt_until: 0,
    beam_x: 0,
    beam_y: 0,
    beam_until: 0,
    next_id: 0,
    enemies: [],
    tokens: [],
  }
}
const directions = [
  [0, 0],
  [0, -1],
  [1, -1],
  [1, 0],
  [1, 1],
  [0, 1],
  [-1, 1],
  [-1, 0],
  [-1, -1],
]
function random(s: GameState, n: number) {
  s.rng = (Math.imul(s.rng, 1664525) + 1013904223) >>> 0
  return s.rng % n
}
export function isDone(s: GameState) {
  return s.hp <= 0 || s.tick >= DURATION
}
// Kept in lockstep with pkg/tokengame/engine.go; shared replay fixtures verify parity.
export function step(s: GameState, input: number) {
  if (isDone(s)) return
  s.tick++
  const upgrade = input >> 5
  if (upgrade > 0 && s.upgrades < Math.min(5, Math.floor(s.tick / 300))) {
    s.upgrades++
    if (upgrade === 1) s.power += 2
    if (upgrade === 2) s.speed += 20
    if (upgrade === 3) {
      s.max_hp += 15
      s.hp = Math.min(s.max_hp, s.hp + 35)
    }
  }
  if (input & 16 && s.tick >= s.dash_ready) {
    s.dash_until = s.tick + 4
    s.dash_ready = s.tick + 45
  }
  const d = directions[input & 15]
  let speed = s.speed
  if (s.tick < s.dash_until) speed *= 3
  if (d[0] && d[1]) speed = Math.trunc((speed * 707) / 1000)
  s.x = Math.max(200, Math.min(9800, s.x + d[0] * speed))
  s.y = Math.max(200, Math.min(6800, s.y + d[1] * speed))
  const interval = Math.max(5, 15 - Math.floor(s.tick / 180))
  const boss = [600, 1200, 1650].includes(s.tick)
  if ((s.tick % interval === 0 || boss) && s.enemies.length < 100) {
    let kind = random(s, 10)
    if (kind < 6) kind = 0
    else if (kind < 9) kind = 1
    else kind = 2
    if (boss) kind = 3
    let x = random(s, 10000),
      y = random(s, 7000)
    switch (random(s, 4)) {
      case 0:
        x = 0
        break
      case 1:
        x = 10000
        break
      case 2:
        y = 0
        break
      case 3:
        y = 7000
        break
    }
    s.enemies.push({ id: ++s.next_id, x, y, hp: [3, 2, 12, 100][kind], kind })
  }
  if (s.tick % 5 === 0 && s.enemies.length) {
    let closest = -1,
      dist = 2200 * 2200
    s.enemies.forEach((e, i) => {
      const dd = (e.x - s.x) ** 2 + (e.y - s.y) ** 2
      if (dd < dist) {
        closest = i
        dist = dd
      }
    })
    if (closest >= 0) {
      const e = s.enemies[closest]
      e.hp -= s.power
      s.beam_x = e.x
      s.beam_y = e.y
      s.beam_until = s.tick + 2
    }
  }
  s.enemies = s.enemies.filter((e) => {
    if (e.hp <= 0) {
      s.kills++
      const value = e.kind === 3 ? 100 : 10
      s.score += value * 2
      if (s.tokens.length < 200) s.tokens.push({ x: e.x, y: e.y, value })
      return false
    }
    const dx = s.x - e.x,
      dy = s.y - e.y,
      dist = Math.max(1, Math.floor(Math.sqrt(dx * dx + dy * dy)))
    const velocity = [48, 85, 32, 38][e.kind] + Math.floor(s.tick / 120)
    e.x += Math.trunc((dx * velocity) / dist)
    e.y += Math.trunc((dy * velocity) / dist)
    if (dist < 330 && s.tick >= s.hurt_until && s.tick >= s.dash_until) {
      s.hp = Math.max(0, s.hp - [8, 6, 15, 25][e.kind])
      s.hurt_until = s.tick + 8
    }
    return true
  })
  s.tokens = s.tokens.filter((token) => {
    const dx = s.x - token.x,
      dy = s.y - token.y,
      dist = Math.floor(Math.sqrt(dx * dx + dy * dy))
    if (dist < 450) {
      s.collected += token.value
      s.picked_tokens++
      s.score += token.value * 3
      return false
    }
    if (dist < 1400) {
      token.x += Math.trunc((dx * 220) / dist)
      token.y += Math.trunc((dy * 220) / dist)
    }
    return true
  })
  if (s.tick % 10 === 0) s.score++
}
