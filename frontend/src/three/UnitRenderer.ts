import * as THREE from 'three'
import { createTriangle, createRhombus, createHexagon, createCircle } from './geometries'

const MAX_PER_MESH = 2000
const UNIT_TYPES = ['worker', 'attacker', 'defender', 'queen'] as const
type UnitType = typeof UNIT_TYPES[number]

const UNIT_SIZES: Record<UnitType, number> = {
  worker: 12,
  attacker: 15,
  defender: 17,
  queen: 22,
}

const TRIBE_COLORS = [
  0x00ff88, 0xff0066, 0x00ccff, 0xffcc00,
  0xff6600, 0xcc00ff, 0x00ffcc, 0xff3333,
  0x66ff00, 0xff66cc,
]

function createGeo(type: UnitType): THREE.BufferGeometry {
  const s = UNIT_SIZES[type]
  switch (type) {
    case 'worker':   return createTriangle(s)
    case 'attacker': return createRhombus(s)
    case 'defender': return createHexagon(s)
    case 'queen':    return createCircle(s)
  }
}

interface SlotManager {
  freeSlots: number[]
  unitToSlot: Map<number, number>
  slotToUnit: Map<number, number>
}

function makeSlotManager(): SlotManager {
  return {
    freeSlots: Array.from({ length: MAX_PER_MESH }, (_, i) => MAX_PER_MESH - 1 - i),
    unitToSlot: new Map(),
    slotToUnit: new Map(),
  }
}

export class UnitRenderer {
  private scene: THREE.Scene
  // meshes[unitType] -> single InstancedMesh with per-instance color
  private meshes: Map<UnitType, THREE.InstancedMesh> = new Map()
  private slots: Map<UnitType, SlotManager> = new Map()
  private _dummy = new THREE.Object3D()
  private _up = new THREE.Vector3(0, 1, 0)

  constructor(scene: THREE.Scene) {
    this.scene = scene

    for (const type of UNIT_TYPES) {
      const geo = createGeo(type)
      const mat = new THREE.MeshBasicMaterial({ wireframe: true })
      const mesh = new THREE.InstancedMesh(geo, mat, MAX_PER_MESH)
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
      mesh.count = MAX_PER_MESH

      // Initialize all instances to scale 0 (invisible)
      const zeroMatrix = new THREE.Matrix4().makeScale(0, 0, 0)
      for (let i = 0; i < MAX_PER_MESH; i++) {
        mesh.setMatrixAt(i, zeroMatrix)
        mesh.setColorAt(i, new THREE.Color(0xffffff))
      }
      mesh.instanceMatrix.needsUpdate = true
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true

      this.meshes.set(type, mesh)
      this.slots.set(type, makeSlotManager())
      scene.add(mesh)
    }
  }

  spawnUnit(id: number, tribeId: number, type: string, pos: [number, number, number]) {
    const utype = type as UnitType
    const mesh = this.meshes.get(utype)
    const sm = this.slots.get(utype)
    if (!mesh || !sm) return

    const slot = sm.freeSlots.pop()
    if (slot === undefined) return

    sm.unitToSlot.set(id, slot)
    sm.slotToUnit.set(slot, id)

    const color = new THREE.Color(TRIBE_COLORS[tribeId % TRIBE_COLORS.length])
    mesh.setColorAt(slot, color)
    this._setMatrix(mesh, slot, pos)
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  }

  removeUnit(id: number, type: string) {
    const utype = type as UnitType
    const mesh = this.meshes.get(utype)
    const sm = this.slots.get(utype)
    if (!mesh || !sm) return

    const slot = sm.unitToSlot.get(id)
    if (slot === undefined) return

    sm.unitToSlot.delete(id)
    sm.slotToUnit.delete(slot)
    sm.freeSlots.push(slot)

    // Hide by scaling to 0
    mesh.setMatrixAt(slot, new THREE.Matrix4().makeScale(0, 0, 0))
    mesh.instanceMatrix.needsUpdate = true
  }

  moveUnit(id: number, type: string, pos: [number, number, number]) {
    const utype = type as UnitType
    const mesh = this.meshes.get(utype)
    const sm = this.slots.get(utype)
    if (!mesh || !sm) return

    const slot = sm.unitToSlot.get(id)
    if (slot === undefined) return

    this._setMatrix(mesh, slot, pos)
    mesh.instanceMatrix.needsUpdate = true
  }

  private _setMatrix(mesh: THREE.InstancedMesh, slot: number, pos: [number, number, number]) {
    const p = new THREE.Vector3(...pos)
    const normal = p.clone().normalize()
    const quat = new THREE.Quaternion().setFromUnitVectors(this._up, normal)
    this._dummy.position.copy(p)
    this._dummy.quaternion.copy(quat)
    this._dummy.scale.set(1, 1, 1)
    this._dummy.updateMatrix()
    mesh.setMatrixAt(slot, this._dummy.matrix)
  }

  // Load full snapshot: all units
  loadSnapshot(units: Array<{ id: number; tribe_id: number; type: string; pos: [number, number, number] }>) {
    // Clear all
    this.clearAll()
    for (const u of units) {
      this.spawnUnit(u.id, u.tribe_id, u.type, u.pos)
    }
    // Flush
    Array.from(this.meshes.values()).forEach(mesh => {
      mesh.instanceMatrix.needsUpdate = true
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    })
  }

  // Apply a diff: moved, spawned, died
  applyDiff(
    moved: Array<[number, number, number, number]>,
    spawned: Array<{ id: number; tribe_id: number; type: string; pos: [number, number, number] }>,
    died: number[],
    unitTypes: Map<number, string>
  ) {
    for (const [id, x, y, z] of moved) {
      const type = unitTypes.get(id)
      if (type) this.moveUnit(id, type, [x, y, z])
    }
    for (const u of spawned) {
      this.spawnUnit(u.id, u.tribe_id, u.type, u.pos)
      unitTypes.set(u.id, u.type)
    }
    for (const id of died) {
      const type = unitTypes.get(id)
      if (type) {
        this.removeUnit(id, type)
        unitTypes.delete(id)
      }
    }
  }

  private clearAll() {
    const zero = new THREE.Matrix4().makeScale(0, 0, 0)
    Array.from(this.meshes.entries()).forEach(([type, mesh]) => {
      const sm = this.slots.get(type)!
      sm.unitToSlot.clear()
      sm.slotToUnit.clear()
      sm.freeSlots = Array.from({ length: MAX_PER_MESH }, (_, i) => MAX_PER_MESH - 1 - i)
      for (let i = 0; i < MAX_PER_MESH; i++) {
        mesh.setMatrixAt(i, zero)
      }
      mesh.instanceMatrix.needsUpdate = true
    })
  }

  dispose() {
    Array.from(this.meshes.values()).forEach(mesh => {
      this.scene.remove(mesh)
      mesh.geometry.dispose()
      ;(mesh.material as THREE.Material).dispose()
    })
  }
}
