/**
 * useD3Map Composable
 *
 * Integrates D3.js pan/zoom behavior with Vue
 */

import { onMounted, onUnmounted } from 'vue'
import * as d3 from 'd3'
import { useUiStore } from '@/stores/ui'

export function useD3Map(svgRef, mapGroupRef) {
  const uiStore = useUiStore()
  let zoom = null
  let svg = null

  function initD3Zoom() {
    if (!svgRef.value || !mapGroupRef.value) {
      return
    }

    svg = d3.select(svgRef.value)
    const mapGroup = d3.select(mapGroupRef.value)

    // Get viewBox dimensions (map coordinate space)
    const viewBox = svgRef.value.viewBox.baseVal
    const mapWidth = viewBox.width
    const mapHeight = viewBox.height

    // Create zoom behavior
    zoom = d3.zoom()
      .scaleExtent([uiStore.minZoom, uiStore.maxZoom])
      // Constrain panning: map coordinates (0,0) to (mapWidth, mapHeight)
      // can only be within these bounds
      .translateExtent([[0, 0], [mapWidth, mapHeight]])
      .filter((event) => {
        // Allow zoom on wheel (type: wheel)
        // Allow pan only on middle mouse button (button === 1)
        if (event.type === 'wheel') return true
        if (event.type === 'mousedown' || event.type === 'mousemove') {
          return event.button === 1 // Middle mouse button
        }
        return false
      })
      .on('zoom', (event) => {
        // Apply transform to map group
        mapGroup.attr('transform', event.transform)

        // Save transform to store
        uiStore.setZoomTransform(event.transform)
      })

    // Apply zoom to SVG
    svg.call(zoom)

    // Set initial zoom (identity = scale 1, map fills width)
    svg.call(zoom.transform, d3.zoomIdentity)

  }

  function resetZoom() {
    if (!svg || !zoom) return

    const initialTransform = d3.zoomIdentity.scale(uiStore.initialZoom)
    svg.transition()
      .duration(500)
      .call(zoom.transform, initialTransform)
  }

  function zoomIn() {
    if (!svg || !zoom) return

    svg.transition()
      .duration(300)
      .call(zoom.scaleBy, 1.3)
  }

  function zoomOut() {
    if (!svg || !zoom) return

    svg.transition()
      .duration(300)
      .call(zoom.scaleBy, 0.77)
  }

  onMounted(() => {
    initD3Zoom()
  })

  return {
    initD3Zoom,
    resetZoom,
    zoomIn,
    zoomOut
  }
}
