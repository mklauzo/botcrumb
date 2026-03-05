import * as THREE from 'three'

interface EnergyData {
  id: number
  pos: [number, number, number]
  amount: number
}

export class EnergyRenderer {
  private scene: THREE.Scene
  private points: THREE.Points | null = null
  private sources: Map<number, [number, number, number]> = new Map()

  constructor(scene: THREE.Scene) {
    this.scene = scene
    this._rebuild()
  }

  setEnergySources(sources: EnergyData[]) {
    this.sources.clear()
    for (const s of sources) {
      this.sources.set(s.id, s.pos)
    }
    this._rebuild()
  }

  addSource(id: number, pos: [number, number, number]) {
    this.sources.set(id, pos)
    this._rebuild()
  }

  removeSource(id: number) {
    this.sources.delete(id)
    this._rebuild()
  }

  private _rebuild() {
    if (this.points) {
      this.scene.remove(this.points)
      this.points.geometry.dispose()
      this.points = null
    }

    const positions: number[] = []
    this.sources.forEach(pos => {
      positions.push(...pos)
    })

    if (positions.length === 0) return

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3))

    const mat = new THREE.PointsMaterial({
      color: 0xffffff,
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
    }
  }
}
