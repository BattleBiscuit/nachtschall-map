<template>
  <foreignObject
    :x="x - size / 2"
    :y="y - size / 2"
    :width="size"
    :height="size + labelHeight"
    class="marker-container"
    @mousedown="handleDragStart"
    @dblclick="handleDoubleClick"
  >
    <div class="marker-wrapper">
      <PokerChip
        :color="marker.color"
        :label="marker.name ? marker.name.charAt(0).toUpperCase() : ''"
        size="medium"
      />
      <div v-if="marker.name" class="marker-label">
        {{ marker.name }}
      </div>
    </div>
  </foreignObject>
</template>

<script setup>
import { computed, ref } from 'vue'
import PokerChip from '@/components/ui/PokerChip.vue'
import * as d3 from 'd3'

const props = defineProps({
  marker: {
    type: Object,
    required: true
  },
  size: {
    type: Number,
    default: 48
  }
})

const emit = defineEmits(['update', 'remove', 'editName', 'dragStart', 'dragEnd'])

const labelHeight = 20
const isDragging = ref(false)
const tempPosition = ref(null) // Temporary position during drag

// Use viewBox coordinates directly - no conversion needed
const x = computed(() => tempPosition.value?.x || props.marker.x)
const y = computed(() => tempPosition.value?.y || props.marker.y)

function handleDragStart(event) {
  // Only drag with left button
  if (event.button !== 0) return

  event.stopPropagation()
  event.preventDefault()

  isDragging.value = false
  let dragStartEmitted = false

  // Get the SVG element for viewBox coordinate transformation
  const svg = event.target.closest('svg')

  function onDragMove(moveEvent) {
    moveEvent.preventDefault()
    moveEvent.stopPropagation()

    // Only emit dragStart when we actually start moving
    if (!dragStartEmitted) {
      emit('dragStart')
      dragStartEmitted = true
    }

    isDragging.value = true

    // Get viewBox coordinates from SVG element (not mapGroup which is transformed)
    const [x, y] = d3.pointer(moveEvent, svg)

    // Store temp position for visual feedback
    tempPosition.value = { x, y }
  }

  function onDragEnd(endEvent) {
    endEvent.preventDefault()
    endEvent.stopPropagation()

    document.removeEventListener('mousemove', onDragMove)
    document.removeEventListener('mouseup', onDragEnd)

    // Emit final position on mouse up
    if (dragStartEmitted && tempPosition.value) {
      emit('update', {
        id: props.marker.id,
        ...tempPosition.value
      })
      emit('dragEnd')
    }

    // Clear temp position
    tempPosition.value = null

    // Small delay before resetting isDragging to prevent double-click from firing
    setTimeout(() => {
      isDragging.value = false
    }, 100)
  }

  document.addEventListener('mousemove', onDragMove)
  document.addEventListener('mouseup', onDragEnd)
}

function handleDoubleClick(event) {
  event.stopPropagation()

  // Only handle double-click if we didn't just drag
  if (!isDragging.value) {
    emit('editName', props.marker.id)
  }
}
</script>

<style scoped>
.marker-container {
  overflow: visible;
  cursor: pointer;
}

.marker-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.marker-label {
  font-family: var(--font-heading);
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--parchment-light);
  text-shadow:
    0 1px 2px rgba(0, 0, 0, 0.8),
    0 0 4px rgba(0, 0, 0, 0.6);
  text-align: center;
  white-space: nowrap;
  pointer-events: none;
  user-select: none;
}
</style>
