export interface GameInitMessage {
  type: 'game_init'
  tick: number
  started_at: number   // Unix ms when game started (authoritative source)
  sphere_radius: number
  stones: Array<{ id: number; center: [number, number, number]; cap_angle: number }>
  tribes: Array<{ id: number; name: string; color: string; energy: number; alive: boolean; palace_bricks: number; vision_radius: number }>
  units: Array<{ id: number; tribe_id: number; type: string; pos: [number, number, number]; hp: number; max_hp: number }>
  energy_sources: Array<{ id: number; pos: [number, number, number]; amount: number; owner_tribe_id: number | null }>
}

export interface DiffMessage {
  type: 'diff'
  tick: number
  moved: Array<[number, number, number, number]>
  spawned: Array<{ id: number; tribe_id: number; type: string; pos: [number, number, number]; hp: number; max_hp: number }>
  died: number[]
  hp_changed: Array<[number, number]>
  hit_flashes: Array<[number, number, number]>
  energy_spawned: Array<{ id: number; pos: [number, number, number]; amount: number }>
  energy_depleted: number[]
  energy_claimed: Array<{ id: number; tribe_id: number }>
  tribe_stats: Array<{ id: number; energy: number; units: Record<string, number>; alive: boolean; palace_bricks: number; vision_radius: number }>
  events: Array<{ type: string; tribe_id: number; msg: string }>
}

export interface GameOverMessage {
  type: 'game_over'
  winner: { id: number; name: string }
}

export interface EventHistoryMessage {
  type: 'event_history'
  events: Array<{ type: string; tribe_id: number; msg: string; tick: number }>
  tribe_stats: Array<{ id: number; energy: number; units: Record<string, number>; alive: boolean }>
}

export interface ErrorMessage {
  type: 'error'
  msg: string
}

export type ServerMessage = GameInitMessage | DiffMessage | GameOverMessage | EventHistoryMessage | ErrorMessage

type MessageHandler = (msg: ServerMessage) => void

export class GameSocket {
  private ws: WebSocket | null = null
  private url: string
  private reconnectDelay = 2000
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private intentionalClose = false
  public onMessage: MessageHandler | null = null
  public onOpen: (() => void) | null = null

  constructor(url: string) {
    this.url = url
  }

  connect() {
    this.intentionalClose = false
    this._open()
  }

  private _open() {
    try {
      this.ws = new WebSocket(this.url)
      this.ws.onopen = () => {
        this.onOpen?.()
      }
      this.ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data) as ServerMessage
          this.onMessage?.(msg)
        } catch {
          // ignore parse errors
        }
      }
      this.ws.onclose = () => {
        if (!this.intentionalClose) {
          this.reconnectTimer = setTimeout(() => this._open(), this.reconnectDelay)
        }
      }
      this.ws.onerror = () => {
        this.ws?.close()
      }
    } catch {
      this.reconnectTimer = setTimeout(() => this._open(), this.reconnectDelay)
    }
  }

  send(msg: object) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg))
    }
  }

  close() {
    this.intentionalClose = true
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    this.ws?.close()
    this.ws = null
  }
}
