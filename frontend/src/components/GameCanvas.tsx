'use client'

import * as THREE from 'three'
import { useEffect, useRef, useState } from 'react'
import { SceneManager } from '@/three/SceneManager'
import { SphereRenderer } from '@/three/SphereRenderer'
import { UnitRenderer } from '@/three/UnitRenderer'
import { StoneRenderer } from '@/three/StoneRenderer'
import { EnergyRenderer } from '@/three/EnergyRenderer'
import { HitFlash } from '@/three/HitFlash'
import { QueenVisionRenderer } from '@/three/QueenVisionRenderer'
import {
  GameSocket,
  type DiffMessage,
  type GameInitMessage,
  type EventHistoryMessage,
  type ServerMessage,
} from '@/ws/GameSocket'
import { useGameStore } from '@/store/gameStore'

function getWsUrl(): string {
  if (typeof window === 'undefined') return 'ws://localhost:3000'
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${proto}//${window.location.host}`
}
const WS_URL = getWsUrl()
const SPHERE_RADIUS = 6000

export default function GameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const pendingDiffs = useRef<(DiffMessage | GameInitMessage)[]>([])
  const unitTypesRef = useRef<Map<number, string>>(new Map())
  const sceneRef = useRef<SceneManager | null>(null)
  const renderersRef = useRef<{
    sphere?: SphereRenderer
    units?: UnitRenderer
    stones?: StoneRenderer
    energy?: EnergyRenderer
    flash?: HitFlash
    queenVision?: QueenVisionRenderer
  }>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tooltip, setTooltip] = useState<{
    x: number; y: number; name: string; color: string
    units: { worker: number; attacker: number; defender: number; queen: number }
  } | null>(null)
  const raycaster = useRef(new THREE.Raycaster())

  const {
    setTribes, updateStats, addEvent, setEventLog, setWinner, setGamePhase,
  } = useGameStore()

  // Loading timeout — if game_init never arrives, show an error
  useEffect(() => {
    if (!loading) return
    const t = setTimeout(() => {
      setError('No response from server after 45s. Check that the backend is running and a model is selected.')
    }, 45_000)
    return () => clearTimeout(t)
  }, [loading])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    let sceneManager: SceneManager
    try {
      sceneManager = new SceneManager(canvas)
    } catch (e) {
      setError(`Three.js init failed: ${e}`)
      return
    }
    sceneRef.current = sceneManager
    const renderers = renderersRef.current

    // Show sphere immediately — before game_init
    renderers.sphere = new SphereRenderer(sceneManager.scene, SPHERE_RADIUS)
    renderers.flash = new HitFlash(sceneManager.scene)

    const observer = new ResizeObserver(entries => {
      const e = entries[0]
      sceneManager.handleResize(e.contentRect.width, e.contentRect.height)
    })
    observer.observe(canvas.parentElement ?? canvas)

    sceneManager.setRenderCallback(() => {
      const diffs = pendingDiffs.current.splice(0)
      for (const msg of diffs) {
        if (msg.type === 'game_init') _handleInit(msg)
        else if (msg.type === 'diff') _handleDiff(msg)
      }
      renderers.flash?.update()
    })
    sceneManager.start()

    // WebSocket
    const ws = new GameSocket(`${WS_URL}/ws/game`)

    ws.onOpen = () => {
      // Read store fresh — avoids stale closure from dynamic import timing
      const store = useGameStore.getState()
      if (store.pendingStart) {
        ws.send({
          type: 'start',
          num_tribes: store.numTribes,
          llm_model: store.selectedModel,
          llm_api_key: store.getActiveApiKey(),
        })
        store.setPendingStart(false)
      }
    }

    ws.onMessage = (msg: ServerMessage) => {
      if (msg.type === 'game_init' || msg.type === 'diff') {
        pendingDiffs.current.push(msg)
      }
      if (msg.type === 'game_init') {
        setTribes(msg.tribes)
        setGamePhase('playing')
        setLoading(false)
      }
      if (msg.type === 'diff') {
        for (const ev of msg.events ?? []) addEvent(ev)
        if (msg.tribe_stats) updateStats(msg.tribe_stats)
      }
      if (msg.type === 'event_history') {
        _handleHistory(msg)
      }
      if (msg.type === 'game_over') {
        setWinner(msg.winner)
      }
      if (msg.type === 'error') {
        setError(msg.msg)
      }
    }

    ws.connect()

    function _handleMouseMove(e: MouseEvent) {
      const units = renderersRef.current.units
      if (!units || !canvas) return
      const queenMesh = units.getQueenMesh()
      if (!queenMesh) return
      const rect = canvas.getBoundingClientRect()
      const ndc = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1,
      )
      raycaster.current.setFromCamera(ndc, sceneManager.camera)
      const hits = raycaster.current.intersectObject(queenMesh)
      if (hits.length > 0 && hits[0].instanceId !== undefined) {
        const tribeId = units.getTribeIdForSlot(hits[0].instanceId)
        if (tribeId !== undefined) {
          const tribe = useGameStore.getState().tribes.find(t => t.id === tribeId)
          if (tribe) {
            setTooltip({ x: e.clientX, y: e.clientY, name: tribe.name, color: tribe.color, units: tribe.units })
            return
          }
        }
      }
      setTooltip(null)
    }

    canvas.addEventListener('mousemove', _handleMouseMove)

    function _handleInit(msg: GameInitMessage) {
      const r = renderersRef.current
      const s = sceneRef.current!.scene

      // Replace placeholder sphere with game sphere (same radius but re-init cleanly)
      r.sphere?.dispose()
      r.units?.dispose()
      r.stones?.dispose()
      r.energy?.dispose()

      r.sphere = new SphereRenderer(s, msg.sphere_radius)
      r.units = new UnitRenderer(s)
      r.stones = new StoneRenderer(s)
      r.energy = new EnergyRenderer(s)
      r.queenVision = new QueenVisionRenderer(s)

      r.stones.setStones(msg.stones, msg.sphere_radius)
      r.energy.setEnergySources(msg.energy_sources ?? [])

      unitTypesRef.current.clear()
      for (const u of msg.units) unitTypesRef.current.set(u.id, u.type)
      r.units.loadSnapshot(msg.units)
      r.queenVision.setFromSnapshot(msg.units)
    }

    function _handleDiff(msg: DiffMessage) {
      const r = renderersRef.current
      if (!r.units) return
      // queenVision must run before units.applyDiff (which deletes from unitTypesRef)
      r.queenVision?.applyDiff(msg.spawned ?? [], msg.died ?? [], unitTypesRef.current)
      r.units.applyDiff(msg.moved ?? [], msg.spawned ?? [], msg.died ?? [], unitTypesRef.current)
      for (const es of msg.energy_spawned ?? []) r.energy?.addSource(es.id, es.pos)
      for (const id of msg.energy_depleted ?? []) r.energy?.removeSource(id)
      for (const pos of msg.hit_flashes ?? []) r.flash?.flash(pos)
    }

    function _handleHistory(msg: EventHistoryMessage) {
      setEventLog(msg.events)
      if (msg.tribe_stats?.length) updateStats(msg.tribe_stats)
    }

    return () => {
      canvas.removeEventListener('mousemove', _handleMouseMove)
      observer.disconnect()
      ws.close()
      sceneManager.dispose()
      renderers.flash?.dispose()
      renderers.units?.dispose()
      renderers.sphere?.dispose()
      renderers.stones?.dispose()
      renderers.energy?.dispose()
      renderers.queenVision?.dispose()
    }
  }, []) // eslint-disable-line

  return (
    <div className="w-full h-full relative">
      {tooltip && (
        <div
          className="fixed z-50 pointer-events-none bg-gray-900/90 border border-gray-700 rounded-lg px-3 py-2 text-xs shadow-lg"
          style={{ left: tooltip.x + 12, top: tooltip.y - 10 }}
        >
          <div className="font-bold mb-1" style={{ color: tooltip.color }}>{tooltip.name}</div>
          <div className="text-gray-300 space-y-0.5">
            <div><span className="text-blue-400">{tooltip.units.worker}</span> workers</div>
            <div><span className="text-red-400">{tooltip.units.attacker}</span> attackers</div>
            <div><span className="text-green-400">{tooltip.units.defender}</span> defenders</div>
            <div><span className="text-purple-400">{tooltip.units.queen}</span> queen</div>
          </div>
        </div>
      )}
      <canvas
        ref={canvasRef}
        className="w-full h-full block"
        style={{ touchAction: 'none' }}
      />
      {loading && !error && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center">
            <div className="text-green-400 text-sm animate-pulse mb-1">Starting game...</div>
            <div className="text-gray-600 text-xs">LLM is naming the tribes</div>
          </div>
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-80">
          <div className="text-red-400 text-sm px-6 text-center">{error}</div>
        </div>
      )}
    </div>
  )
}
