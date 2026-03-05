import * as THREE from 'three'

export class SphereRenderer {
  private mesh: THREE.LineSegments

  constructor(scene: THREE.Scene, radius: number) {
    const geo = new THREE.IcosahedronGeometry(radius, 3)
    const wire = new THREE.WireframeGeometry(geo)
    const mat = new THREE.LineBasicMaterial({
      color: 0x00ff88,
      transparent: true,
      opacity: 0.18,
    })
    this.mesh = new THREE.LineSegments(wire, mat)
    scene.add(this.mesh)
  }

  dispose() {
    this.mesh.removeFromParent()
    this.mesh.geometry.dispose()
    ;(this.mesh.material as THREE.Material).dispose()
  }
}
