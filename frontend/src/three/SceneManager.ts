import * as THREE from 'three'

export class SceneManager {
  public scene: THREE.Scene
  public camera: THREE.PerspectiveCamera
  public renderer: THREE.WebGLRenderer
  public controls: any  // OrbitControls loaded dynamically
  private animFrameId: number | null = null
  private onRender: (() => void) | null = null

  constructor(canvas: HTMLCanvasElement) {
    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(0x000000)

    const w = canvas.clientWidth || window.innerWidth
    const h = canvas.clientHeight || window.innerHeight

    this.camera = new THREE.PerspectiveCamera(60, w / h, 1, 100000)
    this.camera.position.set(0, 0, 18000)

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.setSize(w, h)

    // Load OrbitControls dynamically to avoid SSR/bundler issues
    import('three/examples/jsm/controls/OrbitControls.js').then(({ OrbitControls }) => {
      this.controls = new OrbitControls(this.camera, canvas)
      this.controls.enableDamping = true
      this.controls.dampingFactor = 0.05
      this.controls.minDistance = 7000
      this.controls.maxDistance = 50000
    })
  }

  setRenderCallback(cb: () => void) {
    this.onRender = cb
  }

  start() {
    const loop = () => {
      this.animFrameId = requestAnimationFrame(loop)
      this.controls?.update()
      this.onRender?.()
      this.renderer.render(this.scene, this.camera)
    }
    loop()
  }

  handleResize(width: number, height: number) {
    if (width === 0 || height === 0) return
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(width, height)
  }

  dispose() {
    if (this.animFrameId !== null) cancelAnimationFrame(this.animFrameId)
    this.controls?.dispose()
    this.renderer.dispose()
  }
}
