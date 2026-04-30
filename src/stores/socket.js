import { defineStore } from 'pinia'
import { io } from 'socket.io-client'

export const useSocketStore = defineStore('socket', {
  state: () => ({
    socket: null,
    isConnected: false,
    pendingJoin: false,
    error: null
  }),

  actions: {
    connect() {
      if (this.socket?.connected) {
        return
      }

      // Connect to Socket.IO server
      this.socket = io({
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionAttempts: 5
      })

      this.socket.on('connect', () => {
        console.log('[socket] connected', this.socket.id)
        this.isConnected = true
        this.error = null
      })

      this.socket.on('disconnect', (reason) => {
        console.log('[socket] disconnected', reason)
        this.isConnected = false
      })

      this.socket.on('connect_error', (error) => {
        console.error('[socket] connection error', error)
        this.error = error.message
        this.isConnected = false
      })
    },

    disconnect() {
      if (this.socket) {
        this.socket.disconnect()
        this.socket = null
        this.isConnected = false
      }
    },

    // Create a new room
    createRoom(snapshot) {
      return new Promise((resolve, reject) => {
        if (!this.socket?.connected) {
          reject(new Error('Socket not connected'))
          return
        }

        this.socket.emit('createRoom', { snapshot }, (response) => {
          if (response.ok) {
            resolve(response.roomId)
          } else {
            reject(new Error(response.error || 'Failed to create room'))
          }
        })
      })
    },

    // Join an existing room
    joinRoom(roomId) {
      return new Promise((resolve, reject) => {
        if (!this.socket?.connected) {
          reject(new Error('Socket not connected'))
          return
        }

        this.pendingJoin = true

        this.socket.emit('joinRoom', roomId, (response) => {
          this.pendingJoin = false

          if (response.ok) {
            resolve({
              role: response.role,
              snapshot: response.snapshot,
              snapshotHash: response.snapshotHash,
              historyStack: response.historyStack
            })
          } else {
            reject(new Error(response.error || 'Failed to join room'))
          }
        })
      })
    },

    // Emit an action (owner only)
    emitAction(roomId, action) {
      if (!this.socket?.connected) {
        console.error('[socket] Cannot emit action - not connected')
        return
      }

      this.socket.emit('action', roomId, action)
    },

    // Emit a ping (viewers can ping)
    emitPing(roomId, data) {
      if (!this.socket?.connected) {
        console.error('[socket] Cannot emit ping - not connected')
        return
      }

      this.socket.emit('ping', roomId, data)
    },

    // Register event listeners
    onAction(callback) {
      if (this.socket) {
        this.socket.on('action', callback)
      }
    },

    onPing(callback) {
      if (this.socket) {
        this.socket.on('ping', callback)
      }
    },

    onOwnerChanged(callback) {
      if (this.socket) {
        this.socket.on('ownerChanged', callback)
      }
    },

    onParticipantJoined(callback) {
      if (this.socket) {
        this.socket.on('participantJoined', callback)
      }
    },

    // Remove event listeners
    offAction(callback) {
      if (this.socket) {
        this.socket.off('action', callback)
      }
    },

    offPing(callback) {
      if (this.socket) {
        this.socket.off('ping', callback)
      }
    },

    offOwnerChanged(callback) {
      if (this.socket) {
        this.socket.off('ownerChanged', callback)
      }
    },

    offParticipantJoined(callback) {
      if (this.socket) {
        this.socket.off('participantJoined', callback)
      }
    }
  }
})
