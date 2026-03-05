import * as THREE from 'three'

interface StoneData {
  id: number
  center: [number, number, number]
  cap_angle: number
}

export class StoneRenderer {
  private scene: THREE.Scene
  private groups: Map<number, THREE.Group> = new Map()

  constructor(scene: THREE.Scene) {
    this.scene = scene
  }

  setStones(stones: StoneData[], sphereRadius: number) {
    this.groups.forEach(g => this.scene.remove(g))
    this.groups.clear()

    for (const stone of stones) {
      const group = this._createStoneGroup(stone, sphereRadius)
      this.scene.add(group)
      this.groups.set(stone.id, group)
    }
  }

  private _createStoneGroup(stone: StoneData, R: number): THREE.Group {
    const { center, cap_angle } = stone
    const cn = new THREE.Vector3(...center).normalize()

    // Cap base circle radius and height
    const capR = R * Math.sin(cap_angle)
    const capH = R * Math.cos(cap_angle)

    const group = new THREE.Group()
    group.position.copy(cn.clone().multiplyScalar(capH))

    // Orient group so local Y = cn
    const up = new THREE.Vector3(0, 1, 0)
    group.quaternion.setFromUnitVectors(up, cn)

    // Rim circle
    const rimPts: THREE.Vector3[] = []
    const segs = 16
    for (let i = 0; i <= segs; i++) {
      const a = (i / segs) * Math.PI * 2
      rimPts.push(new THREE.Vector3(Math.cos(a) * capR, 0, Math.sin(a) * capR))
    }
    const rimGeo = new THREE.BufferGeometry().setFromPoints(rimPts)
    const rimMat = new THREE.LineBasicMaterial({ color: 0x666666 })
    group.add(new THREE.Line(rimGeo, rimMat))

    // Spokes
    const spokeVerts: number[] = []
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2
      spokeVerts.push(0, 0, 0, Math.cos(a) * capR, 0, Math.sin(a) * capR)
    }
    const spokeGeo = new THREE.BufferGeometry()
    spokeGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(spokeVerts), 3))
    const spokeMat = new THREE.LineBasicMaterial({ color: 0x444444 })
    group.add(new THREE.LineSegments(spokeGeo, spokeMat))

    return group
  }

  dispose() {
    this.groups.forEach(g => this.scene.remove(g))
    this.groups.clear()
  }
}
