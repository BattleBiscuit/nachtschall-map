import { defineStore } from 'pinia'
import { idb } from '@/services/indexed-db'

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
      this.saveToIndexedDB()
    },

    updateMarker(id, updates) {
      const index = this.markers.findIndex(m => m.id === id)
      if (index !== -1) {
        this.markers[index] = { ...this.markers[index], ...updates }
      }
      this.saveToIndexedDB()
    },

    removeMarker(id) {
      this.markers = this.markers.filter(m => m.id !== id)
      // Also remove from initiative
      delete this.markerRoundAssignments[id]
      this.saveToIndexedDB()
    },

    // Fog actions
    addRevealShape(shape) {
      this.revealShapes.push(shape)
      this.saveToIndexedDB()
    },

    // Drawing actions
    addDrawing(drawing) {
      this.drawings.push({
        ...drawing,
        id: drawing.id || `drawing-${++this.drawingIdCounter}`
      })
      this.saveToIndexedDB()
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
      this.saveToIndexedDB()
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
      this.saveToIndexedDB()
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
    },

    // IndexedDB persistence for large data
    saveToIndexedDB() {
      if (this._saveTimeout) clearTimeout(this._saveTimeout)

      this._saveTimeout = setTimeout(async () => {
        if (!this.roomId) return

        const data = {
          roomId: this.roomId,
          mapUrl: this.mapUrl,
          markers: this.markers,
          markerIdCounter: this.markerIdCounter,
          revealShapes: this.revealShapes,
          drawings: this.drawings,
          drawingIdCounter: this.drawingIdCounter,
          initiativeRounds: this.initiativeRounds,
          markerRoundAssignments: this.markerRoundAssignments,
          timestamp: Date.now()
        }

        try {
          await idb.saveRoom(data)
        } catch (error) {
          console.error('[room] IndexedDB save failed:', error)
        }
      }, 1000) // Debounce: max once per second
    },

    async loadFromIndexedDB(roomId) {
      try {
        const data = await idb.loadRoom(roomId)

        if (data) {
          this.mapUrl = data.mapUrl || null
          this.markers = data.markers || []
          this.markerIdCounter = data.markerIdCounter || 0
          this.revealShapes = data.revealShapes || []
          this.drawings = data.drawings || []
          this.drawingIdCounter = data.drawingIdCounter || 0
          this.initiativeRounds = data.initiativeRounds || 3
          this.markerRoundAssignments = data.markerRoundAssignments || {}

          console.log(`[room] Loaded from IndexedDB: ${data.revealShapes.length} fog, ${data.markers.length} markers`)
          return true
        }

        return false
      } catch (error) {
        console.error('[room] IndexedDB load failed:', error)
        return false
      }
    }
  },

  persist: {
    key: 'nachtschall-room-meta',
    storage: localStorage,
    paths: [
      'roomId',
      'isOwner',
      'mapAspectRatio'
    ]
    // Large data (markers, revealShapes, drawings) moved to IndexedDB
  }
})
