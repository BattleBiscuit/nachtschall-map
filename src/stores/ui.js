import { defineStore } from 'pinia'

export const useUiStore = defineStore('ui', {
  state: () => ({
    // Tool state
    activeTool: null, // 'reveal' | 'markers' | 'draw' | null
    currentMarkerColor: 'blue',
    viewerPingColor: 'blue',

    // UI visibility
    showColorPalette: false,
    showBrushControl: false,
    showInitiativeTracker: false,

    // Map interaction
    revealRadius: 50,
    minRevealRadius: 20,
    maxRevealRadius: 200,
    initialZoom: 1,
    minZoom: 0.5,
    maxZoom: 3,
    currentZoomTransform: null
  }),

  actions: {
    setActiveTool(tool) {
      this.activeTool = tool
    },

    setMarkerColor(color) {
      this.currentMarkerColor = color
    },

    setViewerPingColor(color) {
      this.viewerPingColor = color
    },

    toggleColorPalette() {
      this.showColorPalette = !this.showColorPalette
    },

    toggleBrushControl() {
      this.showBrushControl = !this.showBrushControl
    },

    toggleInitiativeTracker() {
      this.showInitiativeTracker = !this.showInitiativeTracker
    },

    setRevealRadius(radius) {
      this.revealRadius = Math.max(
        this.minRevealRadius,
        Math.min(this.maxRevealRadius, radius)
      )
    },

    setZoomTransform(transform) {
      this.currentZoomTransform = transform
    }
  },

  persist: {
    key: 'nachtschall-ui',
    storage: localStorage,
    paths: [
      'currentMarkerColor',
      'viewerPingColor',
      'revealRadius'
    ]
    // Overlay visibility and tool state not persisted
  }
})
