<template>
  <div
    ref="mapContainer"
    class="map-canvas-container"
    :style="{ clipPath: clipPath }"
    @mousedown="handleMouseDown"
    @mousemove="handleMouseMove"
    @mouseup="handleMouseUp"
    @mouseleave="handleMouseLeave"
    @dblclick="handleMapDoubleClick"
    @contextmenu.prevent
  >
    <!-- SVG for map image + D3 zoom -->
    <svg
      ref="svgElement"
      class="map-svg"
      :viewBox="`0 0 1000 ${1000 / mapAspectRatio}`"
      preserveAspectRatio="xMidYMid meet"
    >
      <g ref="mapGroup">
        <image
          v-if="mapUrl"
          :href="mapUrl"
          x="0"
          y="0"
          :width="1000"
          :height="1000 / mapAspectRatio"
          preserveAspectRatio="xMidYMid meet"
          @load="handleImageLoad"
        />

        <!-- Fog canvas embedded in SVG via foreignObject -->
        <foreignObject x="0" y="0" width="1000" height="1000">
          <canvas
            ref="fogCanvas"
            xmlns="http://www.w3.org/1999/xhtml"
            width="1000"
            height="1000"
            style="display: block; width: 1000px; height: 1000px;"
          />
        </foreignObject>

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

const mapUrl = computed(() => roomStore.mapUrl)
const mapAspectRatio = computed(() => roomStore.mapAspectRatio)
const revealRadius = computed(() => uiStore.revealRadius)
const currentMarkerColor = computed(() => uiStore.currentMarkerColor)
const markers = computed(() => (roomStore.markers || []).filter(m => m && m.id))
const drawings = computed(() => roomStore.drawings || [])
const revealShapes = computed(() => roomStore.revealShapes || [])
const activeTool = computed(() => uiStore.activeTool)

// Drawing state
const isDrawing = ref(false)
const drawingPoints = ref([])
const currentDrawing = ref(null)

// Initialize composables
const { initD3Zoom } = useD3Map(svgElement, mapGroup)
const { initFogCanvas, drawReveal, drawFog, commitPendingShapes } = useFogCanvas(fogCanvas)
const { clipPath } = useTornEdges()

onMounted(() => {
  // Wait for D3 to be ready
  setTimeout(() => {
    initD3Zoom()
  }, 100)
})

async function handleImageLoad(event) {
  // Map is loaded - initialize fog and zoom
  setTimeout(() => {
    initFogCanvas()
    initD3Zoom()
  }, 300)
}

function getMousePosition(event) {
  // Get mouse position in transformed mapGroup coordinates
  // Everything is in this coordinate space now (fog, markers, drawings, brush)
  const [x, y] = d3.pointer(event, mapGroup.value)
  return { x, y }
}

function handleMouseMove(event) {
  const pos = getMousePosition(event)  // Transformed coordinates - same for everything

  // If currently drawing, add point to path
  if (isDrawing.value && event.buttons === 1) {
    drawingPoints.value.push(pos)
    // Build smooth path using quadratic curves
    if (drawingPoints.value.length > 1) {
      currentDrawing.value = buildSmoothPath(drawingPoints.value)
    }
    return
  }

  // Show brush indicator (no bounds check - indicator transforms with group)
  brushIndicator.value = {
    x: pos.x,
    y: pos.y,
    r: revealRadius.value
  }

  // Check if we're dragging with left button (reveal fog)
  if (dragStartPos.value && event.buttons === 1 && activeTool.value !== 'draw') {
    const dx = pos.x - dragStartPos.value.x
    const dy = pos.y - dragStartPos.value.y
    const distance = Math.sqrt(dx * dx + dy * dy)

    // If moved more than 5 units, start dragging
    if (distance > 5) {
      isDragging.value = true
    }

    // If dragging, reveal fog
    if (isDragging.value) {
      drawReveal(pos.x, pos.y, true)
    }
  }

  // Check if we're dragging with right button (add fog)
  if (dragStartPos.value && event.buttons === 2 && activeTool.value !== 'draw') {
    const dx = pos.x - dragStartPos.value.x
    const dy = pos.y - dragStartPos.value.y
    const distance = Math.sqrt(dx * dx + dy * dy)

    // If moved more than 5 units, start dragging
    if (distance > 5) {
      isDragging.value = true
    }

    // If dragging, add fog
    if (isDragging.value) {
      drawFog(pos.x, pos.y, true)
    }
  }
}

function handleMouseDown(event) {
  // Handle left button (button === 0) or right button (button === 2)
  if (event.button !== 0 && event.button !== 2) return

  // Don't start fog drag if we're dragging a marker
  if (isMarkerDragging.value) return

  // Right button - prevent context menu and prepare for fog drag
  if (event.button === 2) {
    event.preventDefault()
  }

  const pos = getMousePosition(event)

  // If in draw mode, start drawing
  if (activeTool.value === 'draw') {
    isDrawing.value = true
    drawingPoints.value = [pos]
    currentDrawing.value = `M ${pos.x} ${pos.y}`
    return
  }

  // Store SVG position for fog dragging
  dragStartPos.value = pos
  isDragging.value = false // Not dragging yet, wait for movement
}

function handleMouseUp(event) {
  // Handle left button (button === 0) or right button (button === 2)
  if (event.button !== 0 && event.button !== 2) return

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
      if (event.button === 0) {
        handleSingleClick(event)
      } else if (event.button === 2) {
        // Right click without drag - add single fog shape
        drawFog(pos.x, pos.y, false)
      }
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

  // Commit pending fog shapes
  if (isDragging.value) {
    commitPendingShapes()
  }

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
      // Single click - reveal fog
      drawReveal(pos.x, pos.y, false)
    }
    clickCount.value = 0
  }, 250) // Wait 250ms to detect double-click
}

function handleMapDoubleClick(event) {
  event.preventDefault()
  clickCount.value = 0
  clearTimeout(clickTimeout.value)

  const pos = getMousePosition(event)  // viewBox coordinates

  // Double click - add marker
  const marker = {
    id: `marker-${Date.now()}`,
    x: pos.x,
    y: pos.y,
    color: currentMarkerColor.value,
    name: ''
  }

  roomStore.addMarker(marker)
  socketStore.emitAction(roomStore.roomId, {
    type: 'markerAdd',
    data: marker
  })

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
    strokeWidth: 3
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
  height: 100%; /* Fill parent grid cell */
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
  object-fit: fill; /* Fill entire container, matching SVG */
}

.brush-indicator {
  fill: rgba(255, 215, 0, 0.2);
  stroke: rgba(255, 215, 0, 0.8);
  stroke-width: 2;
  pointer-events: none;
}
</style>
