import * as THREE from 'three'

const QUEEN_VISION = 1500.0
const SPHERE_RADIUS = 6000
const SEGMENTS = 96

const TRIBE_COLORS = [
  0x00ff88, 0xff0066, 0x00ccff, 0xffcc00,
  0xff6600, 0xcc00ff, 0x00ffcc, 0xff3333,
  0x66ff00, 0xff66cc,
]

/** Compute 3D points of a small circle on the sphere at geodesic distance QUEEN_VISION from pos. */
function visionCirclePoints(pos: [number, number, number]): THREE.Vector3[] {
  const p = new THREE.Vector3(...pos)
  const q = p.clone().normalize()

  // Orthonormal tangent basis
  const arb = Math.abs(q.x) < 0.9
    ? new THREE.Vector3(1, 0, 0)
    : new THREE.Vector3(0, 1, 0)
  const t = arb.clone().sub(q.clone().multiplyScalar(arb.dot(q))).normalize()
  const b = new THREE.Vector3().crossVectors(q, t)

  const theta = QUEEN_VISION / SPHERE_RADIUS
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
  private circles: Map<number, THREE.Line> = new Map()

  constructor(scene: THREE.Scene) {
    this.scene = scene
  }

  setFromSnapshot(units: Array<{ id: number; tribe_id: number; type: string; pos: [number, number, number] }>) {
    this.clear()
    for (const u of units) {
      if (u.type === 'queen') this._addCircle(u.id, u.tribe_id, u.pos)
    }
  }

  applyDiff(
    spawned: Array<{ id: number; tribe_id: number; type: string; pos: [number, number, number] }>,
    died: number[],
    unitTypes: Map<number, string>
  ) {
    // Process died before unitTypes are mutated
    for (const id of died) {
      if (unitTypes.get(id) === 'queen') this._removeCircle(id)
    }
    for (const u of spawned) {
      if (u.type === 'queen') this._addCircle(u.id, u.tribe_id, u.pos)
    }
  }

  private _addCircle(queenId: number, tribeId: number, pos: [number, number, number]) {
    const base = new THREE.Color(TRIBE_COLORS[tribeId % TRIBE_COLORS.length])
    // Twice as bright: multiply RGB by 2 (clamps at 1.0 per channel)
    const bright = base.clone().multiplyScalar(2)

    const geo = new THREE.BufferGeometry().setFromPoints(visionCirclePoints(pos))
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
  }

  clear() {
    for (const id of Array.from(this.circles.keys())) this._removeCircle(id)
  }

  dispose() {
    this.clear()
  }
}
