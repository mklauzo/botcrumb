import { create } from 'zustand'

export type GamePhase = 'setup' | 'playing' | 'over'

export interface TribeStats {
  id: number
  name: string
  color: string
  energy: number
  units: { worker: number; attacker: number; defender: number; queen: number }
  maxUnits: { worker: number; attacker: number; defender: number; queen: number }
  alive: boolean
  palace_bricks: number
}

export interface GameEvent {
  id: number
  type: string
  tribe_id: number
  msg: string
  timestamp: number
  tick?: number
}

export type ApiKeys = Record<string, string>  // provider -> key

interface GameStore {
  gamePhase: GamePhase
  selectedModel: string
  numTribes: number
  apiKeys: ApiKeys          // per-provider keys
  tribes: TribeStats[]
  eventLog: GameEvent[]
  winner: { id: number; name: string } | null
  eventCounter: number
  pendingStart: boolean
  gameStartTime: number | null
  energySources: { total: number; exploited: number }

  setGamePhase: (phase: GamePhase) => void
  setSelectedModel: (model: string) => void
  setNumTribes: (n: number) => void
  setApiKey: (provider: string, key: string) => void
  setPendingStart: (v: boolean) => void
  setEnergySources: (total: number, exploited: number) => void
  setTribes: (tribes: Array<{ id: number; name: string; color: string }>, startedAt?: number) => void
  updateStats: (stats: Array<{ id: number; energy: number; units: Record<string, number>; alive: boolean; palace_bricks?: number }>) => void
  addEvent: (event: Omit<GameEvent, 'id' | 'timestamp'>) => void
  setEventLog: (events: Array<{ type: string; tribe_id: number; msg: string; tick?: number }>) => void
  setWinner: (winner: { id: number; name: string }) => void
  resetGame: () => void

  /** Returns the API key for the currently selected model's provider */
  getActiveApiKey: () => string
}

function providerOf(model: string): string {
  if (model.startsWith('ollama:')) return 'ollama'
  if (model.startsWith('claude-')) return 'anthropic'
  if (model.startsWith('gemini-')) return 'gemini'
  return 'openai'
}

export const useGameStore = create<GameStore>((set, get) => ({
  gamePhase: 'setup',
  selectedModel: 'ollama:llama3.2',
  numTribes: 4,
  apiKeys: { openai: '', anthropic: '', gemini: '' },
  tribes: [],
  eventLog: [],
  winner: null,
  eventCounter: 0,
  pendingStart: false,
  gameStartTime: null,
  energySources: { total: 0, exploited: 0 },

  setGamePhase: (phase) => set({ gamePhase: phase }),
  setSelectedModel: (model) => set({ selectedModel: model }),
  setNumTribes: (n) => set({ numTribes: n }),
  setApiKey: (provider, key) =>
    set(state => ({ apiKeys: { ...state.apiKeys, [provider]: key } })),
  setPendingStart: (v) => set({ pendingStart: v }),
  setEnergySources: (total, exploited) => set({ energySources: { total, exploited } }),

  getActiveApiKey: () => {
    const { selectedModel, apiKeys } = get()
    return apiKeys[providerOf(selectedModel)] ?? ''
  },

  setTribes: (tribes, startedAt?) => {
    // Use server-provided start time (authoritative); fall back to localStorage on reconnect
    const gameStartTime = startedAt ?? (() => {
      const stored = localStorage.getItem('gameStartTime')
      return stored ? parseInt(stored, 10) : Date.now()
    })()
    localStorage.setItem('gameStartTime', String(gameStartTime))
    set({
      gameStartTime,
      tribes: tribes.map(t => ({
        ...t,
        energy: 0,
        units: { worker: 0, attacker: 0, defender: 0, queen: 0 },
        maxUnits: { worker: 0, attacker: 0, defender: 0, queen: 0 },
        alive: true,
        palace_bricks: 0,
      })),
    })
  },

  updateStats: (stats) =>
    set(state => ({
      tribes: state.tribes.map(t => {
        const s = stats.find(x => x.id === t.id)
        if (!s) return t
        const newUnits = {
          worker: s.units.worker ?? 0,
          attacker: s.units.attacker ?? 0,
          defender: s.units.defender ?? 0,
          queen: s.units.queen ?? 0,
        }
        return {
          ...t,
          energy: s.energy,
          units: newUnits,
          maxUnits: {
            worker: Math.max(t.maxUnits.worker, newUnits.worker),
            attacker: Math.max(t.maxUnits.attacker, newUnits.attacker),
            defender: Math.max(t.maxUnits.defender, newUnits.defender),
            queen: Math.max(t.maxUnits.queen, newUnits.queen),
          },
          alive: s.alive,
          palace_bricks: s.palace_bricks ?? t.palace_bricks,
        }
      }),
    })),

  addEvent: (event) =>
    set(state => {
      const id = state.eventCounter + 1
      const newEvent: GameEvent = { ...event, id, timestamp: Date.now() }
      return { eventLog: [newEvent, ...state.eventLog].slice(0, 500), eventCounter: id }
    }),

  setEventLog: (events) =>
    set(state => {
      const newLog: GameEvent[] = events.map((ev, i) => ({
        ...ev,
        id: i + 1,
        timestamp: Date.now() - (events.length - i) * 200,
      }))
      return {
        eventLog: [...newLog].reverse().slice(0, 500),
        eventCounter: newLog.length,
      }
    }),

  setWinner: (winner) => set({ winner, gamePhase: 'over' }),

  resetGame: () => {
    localStorage.removeItem('gameStartTime')
    set({
      gamePhase: 'setup',
      tribes: [],
      eventLog: [],
      winner: null,
      eventCounter: 0,
      pendingStart: false,
      gameStartTime: null,
      energySources: { total: 0, exploited: 0 },
    })
  },
}))
