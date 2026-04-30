/**
 * useCoordinates Composable
 *
 * Provides coordinate normalization/denormalization helpers
 */

import { computed } from 'vue'
import { useUiStore } from '@/stores/ui'

export function useCoordinates() {
  const uiStore = useUiStore()

  const mapDimensions = computed(() => uiStore.mapDimensions)

  function normalize(x, y) {
    const { x: offsetX, y: offsetY, width, height } = mapDimensions.value

    if (width === 0 || height === 0) {
      console.warn('[useCoordinates] Map dimensions not set')
      return { nx: 0, ny: 0 }
    }

    return {
      nx: (x - offsetX) / width,
      ny: (y - offsetY) / height
    }
  }

  function denormalize(nx, ny) {
    const { x: offsetX, y: offsetY, width, height } = mapDimensions.value

    if (width === 0 || height === 0) {
      console.warn('[useCoordinates] Map dimensions not set for denormalize')
      return { x: 0, y: 0 }
    }

    return {
      x: nx * width + offsetX,
      y: ny * height + offsetY
    }
  }

  return {
    normalize,
    denormalize,
    mapDimensions
  }
}
