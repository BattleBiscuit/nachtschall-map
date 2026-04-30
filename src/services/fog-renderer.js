/**
 * Fog Renderer Service
 *
 * Handles canvas-based fog-of-war rendering with mask compositing
 * Ported from vanilla JS map-client.js
 */

export class FogRenderer {
  constructor(canvasElement) {
    this.canvas = canvasElement
    this.ctx = canvasElement.getContext('2d')
    this.maskCanvas = document.createElement('canvas')
    this.maskCtx = this.maskCanvas.getContext('2d')
    this.textureCanvas = document.createElement('canvas')
    this.textureCtx = this.textureCanvas.getContext('2d')

    this.mapImage = null
    this.mapAspectRatio = 1
    this.revealShapes = []
    this.isInitialized = false
    this.currentZoomTransform = { x: 0, y: 0, k: 1 }
    this.fogTextureDims = { x: 0, y: 0, w: 0, h: 0 }

    // Check for canvas filter support (Safari < 18 fallback)
    this.supportsCanvasFilter = typeof this.ctx.filter !== 'undefined'
  }

  /**
   * Initialize the fog renderer with map data
   */
  async init(mapImageDataUrl, mapAspectRatio) {
    if (!mapImageDataUrl) {
      return
    }

    this.mapAspectRatio = mapAspectRatio || 1

    // Load map image
    this.mapImage = await this.loadImage(mapImageDataUrl)

    // Set canvas dimensions (this also generates fog texture)
    this.resizeCanvases()

    this.isInitialized = true
  }

  /**
   * Resize all canvases to match container
   */
  resizeCanvases() {
    const container = this.canvas.parentElement
    if (!container) return

    const width = container.clientWidth
    const height = container.clientHeight


    // Main canvas matches container
    this.canvas.width = width
    this.canvas.height = height

    // Regenerate fog texture with padding (like original)
    this.generateFogTexture(width, height)
  }

  /**
   * Load an image from data URL
   */
  loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = reject
      img.src = src
    })
  }

  /**
   * Generate fog texture with blur (like original)
   */
  async generateFogTexture(mapWidth, mapHeight) {
    if (!this.mapImage) return

    // Add padding to texture (30% on each side) for blur fade
    const fogPadding = 0.3
    const fW = Math.ceil(mapWidth * (1 + fogPadding * 2))
    const fH = Math.ceil(mapHeight * (1 + fogPadding * 2))

    // Store texture dimensions for coordinate offset
    this.fogTextureDims = {
      x: -mapWidth * fogPadding,
      y: -mapHeight * fogPadding,
      w: fW,
      h: fH
    }

    // Resize texture canvas with padding
    this.textureCanvas.width = fW
    this.textureCanvas.height = fH

    // Resize mask canvas to match texture (for blur fade)
    this.maskCanvas.width = fW
    this.maskCanvas.height = fH

    // Fill with parchment color instead of blurred map
    const parchmentColor = '#e8d7b8' // --parchment-default
    this.textureCtx.fillStyle = parchmentColor
    this.textureCtx.fillRect(0, 0, fW, fH)

    // Add paper texture overlay
    this.addPaperTexture(fW, fH)

    // Rebuild mask from existing shapes
    this.rebuildMask()
  }

  /**
   * Add paper texture overlay for aged parchment look
   */
  addPaperTexture(width, height) {
    // Ensure integers for createImageData
    const w = Math.floor(Number(width))
    const h = Math.floor(Number(height))

    // Validate dimensions
    if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) {
      console.error('[FogRenderer] Invalid dimensions for paper texture:', { width, height, w, h })
      return
    }

    this.textureCtx.globalCompositeOperation = 'overlay'

    // Create subtle noise pattern for parchment texture
    const imageData = this.textureCtx.createImageData(w, h)
    const data = imageData.data

    for (let i = 0; i < data.length; i += 4) {
      const noise = Math.random() * 20 + 235 // Lighter noise for parchment
      data[i] = noise
      data[i + 1] = noise - 5 // Slight yellow tint
      data[i + 2] = noise - 10 // More yellow tint
      data[i + 3] = 255
    }

    this.textureCtx.putImageData(imageData, 0, 0)

    // Add subtle vignette darkening at edges (parchment color)
    this.textureCtx.globalCompositeOperation = 'multiply'
    const gradient = this.textureCtx.createRadialGradient(
      w / 2, h / 2, 0,
      w / 2, h / 2, Math.max(w, h) / 1.5
    )
    gradient.addColorStop(0, 'rgba(232, 215, 184, 1)') // --parchment-default
    gradient.addColorStop(0.6, 'rgba(232, 215, 184, 1)')
    gradient.addColorStop(1, 'rgba(201, 183, 156, 1)') // --parchment-dark
    this.textureCtx.fillStyle = gradient
    this.textureCtx.fillRect(0, 0, w, h)

    this.textureCtx.globalCompositeOperation = 'source-over'
  }

  /**
   * Set reveal shapes (fog actions) - used only on initial load
   */
  setRevealShapes(shapes) {
    // Filter out null/invalid shapes
    this.revealShapes = (shapes || []).filter(s => s && s.type)

    // Rebuild the mask from the shapes (only on load, not during drawing)
    if (this.isInitialized) {
      this.rebuildMask()
    }
  }

  /**
   * Add shapes to the existing mask without rebuilding
   */
  addShapesToMask(shapes) {
    shapes.forEach(shape => {
      if (shape.type === 'reveal') {
        this.drawRevealOnMask(shape.x, shape.y, shape.radius)
      } else if (shape.type === 'fog') {
        this.drawFogOnMask(shape.x, shape.y, shape.radius)
      }
    })
  }

  /**
   * Render the fog of war with zoom transform (like original)
   */
  render() {
    if (!this.isInitialized) {
      return
    }

    const { width, height } = this.canvas
    const t = this.currentZoomTransform


    // Clear main canvas
    this.ctx.clearRect(0, 0, width, height)
    this.ctx.save()

    // Apply zoom transform (SVG and canvas share coordinate system)
    this.ctx.translate(t.x, t.y)
    this.ctx.scale(t.k, t.k)

    // Draw pre-blurred fog texture
    this.ctx.globalCompositeOperation = 'source-over'
    this.ctx.drawImage(
      this.textureCanvas,
      this.fogTextureDims.x,
      this.fogTextureDims.y,
      this.fogTextureDims.w,
      this.fogTextureDims.h
    )

    // Keep fog only where maskCanvas is opaque
    this.ctx.globalCompositeOperation = 'destination-in'
    this.ctx.drawImage(
      this.maskCanvas,
      this.fogTextureDims.x,
      this.fogTextureDims.y,
      this.fogTextureDims.w,
      this.fogTextureDims.h
    )

    this.ctx.restore()
    this.ctx.globalCompositeOperation = 'source-over'

  }

  /**
   * Update zoom transform
   */
  setZoomTransform(transform) {
    this.currentZoomTransform = transform
  }

  /**
   * Rebuild the mask from scratch using revealShapes
   */
  rebuildMask() {
    const { width, height } = this.maskCanvas

    // Start with full mask (white = opaque fog everywhere)
    this.maskCtx.fillStyle = 'white'
    this.maskCtx.fillRect(0, 0, width, height)

    // Apply each reveal/fog shape
    this.revealShapes.forEach((shape) => {
      if (!shape || !shape.type) {
        return
      }

      if (shape.type === 'reveal') {
        this.drawRevealOnMask(shape.x, shape.y, shape.radius)
      } else if (shape.type === 'fog') {
        this.drawFogOnMask(shape.x, shape.y, shape.radius)
      }
    })
  }

  /**
   * Paint a soft irregular reveal hole into the mask (torn paper edge)
   */
  drawRevealOnMask(x, y, radius) {
    const mx = x - this.fogTextureDims.x
    const my = y - this.fogTextureDims.y
    this.maskCtx.globalCompositeOperation = 'destination-out'

    // Create irregular polygon with smoother variations (like torn paper)
    const numPoints = 30 + Math.floor(Math.random() * 10)
    this.maskCtx.beginPath()

    for (let i = 0; i <= numPoints; i++) {
      const angle = (i / numPoints) * Math.PI * 2
      const variance = 0.65 + Math.random() * 0.35
      const r = radius * variance
      const angleOffset = (Math.random() - 0.5) * 0.15
      const finalAngle = angle + angleOffset

      const px = mx + Math.cos(finalAngle) * r
      const py = my + Math.sin(finalAngle) * r

      if (i === 0) {
        this.maskCtx.moveTo(px, py)
      } else {
        this.maskCtx.lineTo(px, py)
      }
    }

    this.maskCtx.closePath()
    this.maskCtx.fillStyle = 'rgba(0,0,0,1)'
    this.maskCtx.fill()

    // Add soft feathering on edges
    this.maskCtx.shadowColor = 'rgba(0,0,0,0.4)'
    this.maskCtx.shadowBlur = 5
    this.maskCtx.fill()
    this.maskCtx.shadowBlur = 0

    this.maskCtx.globalCompositeOperation = 'source-over'
  }

  /**
   * Paint fog back into the mask with torn edge style
   */
  drawFogOnMask(x, y, radius) {
    const mx = x - this.fogTextureDims.x
    const my = y - this.fogTextureDims.y
    this.maskCtx.globalCompositeOperation = 'source-over'

    // Create irregular polygon (same style as reveal)
    const numPoints = 30 + Math.floor(Math.random() * 10)
    this.maskCtx.beginPath()

    for (let i = 0; i <= numPoints; i++) {
      const angle = (i / numPoints) * Math.PI * 2
      const variance = 0.65 + Math.random() * 0.35
      const r = radius * variance
      const angleOffset = (Math.random() - 0.5) * 0.15
      const finalAngle = angle + angleOffset

      const px = mx + Math.cos(finalAngle) * r
      const py = my + Math.sin(finalAngle) * r

      if (i === 0) {
        this.maskCtx.moveTo(px, py)
      } else {
        this.maskCtx.lineTo(px, py)
      }
    }

    this.maskCtx.closePath()
    this.maskCtx.fillStyle = 'rgba(255,255,255,1)'
    this.maskCtx.fill()

    // Add soft feathering to match reveal
    this.maskCtx.shadowColor = 'rgba(255,255,255,0.4)'
    this.maskCtx.shadowBlur = 5
    this.maskCtx.fill()
    this.maskCtx.shadowBlur = 0

    this.maskCtx.globalCompositeOperation = 'source-over'
  }


  /**
   * Add a reveal shape (no render - caller should schedule render)
   */
  addRevealShape(x, y, radius) {
    this.drawRevealOnMask(x, y, radius)
  }

  /**
   * Add a fog shape (no render - caller should schedule render)
   */
  addFogShape(x, y, radius) {
    this.drawFogOnMask(x, y, radius)
  }

  /**
   * Clear all fog (reveal entire map)
   */
  clearFog() {
    this.revealShapes = []
    this.render()
  }

  /**
   * Reset to full fog
   */
  resetFog() {
    this.revealShapes = []
    this.render()
  }
}
