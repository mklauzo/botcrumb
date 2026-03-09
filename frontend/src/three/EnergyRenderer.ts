import * as THREE from 'three'

interface SourceData {
  pos: [number, number, number]
  owner: number | null
}

export class EnergyRenderer {
  private scene: THREE.Scene
  private points: THREE.Points | null = null
  private sources: Map<number, SourceData> = new Map()
  private tribeColors: Map<number, THREE.Color> = new Map()

  constructor(scene: THREE.Scene) {
    this.scene = scene
    this._rebuild()
  }

  setTribeColors(tribes: Array<{ id: number; color: string }>) {
    for (const t of tribes) {
      this.tribeColors.set(t.id, new THREE.Color(t.color))
    }
  }

  setEnergySources(sources: Array<{ id: number; pos: [number, number, number]; amount: number; owner_tribe_id?: number | null }>) {
    this.sources.clear()
    for (const s of sources) {
      this.sources.set(s.id, { pos: s.pos, owner: s.owner_tribe_id ?? null })
    }
    this._rebuild()
  }

  addSource(id: number, pos: [number, number, number]) {
    this.sources.set(id, { pos, owner: null })
    this._rebuild()
  }

  removeSource(id: number) {
    this.sources.delete(id)
    this._rebuild()
  }

  claimSource(id: number, tribeId: number) {
    const s = this.sources.get(id)
    if (s && s.owner !== tribeId) {
      s.owner = tribeId
      this._rebuild()
    }
  }

  private _rebuild() {
    if (this.points) {
      this.scene.remove(this.points)
      this.points.geometry.dispose()
      ;(this.points.material as THREE.Material).dispose()
      this.points = null
    }

    if (this.sources.size === 0) return

    const positions: number[] = []
    const colors: number[] = []

    this.sources.forEach(({ pos, owner }) => {
      positions.push(...pos)
      if (owner !== null && this.tribeColors.has(owner)) {
        const c = this.tribeColors.get(owner)!
        colors.push(c.r, c.g, c.b)
      } else {
        colors.push(1, 1, 1)
      }
    })

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3))
    geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(colors), 3))

    const mat = new THREE.PointsMaterial({
      vertexColors: true,
      size: 40,
      sizeAttenuation: true,
    })

    this.points = new THREE.Points(geo, mat)
    this.scene.add(this.points)
  }

  dispose() {
    if (this.points) {
      this.scene.remove(this.points)
      this.points.geometry.dispose()
      ;(this.points.material as THREE.Material).dispose()
    }
  }
}
