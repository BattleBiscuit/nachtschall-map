<template>
  <g class="ping-group">
    <!-- Outer ripple (expands and fades) -->
    <circle
      :cx="ping.x"
      :cy="ping.y"
      :fill="pingColor"
      class="ping-ripple"
    >
      <animate attributeName="r" from="8" to="48" dur="2s" fill="freeze" />
      <animate attributeName="opacity" from="0.8" to="0" dur="2s" fill="freeze" />
    </circle>

    <!-- Inner dot (solid, slight pulse) -->
    <circle
      :cx="ping.x"
      :cy="ping.y"
      r="8"
      :fill="pingColor"
      :stroke="strokeColor"
      stroke-width="2"
      class="ping-dot"
    >
      <animate attributeName="r" values="7;9;7" dur="1.2s" repeatCount="indefinite" />
    </circle>
  </g>
</template>

<script setup>
import { computed } from 'vue'
import { useMarkerColors } from '@/composables/useTheme'

const props = defineProps({
  ping: {
    type: Object,
    required: true
  }
})

const markerColors = useMarkerColors()

const pingColor = computed(() => {
  const color = markerColors[props.ping.color]
  return color ? color.fill : '#4a90e2'
})

const strokeColor = computed(() => {
  const color = markerColors[props.ping.color]
  return color ? color.border : '#2c5aa0'
})
</script>

<style scoped>
.ping-group {
  pointer-events: none;
}
</style>
