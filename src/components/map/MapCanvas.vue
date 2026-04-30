<template>
  <div ref="mapContainer" class="map-canvas-container" :style="{ clipPath: clipPath }">
    <!-- SVG for map image + D3 zoom -->
    <svg
      ref="svgElement"
      class="map-svg"
      :viewBox="`0 0 ${mapWidth} ${mapHeight}`"
      preserveAspectRatio="none"
      @mousedown="handleMouseDown"
      @mousemove="handleMouseMove"
      @mouseup="handleMouseUp"
      @mouseleave="handleMouseLeave"
      @dblclick="handleMapDoubleClick"
      @contextmenu="handleMapRightClick"
    >
      <g ref="mapGroup">
        <image
          v-if="mapImageDataUrl"
          :href="mapImageDataUrl"
          :x="0"
          :y="0"
          :width="mapWidth"
          :height="mapHeight"
          @load="handleImageLoad"
        />

        <!-- Drawings -->
        <path
          v-for="drawing in drawings"
          :key="drawing.id"
          :d="drawing.pathData"
          :stroke="drawing.color"
          :stroke-width="drawing.strokeWidth"
          fill="none"
          stroke-linecap="round"
          stroke-linejoin="round"
        />

        <!-- Current drawing in progress -->
        <path
          v-if="currentDrawing"
          :d="currentDrawing"
          :stroke="currentMarkerColor"
          :stroke-width="3"
          fill="none"
          stroke-linecap="round"
          stroke-linejoin="round"
          opacity="0.8"
        />

        <!-- Markers -->
        <MapMarker
          v-for="marker in markers"
          :key="marker.id"
          :marker="marker"
          @update="handleUpdateMarker"
          @editName="handleEditMarkerName"
          @remove="handleRemoveMarker"
          @dragStart="isMarkerDragging = true"
          @dragEnd="isMarkerDragging = false"
        />

        <!-- Brush indicator - inside transformed group -->
        <circle
          v-if="brushIndicator"
          :cx="brushIndicator.x"
          :cy="brushIndicator.y"
          :r="brushIndicator.r"
          class="brush-indicator"
        />
      </g>
    </svg>

    <!-- Canvas for fog-of-war -->
    <canvas ref="fogCanvas" class="fog-canvas"></canvas>

    <!-- Marker name edit dialog -->
    <MarkerNameDialog
      :open="editingMarkerId !== null"
      :markerName="editingMarkerName"
      @confirm="handleMarkerNameConfirm"
      @cancel="editingMarkerId = null"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import * as d3 from 'd3'
import { useRoomStore } from '@/stores/room'
import { useSocketStore } from '@/stores/socket'
import { useUiStore } from '@/stores/ui'
import { useD3Map } from '@/composables/useD3Map'
import { useFogCanvas } from '@/composables/useFogCanvas'
import { useCoordinates } from '@/composables/useCoordinates'
import { useTornEdges } from '@/composables/useTheme'
import MapMarker from './MapMarker.vue'
import MarkerNameDialog from './MarkerNameDialog.vue'

const roomStore = useRoomStore()
const socketStore = useSocketStore()
const uiStore = useUiStore()

const mapContainer = ref(null)
const svgElement = ref(null)
const fogCanvas = ref(null)
const mapGroup = ref(null)

const brushIndicator = ref(null)
const clickTimeout = ref(null)
const clickCount = ref(0)
const isDragging = ref(false)
const dragStartPos = ref(null)
const isMarkerDragging = ref(false)
const editingMarkerId = ref(null)
const editingMarkerName = computed(() => {
  if (!editingMarkerId.value) return ''
  const marker = markers.value.find(m => m.id === editingMarkerId.value)
  return marker?.name || ''
})

const mapImageDataUrl = computed(() => roomStore.mapImageDataUrl)
const revealRadius = computed(() => uiStore.revealRadius)
const currentMarkerColor = computed(() => uiStore.currentMarkerColor)
const markers = computed(() => (roomStore.markers || []).filter(m => m && m.id))
const drawings = computed(() => roomStore.drawings || [])
const activeTool = computed(() => uiStore.activeTool)

// Drawing state
const isDrawing = ref(false)
const drawingPoints = ref([])
const currentDrawing = ref(null)

// Calculate map dimensions
const mapWidth = ref(800)
const mapHeight = ref(600)

// Initialize composables
const { initD3Zoom } = useD3Map(svgElement, mapGroup)
const { initFogCanvas, drawReveal, drawFog, commitPendingShapes } = useFogCanvas(fogCanvas)
const { normalize } = useCoordinates()
const { clipPath } = useTornEdges()

onMounted(() => {
  // Wait for container to be sized
  setTimeout(() => {
    updateMapDimensions()
    initD3Zoom()
  }, 100)
})

function updateMapDimensions() {
  if (!mapContainer.value) return

  const containerWidth = mapContainer.value.clientWidth
  const aspectRatio = roomStore.mapAspectRatio || 1.33

  if (containerWidth === 0) {
    setTimeout(updateMapDimensions, 100)
    return
  }

  // Map takes full container width
  mapWidth.value = containerWidth

  // Height calculated from aspect ratio
  mapHeight.value = containerWidth / aspectRatio


  // Store map dimensions in UI store
  uiStore.setMapDimensions({
    x: 0,
    y: 0,
    width: mapWidth.value,
    height: mapHeight.value
  })
}

async function handleImageLoad(event) {

  // Get actual image dimensions from the SVG image element
  const img = event.target

  // For SVG images, we need to wait for the actual image to load
  const actualImage = new Image()
  actualImage.onload = () => {
    const actualWidth = actualImage.naturalWidth
    const actualHeight = actualImage.naturalHeight

    if (actualWidth && actualHeight) {
      // Calculate actual aspect ratio from image
      const actualAspectRatio = actualWidth / actualHeight

      // Update room store with actual aspect ratio
      roomStore.mapAspectRatio = actualAspectRatio


      // Recalculate map dimensions with correct aspect ratio
      updateMapDimensions()

      // Initialize fog canvas now that map is loaded
      setTimeout(() => {
        initFogCanvas()
      }, 300)
    }
  }
  actualImage.src = mapImageDataUrl.value
}

function getMousePosition(event) {
  // Use d3.pointer to get coordinates relative to the transformed group
  // This automatically handles zoom/pan transforms
  const [x, y] = d3.pointer(event, mapGroup.value)


  return { x, y }
}

function handleMouseMove(event) {
  const pos = getMousePosition(event)

  // If currently drawing, add point to path
  if (isDrawing.value && event.buttons === 1) {
    drawingPoints.value.push(pos)
    // Build smooth path using quadratic curves
    if (drawingPoints.value.length > 1) {
      currentDrawing.value = buildSmoothPath(drawingPoints.value)
    }
    return
  }

  // Get current zoom scale
  const transform = mapGroup.value.getCTM()
  const scale = transform.a // a is the x-scale factor

  // Scale the brush radius inversely to zoom (so it appears constant size)
  const scaledRadius = revealRadius.value / scale

  // Only show if within map bounds
  if (pos.x >= 0 && pos.x <= mapWidth.value &&
      pos.y >= 0 && pos.y <= mapHeight.value) {
    brushIndicator.value = {
      x: pos.x,
      y: pos.y,
      r: scaledRadius
    }

    // Check if we're dragging (left button down and moved)
    if (dragStartPos.value && event.buttons === 1 && activeTool.value !== 'draw') {
      const dx = pos.x - dragStartPos.value.x
      const dy = pos.y - dragStartPos.value.y
      const distance = Math.sqrt(dx * dx + dy * dy)

      // If moved more than 5 pixels, start dragging
      if (distance > 5) {
        isDragging.value = true
      }

      // If dragging, reveal fog continuously (pass isDragging=true)
      if (isDragging.value) {
        drawReveal(pos.x, pos.y, true)
      }
    }
  } else {
    brushIndicator.value = null
  }
}

function handleMouseDown(event) {
  // Only handle left button (button === 0)
  if (event.button !== 0) return

  // Don't start fog drag if we're dragging a marker
  if (isMarkerDragging.value) return

  const pos = getMousePosition(event)

  // If in draw mode, start drawing
  if (activeTool.value === 'draw') {
    isDrawing.value = true
    drawingPoints.value = [pos]
    currentDrawing.value = `M ${pos.x} ${pos.y}`
    return
  }

  dragStartPos.value = pos
  isDragging.value = false // Not dragging yet, wait for movement
}

function handleMouseUp(event) {
  // Only handle left button
  if (event.button !== 0) return

  const pos = getMousePosition(event)

  // If we were drawing, finish the drawing
  if (isDrawing.value) {
    finishDrawing()
    return
  }

  // If we didn't move (or moved very little), treat as click
  if (!isDragging.value && dragStartPos.value) {
    const dx = pos.x - dragStartPos.value.x
    const dy = pos.y - dragStartPos.value.y
    const distance = Math.sqrt(dx * dx + dy * dy)

    // If distance is small (< 5 pixels), treat as click not drag
    if (distance < 5) {
      handleSingleClick(event)
    }
  }

  // If we were dragging, commit all pending fog shapes
  if (isDragging.value) {
    commitPendingShapes()
  }

  isDragging.value = false
  dragStartPos.value = null
}

function handleMouseLeave() {
  brushIndicator.value = null
  isDragging.value = false
  dragStartPos.value = null

  // Cancel drawing if mouse leaves
  if (isDrawing.value) {
    isDrawing.value = false
    drawingPoints.value = []
    currentDrawing.value = null
  }
}

function handleSingleClick(event) {
  clickCount.value++

  if (clickTimeout.value) {
    clearTimeout(clickTimeout.value)
  }

  clickTimeout.value = setTimeout(() => {
    if (clickCount.value === 1) {
      const pos = getMousePosition(event)
      // Single click - reveal fog (isDragging=false, saves immediately)
      drawReveal(pos.x, pos.y, false)
    }
    clickCount.value = 0
  }, 250) // Wait 250ms to detect double-click
}

function handleMapDoubleClick(event) {
  event.preventDefault()
  clickCount.value = 0
  clearTimeout(clickTimeout.value)

  const pos = getMousePosition(event)
  const { nx, ny } = normalize(pos.x, pos.y)

  // Double click - add marker
  const marker = {
    id: `marker-${Date.now()}`,
    nx,
    ny,
    color: currentMarkerColor.value,
    name: ''
  }

  roomStore.addMarker(marker)
  socketStore.emitAction(roomStore.roomId, {
    type: 'markerAdd',
    data: marker
  })

}

function handleMapRightClick(event) {
  event.preventDefault()

  const pos = getMousePosition(event)

  // Right click - add fog
  drawFog(pos.x, pos.y)

}

function buildSmoothPath(points) {
  if (points.length < 2) return ''

  let path = `M ${points[0].x} ${points[0].y}`

  // Use quadratic bezier curves for smooth drawing
  for (let i = 1; i < points.length; i++) {
    const curr = points[i]
    const prev = points[i - 1]

    // Control point is the midpoint
    const midX = (prev.x + curr.x) / 2
    const midY = (prev.y + curr.y) / 2

    if (i === 1) {
      path += ` L ${midX} ${midY}`
    } else {
      path += ` Q ${prev.x} ${prev.y} ${midX} ${midY}`
    }
  }

  // End with final point
  const last = points[points.length - 1]
  path += ` L ${last.x} ${last.y}`

  return path
}

function finishDrawing() {
  if (drawingPoints.value.length < 2) {
    // Too short, cancel
    isDrawing.value = false
    drawingPoints.value = []
    currentDrawing.value = null
    return
  }

  // Create drawing object
  const drawing = {
    id: `drawing-${Date.now()}`,
    pathData: currentDrawing.value,
    color: currentMarkerColor.value,
    strokeWidth: 3,
    points: drawingPoints.value
  }

  // Add to store
  roomStore.addDrawing(drawing)

  // Emit to server
  socketStore.emitAction(roomStore.roomId, {
    type: 'drawingAdd',
    data: drawing
  })

  // Reset drawing state
  isDrawing.value = false
  drawingPoints.value = []
  currentDrawing.value = null
}

function handleUpdateMarker(updates) {
  roomStore.updateMarker(updates.id, updates)
  socketStore.emitAction(roomStore.roomId, {
    type: 'markerUpdate',
    data: updates
  })
}

function handleEditMarkerName(markerId) {
  editingMarkerId.value = markerId
}

function handleMarkerNameConfirm(newName) {
  if (editingMarkerId.value) {
    handleUpdateMarker({
      id: editingMarkerId.value,
      name: newName
    })
  }
  editingMarkerId.value = null
}

function handleRemoveMarker(markerId) {
  roomStore.removeMarker(markerId)
  socketStore.emitAction(roomStore.roomId, {
    type: 'markerRemove',
    data: { id: markerId }
  })
}
</script>

<style scoped>
.map-canvas-container {
  position: relative;
  width: 100%;
  max-height: 100%; /* Respect parent grid cell height */
  height: v-bind('mapHeight + "px"');
  overflow: hidden;
}

.map-svg {
  display: block;
  width: 100%;
  height: 100%;
  cursor: crosshair;
}

.fog-canvas {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 10;
}

.brush-indicator {
  fill: rgba(255, 215, 0, 0.2);
  stroke: rgba(255, 215, 0, 0.8);
  stroke-width: 2;
  pointer-events: none;
}
</style>
