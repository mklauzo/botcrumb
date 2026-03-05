import * as THREE from 'three'

const POOL_SIZE = 200
const FLASH_DURATION = 100  // ms

interface FlashInstance {
  sprite: THREE.Sprite
  expiry: number
}

export class HitFlash {
  private scene: THREE.Scene
  private pool: THREE.Sprite[] = []
  private active: FlashInstance[] = []

  constructor(scene: THREE.Scene) {
    this.scene = scene
    const mat = new THREE.SpriteMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.9,
      sizeAttenuation: true,
    })
    for (let i = 0; i < POOL_SIZE; i++) {
      const sprite = new THREE.Sprite(mat.clone())
      sprite.scale.set(80, 80, 1)
      sprite.visible = false
      scene.add(sprite)
      this.pool.push(sprite)
    }
  }

  flash(pos: [number, number, number]) {
    const sprite = this.pool.find(s => !s.visible) || this.pool[0]
    sprite.position.set(...pos)
    sprite.visible = true
    this.active.push({ sprite, expiry: performance.now() + FLASH_DURATION })
  }

  update() {
    const now = performance.now()
    this.active = this.active.filter(f => {
      if (now > f.expiry) {
        f.sprite.visible = false
        return false
      }
      // Fade out
      const t = (f.expiry - now) / FLASH_DURATION
      ;(f.sprite.material as THREE.SpriteMaterial).opacity = t * 0.9
      return true
    })
  }

  dispose() {
    this.pool.forEach(s => {
      this.scene.remove(s)
      ;(s.material as THREE.Material).dispose()
    })
  }
}
