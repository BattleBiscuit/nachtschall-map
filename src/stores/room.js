import { defineStore } from 'pinia'

export const useRoomStore = defineStore('room', {
  state: () => ({
    // Room metadata
    roomId: null,
    isOwner: false,
    mapImageDataUrl: null,
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

    // History (undo/redo) - loaded from Redis for owner only
    historyStack: [],
    historyIndex: -1,

    // For triggering fog updates from other clients
    lastReceivedFogShape: null,

    // For triggering fog mask rebuild on undo/redo
    fogRebuildTrigger: 0
  }),

  actions: {
    // Set entire room snapshot (on join)
    setRoomSnapshot(snapshot) {
      this.mapImageDataUrl = snapshot.mapFile || null
      this.mapAspectRatio = snapshot.mapAspectRatio || 1
      this.markers = snapshot.markers || []
      this.revealShapes = snapshot.revealShapes || []
      this.drawings = snapshot.drawings || []
      this.initiativeRounds = snapshot.initiativeRounds || 3
      this.markerRoundAssignments = snapshot.initiativeAssignments || {}
    },

    // Set history stack (owner only, loaded from Redis)
    setHistoryStack(historyStack) {
      if (Array.isArray(historyStack)) {
        this.historyStack = historyStack
        this.historyIndex = historyStack.length - 1
      }
    },

    // Marker actions
    addMarker(marker) {
      this.markers.push({
        ...marker,
        id: marker.id || `marker-${++this.markerIdCounter}`
      })
      // this.saveToHistory() - disabled for simplicity
    },

    updateMarker(id, updates) {
      const index = this.markers.findIndex(m => m.id === id)
      if (index !== -1) {
        this.markers[index] = { ...this.markers[index], ...updates }
        // this.saveToHistory() - disabled for simplicity
      }
    },

    removeMarker(id) {
      this.markers = this.markers.filter(m => m.id !== id)
      // Also remove from initiative
      delete this.markerRoundAssignments[id]
      // this.saveToHistory() - disabled for simplicity
    },

    // Fog actions
    addRevealShape(shape) {
      this.revealShapes.push(shape)
      // Don't save to history for every fog shape - too many during drag
      // History is saved on other actions (markers, etc)
    },

    // Drawing actions
    addDrawing(drawing) {
      this.drawings.push({
        ...drawing,
        id: drawing.id || `drawing-${++this.drawingIdCounter}`
      })
      // this.saveToHistory() - disabled for simplicity
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
      // this.saveToHistory() - disabled for simplicity
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

      // this.saveToHistory() - disabled for simplicity
    },

    // History management
    saveToHistory() {
      if (!this.isOwner) return

      const snapshot = {
        mapFile: this.mapImageDataUrl,
        mapAspectRatio: this.mapAspectRatio,
        markers: [...this.markers],
        revealShapes: [...this.revealShapes],
        drawings: [...this.drawings],
        initiativeRounds: this.initiativeRounds,
        initiativeAssignments: { ...this.markerRoundAssignments }
      }

      // Trim history if we're not at the end
      if (this.historyIndex < this.historyStack.length - 1) {
        this.historyStack = this.historyStack.slice(0, this.historyIndex + 1)
      }

      // Add new snapshot
      this.historyStack.push(snapshot)

      // Limit to 50 snapshots
      if (this.historyStack.length > 50) {
        this.historyStack.shift()
      } else {
        this.historyIndex++
      }
    },

    undo() {
      if (!this.isOwner || this.historyIndex <= 0) return

      this.historyIndex--
      this.restoreSnapshot(this.historyStack[this.historyIndex])
    },

    redo() {
      if (!this.isOwner || this.historyIndex >= this.historyStack.length - 1) return

      this.historyIndex++
      this.restoreSnapshot(this.historyStack[this.historyIndex])
    },

    restoreSnapshot(snapshot) {
      this.mapImageDataUrl = snapshot.mapFile
      this.mapAspectRatio = snapshot.mapAspectRatio
      this.markers = [...snapshot.markers]
      this.revealShapes = [...snapshot.revealShapes]
      this.drawings = [...snapshot.drawings]
      this.initiativeRounds = snapshot.initiativeRounds
      this.markerRoundAssignments = { ...snapshot.initiativeAssignments }

      // Trigger fog canvas to rebuild mask from new revealShapes
      this.fogRebuildTrigger++
    },

    // Apply action from socket (from other users or server)
    applyAction(action) {
      switch (action.type) {
        case 'setMap':
          this.mapImageDataUrl = action.data.mapFile
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
      this.mapImageDataUrl = null
      this.mapAspectRatio = 1
      this.markers = []
      this.markerIdCounter = 0
      this.revealShapes = []
      this.drawings = []
      this.drawingIdCounter = 0
      this.initiativeRounds = 3
      this.markerRoundAssignments = {}
      this.historyStack = []
      this.historyIndex = -1
    }
  },

  persist: {
    key: 'nachtschall-room',
    storage: localStorage,
    paths: [
      'roomId',
      'isOwner',
      'mapImageDataUrl',
      'mapAspectRatio',
      'markers',
      'markerIdCounter',
      'revealShapes',
      'drawings',
      'drawingIdCounter',
      'initiativeRounds',
      'markerRoundAssignments'
    ]
    // historyStack excluded - stored in Redis, loaded on owner join
  }
})
