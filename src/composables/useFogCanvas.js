/**
 * useFogCanvas Composable
 *
 * Wraps FogRenderer service for Vue components
 */

import { onMounted, onUnmounted, watch } from 'vue'
import { FogRenderer } from '@/services/fog-renderer'
import { FogOptimizer } from '@/services/fog-optimizer'
import { useRoomStore } from '@/stores/room'
import { useSocketStore } from '@/stores/socket'
import { useUiStore } from '@/stores/ui'

export function useFogCanvas(canvasRef) {
  const roomStore = useRoomStore()
  const socketStore = useSocketStore()
  const uiStore = useUiStore()

  let renderer = null
  let renderPending = false
  let pendingShapes = [] // Shapes drawn but not yet saved
  let lastShapePos = { x: -1, y: -1 }
  let minShapeDistance = 40 // Minimum viewBox units between fog shapes (optimized for performance/quality)
  let lastRenderTime = 0
  let minRenderInterval = 50 // Minimum ms between renders

  const fogOptimizer = new FogOptimizer()
  let shapesSinceOptimization = 0
  const OPTIMIZE_THRESHOLD = 200

  async function initFogCanvas() {
    if (!canvasRef.value) {
      return
    }

    renderer = new FogRenderer(canvasRef.value)

    // Initialize with map data
    if (roomStore.mapUrl) {
      try {
        await renderer.init(roomStore.mapUrl, roomStore.mapAspectRatio)

        // Resize canvases to match container
        renderer.resizeCanvases()

        // Load shapes from store (rebuilds mask)
        renderer.setRevealShapes(roomStore.revealShapes)
        renderer.render()
      } catch (error) {
        console.error('[useFogCanvas] Failed to initialize fog canvas:', error)
      }
    }
  }

  function renderFog(shouldRebuildMask = false) {
    if (!renderer) return

    if (shouldRebuildMask) {
      // Only rebuild mask when explicitly needed (e.g., loading from server)
      renderer.setRevealShapes(roomStore.revealShapes)
    }

    renderer.render()
  }

  function scheduleRender() {
    if (renderPending) return

    const now = Date.now()
    const timeSinceLastRender = now - lastRenderTime

    // Throttle renders to max 20fps during drag
    if (timeSinceLastRender < minRenderInterval) {
      return
    }

    renderPending = true
    requestAnimationFrame(() => {
      if (renderer) {
        renderer.render()
        lastRenderTime = Date.now()
      }
      renderPending = false
    })
  }

  function commitPendingShapes() {
    if (pendingShapes.length === 0) {
      return
    }

    // Add all shapes to store and emit to server
    pendingShapes.forEach((shape) => {
      roomStore.addRevealShape(shape)
      socketStore.emitAction(roomStore.roomId, {
        type: shape.type,
        data: shape
      })
    })

    shapesSinceOptimization += pendingShapes.length

    // Auto-optimize at threshold
    if (shapesSinceOptimization >= OPTIMIZE_THRESHOLD) {
      optimizeFogShapes()
      shapesSinceOptimization = 0
    }

    pendingShapes = []
    lastShapePos = { x: -1, y: -1 }
  }

  function optimizeFogShapes() {
    const currentShapes = roomStore.revealShapes
    const optimized = fogOptimizer.optimizeShapes(currentShapes)

    if (optimized.length < currentShapes.length) {
      console.log(`[useFogCanvas] Optimizing: ${currentShapes.length} → ${optimized.length}`)

      // Replace with optimized shapes
      roomStore.revealShapes = optimized

      // Rebuild fog mask
      renderer.setRevealShapes(optimized)
      renderer.render()

      // Sync to server
      socketStore.emitAction(roomStore.roomId, {
        type: 'fogOptimize',
        data: { shapes: optimized }
      })
    }
  }

  function drawReveal(x, y, isDragging = false) {
    if (!renderer) return

    const radius = uiStore.revealRadius

    // Check distance from last shape
    const dx = x - lastShapePos.x
    const dy = y - lastShapePos.y
    const distance = Math.sqrt(dx * dx + dy * dy)

    // Only create shape if we've moved enough distance or it's the first shape
    const shouldCreateShape = distance >= minShapeDistance || lastShapePos.x === -1

    if (shouldCreateShape) {
      // Add to renderer for visual feedback
      renderer.addRevealShape(x, y, radius)

      // Schedule a render (throttled)
      scheduleRender()

      // Track the shape
      const shape = { type: 'reveal', x, y, radius }
      pendingShapes.push(shape)
      lastShapePos = { x, y }

      // If not dragging (single click), commit immediately
      if (!isDragging) {
        commitPendingShapes()
      }
    }
  }

  function drawFog(x, y, isDragging = false) {
    if (!renderer) return

    const radius = uiStore.revealRadius

    // Check distance from last shape
    const dx = x - lastShapePos.x
    const dy = y - lastShapePos.y
    const distance = Math.sqrt(dx * dx + dy * dy)

    // Only create shape if we've moved enough distance or it's the first shape
    const shouldCreateShape = distance >= minShapeDistance || lastShapePos.x === -1

    if (shouldCreateShape) {
      // Add to renderer for visual feedback
      renderer.addFogShape(x, y, radius)

      // Schedule a render
      scheduleRender()

      // Track the shape
      const shape = { type: 'fog', x, y, radius }
      pendingShapes.push(shape)
      lastShapePos = { x, y }

      // If not dragging (single click), commit immediately
      if (!isDragging) {
        commitPendingShapes()
      }
    }
  }

  function handleResize() {
    if (!renderer) return

    renderer.resizeCanvases()
    renderer.render()
  }

  // Watch for fog shapes received from other clients
  watch(() => roomStore.lastReceivedFogShape, (shape) => {
    if (!renderer || !shape) return

    // Draw the shape to the mask
    if (shape.type === 'reveal') {
      renderer.addRevealShape(shape.x, shape.y, shape.radius)
    } else if (shape.type === 'fog') {
      renderer.addFogShape(shape.x, shape.y, shape.radius)
    }

    // Re-render to show changes
    renderer.render()
  })

  // Watch for undo/redo - rebuild entire mask
  watch(() => roomStore.fogRebuildTrigger, () => {
    if (!renderer) return

    // Rebuild mask from all shapes in store
    renderer.setRevealShapes(roomStore.revealShapes)
    renderer.render()
  })

  // Note: Zoom watch removed - with fixed viewBox, CSS handles all scaling
  // No need to re-render fog on zoom changes

  onMounted(() => {
    // Don't auto-init here - wait for map to load
    // initFogCanvas will be called from MapCanvas after image loads

    // Handle window resize
    window.addEventListener('resize', handleResize)
  })

  onUnmounted(() => {
    window.removeEventListener('resize', handleResize)

    // Commit any pending shapes
    commitPendingShapes()
  })

  return {
    initFogCanvas,
    renderFog,
    drawReveal,
    drawFog,
    commitPendingShapes,
    optimizeFogShapes
  }
}
