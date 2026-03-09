import * as THREE from 'three'

const SPHERE_RADIUS = 6000
const SEGMENTS = 96

const TRIBE_COLORS = [
  0x00ff88, 0xff0066, 0x00ccff, 0xffcc00,
  0xff6600, 0xcc00ff, 0x00ffcc, 0xff3333,
  0x66ff00, 0xff66cc,
]

function visionCirclePoints(pos: [number, number, number], visionRadius: number): THREE.Vector3[] {
  const p = new THREE.Vector3(...pos)
  const q = p.clone().normalize()

  const arb = Math.abs(q.x) < 0.9
    ? new THREE.Vector3(1, 0, 0)
    : new THREE.Vector3(0, 1, 0)
  const t = arb.clone().sub(q.clone().multiplyScalar(arb.dot(q))).normalize()
  const b = new THREE.Vector3().crossVectors(q, t)

  const theta = visionRadius / SPHERE_RADIUS
  const cosT = Math.cos(theta)
  const sinT = Math.sin(theta)

  const points: THREE.Vector3[] = []
  for (let i = 0; i <= SEGMENTS; i++) {
    const phi = (i / SEGMENTS) * Math.PI * 2
    const dir = t.clone().multiplyScalar(Math.cos(phi))
      .add(b.clone().multiplyScalar(Math.sin(phi)))
    const pt = q.clone().multiplyScalar(cosT)
      .add(dir.multiplyScalar(sinT))
      .multiplyScalar(SPHERE_RADIUS)
    points.push(pt)
  }
  return points
}

export class QueenVisionRenderer {
  private scene: THREE.Scene
  private circles: Map<number, THREE.Line> = new Map()   // queenId → line
  private queenPos: Map<number, [number, number, number]> = new Map()  // queenId → pos
  private queenTribe: Map<number, number> = new Map()    // queenId → tribeId
  private tribeQueen: Map<number, number> = new Map()    // tribeId → queenId
  private tribeVision: Map<number, number> = new Map()   // tribeId → vision radius

  constructor(scene: THREE.Scene) {
    this.scene = scene
  }

  setFromSnapshot(
    units: Array<{ id: number; tribe_id: number; type: string; pos: [number, number, number] }>,
    tribeVisionMap?: Map<number, number>,
  ) {
    this.clear()
    for (const u of units) {
      if (u.type === 'queen') {
        const radius = tribeVisionMap?.get(u.tribe_id) ?? 800
        this.tribeVision.set(u.tribe_id, radius)
        this.queenPos.set(u.id, u.pos)
        this.queenTribe.set(u.id, u.tribe_id)
        this.tribeQueen.set(u.tribe_id, u.id)
        this._addCircle(u.id, u.tribe_id, u.pos, radius)
      }
    }
  }

  applyDiff(
    spawned: Array<{ id: number; tribe_id: number; type: string; pos: [number, number, number] }>,
    died: number[],
    unitTypes: Map<number, string>,
  ) {
    for (const id of died) {
      if (unitTypes.get(id) === 'queen') this._removeCircle(id)
    }
    for (const u of spawned) {
      if (u.type === 'queen') {
        const radius = this.tribeVision.get(u.tribe_id) ?? 800
        this.queenPos.set(u.id, u.pos)
        this.queenTribe.set(u.id, u.tribe_id)
        this.tribeQueen.set(u.tribe_id, u.id)
        this._addCircle(u.id, u.tribe_id, u.pos, radius)
      }
    }
  }

  updateVisionRadii(tribeStats: Array<{ id: number; vision_radius?: number }>) {
    for (const ts of tribeStats) {
      if (ts.vision_radius === undefined) continue
      if (this.tribeVision.get(ts.id) === ts.vision_radius) continue
      this.tribeVision.set(ts.id, ts.vision_radius)
      const queenId = this.tribeQueen.get(ts.id)
      if (queenId === undefined) continue
      const pos = this.queenPos.get(queenId)
      if (!pos) continue
      this._removeCircle(queenId)
      this._addCircle(queenId, ts.id, pos, ts.vision_radius)
    }
  }

  private _addCircle(queenId: number, tribeId: number, pos: [number, number, number], radius: number) {
    const base = new THREE.Color(TRIBE_COLORS[tribeId % TRIBE_COLORS.length])
    const bright = base.clone().multiplyScalar(2)
    const geo = new THREE.BufferGeometry().setFromPoints(visionCirclePoints(pos, radius))
    const mat = new THREE.LineBasicMaterial({ color: bright, transparent: true, opacity: 0.5 })
    const line = new THREE.Line(geo, mat)
    this.scene.add(line)
    this.circles.set(queenId, line)
  }

  private _removeCircle(queenId: number) {
    const line = this.circles.get(queenId)
    if (!line) return
    this.scene.remove(line)
    line.geometry.dispose()
    ;(line.material as THREE.Material).dispose()
    this.circles.delete(queenId)
    const tribeId = this.queenTribe.get(queenId)
    if (tribeId !== undefined) this.tribeQueen.delete(tribeId)
    this.queenTribe.delete(queenId)
    this.queenPos.delete(queenId)
  }

  clear() {
    for (const id of Array.from(this.circles.keys())) this._removeCircle(id)
  }

  dispose() {
    this.clear()
  }
}
