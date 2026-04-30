import { defineStore } from 'pinia'

export const useRoomStore = defineStore('room', {
  state: () => ({
    // Room metadata
    roomId: null,
    isOwner: false,
    mapUrl: null,
    mapAspectRatio: 1,

    // Map state
    markers: [],
    markerIdCounter: 0,
    revealShapes: [],
    drawings: [],
    drawingIdCounter: 0,

    // Initiative
    initiativeRounds: 3,
    markerRoundAssignments: {},

    // For triggering fog updates from other clients
    lastReceivedFogShape: null,

    // For triggering fog mask rebuild (e.g., server sync)
    fogRebuildTrigger: 0
  }),

  actions: {
    // Set entire room snapshot (on join)
    setRoomSnapshot(snapshot) {
      this.mapUrl = snapshot.mapUrl || null
      this.mapAspectRatio = snapshot.mapAspectRatio || 1
      this.markers = snapshot.markers || []
      this.revealShapes = snapshot.revealShapes || []
      this.drawings = snapshot.drawings || []
      this.initiativeRounds = snapshot.initiativeRounds || 3
      this.markerRoundAssignments = snapshot.initiativeAssignments || {}
    },

    // Marker actions
    addMarker(marker) {
      this.markers.push({
        ...marker,
        id: marker.id || `marker-${++this.markerIdCounter}`
      })
    },

    updateMarker(id, updates) {
      const index = this.markers.findIndex(m => m.id === id)
      if (index !== -1) {
        this.markers[index] = { ...this.markers[index], ...updates }
      }
    },

    removeMarker(id) {
      this.markers = this.markers.filter(m => m.id !== id)
      // Also remove from initiative
      delete this.markerRoundAssignments[id]
    },

    // Fog actions
    addRevealShape(shape) {
      this.revealShapes.push(shape)
    },

    // Drawing actions
    addDrawing(drawing) {
      this.drawings.push({
        ...drawing,
        id: drawing.id || `drawing-${++this.drawingIdCounter}`
      })
    },

    // Initiative actions
    updateInitiative(updates) {
      if (updates.rounds !== undefined) {
        this.initiativeRounds = updates.rounds
      }
      if (updates.assignments) {
        this.markerRoundAssignments = {
          ...this.markerRoundAssignments,
          ...updates.assignments
        }
      }
    },

    // Reset all state
    reset() {
      this.revealShapes = []
      this.markers = []
      this.drawings = []
      this.initiativeRounds = 3
      this.markerRoundAssignments = {}

      // Trigger fog canvas to rebuild (empty mask)
      this.fogRebuildTrigger++
    },

    // Apply action from socket (from other users or server)
    applyAction(action) {
      switch (action.type) {
        case 'setMap':
          this.mapUrl = action.data.mapUrl
          this.mapAspectRatio = action.data.mapAspectRatio
          break
        case 'reveal':
        case 'fog':
          // Add the shape to the array
          this.revealShapes.push(action.data)
          // Trigger reactivity by updating the lastReceivedFogShape
          this.lastReceivedFogShape = { ...action.data, timestamp: Date.now() }
          break
        case 'markerAdd':
          this.addMarker(action.data)
          break
        case 'markerUpdate':
          this.updateMarker(action.data.id, action.data)
          break
        case 'markerRemove':
          this.removeMarker(action.data.id)
          break
        case 'drawingAdd':
          this.addDrawing(action.data)
          break
        case 'initiativeUpdate':
          this.updateInitiative({
            rounds: action.data.rounds,
            assignments: action.data.assignments
          })
          break
        case 'reset':
          this.reset()
          break
      }
    },

    // Clear room (on leaving)
    clearRoom() {
      this.roomId = null
      this.isOwner = false
      this.mapUrl = null
      this.mapAspectRatio = 1
      this.markers = []
      this.markerIdCounter = 0
      this.revealShapes = []
      this.drawings = []
      this.drawingIdCounter = 0
      this.initiativeRounds = 3
      this.markerRoundAssignments = {}
    }
  },

  persist: {
    key: 'nachtschall-room',
    storage: localStorage,
    paths: [
      'roomId',
      'isOwner',
      'mapUrl',
      'mapAspectRatio',
      'markers',
      'markerIdCounter',
      'revealShapes',
      'drawings',
      'drawingIdCounter',
      'initiativeRounds',
      'markerRoundAssignments'
    ]
  }
})
