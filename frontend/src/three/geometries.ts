import * as THREE from 'three'

/** Small flat triangle in XZ plane (worker) */
export function createTriangle(size = 12): THREE.BufferGeometry {
  const h = size * Math.sqrt(3) / 2
  const vertices = new Float32Array([
    0,        0,  h * 0.67,
   -size * 0.5, 0, -h * 0.33,
    size * 0.5, 0, -h * 0.33,
  ])
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(vertices, 3))
  geo.setIndex([0, 1, 2])
  geo.computeVertexNormals()
  return geo
}

/** Flat rhombus (attacker) */
export function createRhombus(size = 14): THREE.BufferGeometry {
  const half = size * 0.5
  const vertices = new Float32Array([
    0,    0,  size,
   -half, 0,  0,
    0,    0, -size,
    half, 0,  0,
  ])
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(vertices, 3))
  geo.setIndex([0, 1, 3,  1, 2, 3])
  geo.computeVertexNormals()
  return geo
}

/** Flat hexagon (defender) */
export function createHexagon(size = 16): THREE.BufferGeometry {
  const verts: number[] = [0, 0, 0]
  const indices: number[] = []
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2
    verts.push(Math.sin(a) * size, 0, Math.cos(a) * size)
    indices.push(0, i + 1, i === 5 ? 1 : i + 2)
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(verts), 3))
  geo.setIndex(indices)
  geo.computeVertexNormals()
  return geo
}

/** Flat circle / ring (queen) */
export function createCircle(size = 20, segments = 24): THREE.BufferGeometry {
  const verts: number[] = [0, 0, 0]
  const indices: number[] = []
  for (let i = 0; i < segments; i++) {
    const a = (i / segments) * Math.PI * 2
    verts.push(Math.sin(a) * size, 0, Math.cos(a) * size)
    indices.push(0, i + 1, i === segments - 1 ? 1 : i + 2)
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(verts), 3))
  geo.setIndex(indices)
  geo.computeVertexNormals()
  return geo
}
