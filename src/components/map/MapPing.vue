<template>
  <g class="ping-group">
    <!-- Outer glow/ripple (expands and fades) - centered on insertion point -->
    <circle
      :cx="ping.x"
      :cy="ping.y"
      :fill="glowColor"
      class="ping-glow"
    >
      <animate attributeName="r" from="12" to="60" dur="2s" fill="freeze" />
      <animate attributeName="opacity" from="0.6" to="0" dur="2s" fill="freeze" />
    </circle>

    <!-- SVG Gradients for 3D metallic effect -->
    <defs>
      <linearGradient :id="`pin-metal-${ping.id}`" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" style="stop-color:#505050;stop-opacity:1" />
        <stop offset="35%" style="stop-color:#a8a8a8;stop-opacity:1" />
        <stop offset="50%" style="stop-color:#e0e0e0;stop-opacity:1" />
        <stop offset="65%" style="stop-color:#a8a8a8;stop-opacity:1" />
        <stop offset="100%" style="stop-color:#505050;stop-opacity:1" />
      </linearGradient>

      <!-- Worn/scratched pin head gradient -->
      <radialGradient :id="`pin-head-${ping.id}`" cx="35%" cy="35%">
        <stop offset="0%" :style="`stop-color:${ornamentColor};stop-opacity:0.9`" />
        <stop offset="40%" :style="`stop-color:${pingColor};stop-opacity:0.95`" />
        <stop offset="70%" :style="`stop-color:${strokeColor};stop-opacity:1`" />
        <stop offset="100%" style="stop-color:#2a2420;stop-opacity:1" />
      </radialGradient>

      <!-- Blur filter for soft shadows -->
      <filter :id="`pin-blur-${ping.id}`">
        <feGaussianBlur in="SourceGraphic" stdDeviation="1.2"/>
      </filter>
    </defs>

    <!-- Medieval pin stuck at an angle into map -->
    <g class="ping-pin">
      <!-- Cast shadow on map surface (elongated because pin is angled) -->
      <ellipse
        :cx="ping.x + 5"
        :cy="ping.y + 1"
        rx="9"
        ry="2.5"
        fill="#000000"
        opacity="0.25"
        :filter="`url(#pin-blur-${ping.id})`"
      />

      <!-- Insertion hole where pin enters parchment -->
      <ellipse
        :cx="ping.x"
        :cy="ping.y"
        rx="2.2"
        ry="1"
        fill="#2a1f15"
        opacity="0.7"
      />

      <!-- Small highlight ridge on hole edge (shows depth) -->
      <ellipse
        :cx="ping.x - 0.3"
        :cy="ping.y - 0.2"
        rx="1.8"
        ry="0.6"
        fill="#4a3829"
        opacity="0.5"
      />

      <!-- Metal needle shaft - angled from insertion point to upper-left -->
      <path
        :d="`
          M ${ping.x - 1} ${ping.y}
          L ${ping.x - 7} ${ping.y - 22}
          L ${ping.x - 5} ${ping.y - 22}
          L ${ping.x + 1} ${ping.y}
          Z
        `"
        :fill="`url(#pin-metal-${ping.id})`"
        stroke="#404040"
        stroke-width="0.5"
      />

      <!-- Left highlight on shaft (bright metallic edge) -->
      <path
        :d="`
          M ${ping.x - 0.8} ${ping.y - 0.5}
          L ${ping.x - 6.5} ${ping.y - 22}
          L ${ping.x - 6} ${ping.y - 21.5}
          L ${ping.x - 0.3} ${ping.y - 0.5}
          Z
        `"
        fill="rgba(255, 255, 255, 0.65)"
      />

      <!-- Right shadow on shaft (dark edge for depth) -->
      <path
        :d="`
          M ${ping.x + 0.5} ${ping.y - 0.2}
          L ${ping.x - 5.2} ${ping.y - 21.5}
          L ${ping.x - 5.5} ${ping.y - 22}
          L ${ping.x + 0.8} ${ping.y - 0.2}
          Z
        `"
        fill="rgba(0, 0, 0, 0.4)"
      />

      <!-- Worn/used pin head (colored sphere with scratches and dullness) -->
      <circle
        :cx="ping.x - 6"
        :cy="ping.y - 24"
        r="7"
        :fill="`url(#pin-head-${ping.id})`"
        :stroke="strokeColor"
        stroke-width="1.2"
        opacity="0.92"
      >
        <animate attributeName="r" values="7;7.6;7" dur="1.2s" repeatCount="indefinite" />
      </circle>

      <!-- Scratches and wear marks on sphere -->
      <path
        :d="`
          M ${ping.x - 8.5} ${ping.y - 22}
          Q ${ping.x - 7} ${ping.y - 23.5} ${ping.x - 6} ${ping.y - 21.5}
        `"
        stroke="rgba(0, 0, 0, 0.25)"
        stroke-width="0.4"
        fill="none"
      />

      <path
        :d="`
          M ${ping.x - 4} ${ping.y - 26}
          L ${ping.x - 3} ${ping.y - 24.5}
        `"
        stroke="rgba(0, 0, 0, 0.2)"
        stroke-width="0.3"
        fill="none"
      />

      <path
        :d="`
          M ${ping.x - 7.5} ${ping.y - 25.5}
          Q ${ping.x - 6.5} ${ping.y - 25} ${ping.x - 5.5} ${ping.y - 25.2}
        `"
        stroke="rgba(0, 0, 0, 0.18)"
        stroke-width="0.35"
        fill="none"
      />

      <!-- Scuff marks (small dark spots) -->
      <circle
        :cx="ping.x - 4.5"
        :cy="ping.y - 22.5"
        r="0.6"
        fill="rgba(0, 0, 0, 0.15)"
      />

      <ellipse
        :cx="ping.x - 7.5"
        :cy="ping.y - 23"
        rx="0.5"
        ry="0.8"
        fill="rgba(0, 0, 0, 0.12)"
      />

      <!-- Worn edge (darker rim showing use) -->
      <circle
        :cx="ping.x - 6"
        :cy="ping.y - 24"
        r="7"
        fill="none"
        stroke="rgba(0, 0, 0, 0.25)"
        stroke-width="0.8"
        opacity="0.6"
      />

      <!-- Dulled highlight (not as shiny as new) -->
      <ellipse
        :cx="ping.x - 8.5"
        :cy="ping.y - 26.5"
        rx="2.5"
        ry="2.8"
        fill="rgba(255, 255, 255, 0.45)"
      />

      <!-- Small worn specular highlight (less intense) -->
      <circle
        :cx="ping.x - 9"
        :cy="ping.y - 27"
        r="1.1"
        fill="rgba(255, 255, 255, 0.7)"
      />

      <!-- Faint secondary highlight -->
      <ellipse
        :cx="ping.x - 4"
        :cy="ping.y - 23"
        rx="1.2"
        ry="1.5"
        fill="rgba(255, 255, 255, 0.2)"
      />

      <!-- Bottom shadow on sphere (contact with shaft) -->
      <ellipse
        :cx="ping.x - 6"
        :cy="ping.y - 19"
        rx="4.5"
        ry="1.5"
        fill="rgba(0, 0, 0, 0.35)"
      />

      <!-- Dirt/grime accumulation at base of sphere -->
      <ellipse
        :cx="ping.x - 6"
        :cy="ping.y - 19.5"
        rx="3.5"
        ry="1"
        fill="rgba(40, 30, 20, 0.3)"
      />
    </g>
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

const ornamentColor = computed(() => {
  const color = markerColors[props.ping.color]
  return color ? color.ornament : '#6bb6ff'
})

const glowColor = computed(() => {
  const color = markerColors[props.ping.color]
  return color ? color.fill : '#4a90e2'
})
</script>

<style scoped>
.ping-group {
  pointer-events: none;
}
</style>
