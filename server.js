const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

// Serve static files from current directory
app.use(express.static(path.join(__dirname)));

// Simple in-memory room store
// roomId -> { owner: socketId, snapshot: { mapFile, mapAspectRatio, revealShapes, markers, drawings } }
const rooms = {};

function makeRoomId() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

io.on('connection', (socket) => {
  console.log('[ws] connection', socket.id);

  socket.on('createRoom', (payload, cb) => {
    const roomId = makeRoomId();
    rooms[roomId] = {
      owner: socket.id,
      snapshot: payload && payload.snapshot ? payload.snapshot : { mapFile: null, mapAspectRatio: 1, revealShapes: [], markers: [], drawings: [] }
    };
    socket.join(roomId);
    console.log(`[ws] room ${roomId} created by ${socket.id}`);
    if (cb) cb({ ok: true, roomId });
  });

  socket.on('joinRoom', (roomId, cb) => {
    const room = rooms[roomId];
    if (!room) {
      if (cb) cb({ ok: false, error: 'Room not found' });
      return;
    }
    socket.join(roomId);
    console.log(`[ws] ${socket.id} joined ${roomId}`);
    // Send room snapshot and role
    const role = socket.id === room.owner ? 'owner' : 'viewer';
    if (cb) cb({ ok: true, role, snapshot: room.snapshot });
    // Notify owner about new participant
    io.to(room.owner).emit('participantJoined', { id: socket.id });
  });

  socket.on('getSnapshot', (roomId, cb) => {
    const room = rooms[roomId];
    if (!room) return cb && cb({ ok: false, error: 'Room not found' });
    cb && cb({ ok: true, snapshot: room.snapshot });
  });

  // Actions only accepted from owner; server applies to snapshot and broadcasts to room
  socket.on('action', (roomId, action) => {
    const room = rooms[roomId];
    if (!room) return;
    if (socket.id !== room.owner) return; // ignore non-owner actions

    // Apply action to snapshot (basic handling)
    switch (action.type) {
      case 'setMap':
        room.snapshot.mapFile = action.data.mapFile;
        room.snapshot.mapAspectRatio = action.data.mapAspectRatio || room.snapshot.mapAspectRatio;
        break;
      case 'reveal':
      case 'fog':
        room.snapshot.revealShapes = room.snapshot.revealShapes || [];
        room.snapshot.revealShapes.push(action.data);
        break;
      case 'markerAdd':
        room.snapshot.markers = room.snapshot.markers || [];
        room.snapshot.markers.push(action.data);
        break;
      case 'markerRemove':
        room.snapshot.markers = (room.snapshot.markers || []).filter(m => m.id !== action.data.id);
        break;
      case 'drawingAdd':
        room.snapshot.drawings = room.snapshot.drawings || [];
        room.snapshot.drawings.push(action.data);
        break;
      case 'reset':
        room.snapshot.revealShapes = [];
        room.snapshot.markers = [];
        room.snapshot.drawings = [];
        break;
      default:
        // unknown actions stored in history maybe
        break;
    }

    // Broadcast to everyone in the room except the sender
    socket.to(roomId).emit('action', action);
  });

  // Viewer pings: allow any participant to send a short-lived ping visible to the room
  socket.on('ping', (roomId, data) => {
    const room = rooms[roomId];
    if (!room) return;
    // Broadcast ping to everyone in the room (including sender)
    io.to(roomId).emit('ping', Object.assign({}, data, { from: socket.id }));
  });

  socket.on('disconnecting', () => {
    // If owner leaves, promote someone else (first socket in room) or delete room
    for (const roomId of socket.rooms) {
      if (rooms[roomId] && rooms[roomId].owner === socket.id) {
        const sids = Array.from(io.sockets.adapter.rooms.get(roomId) || []);
        // remove owner
        if (sids.length > 1) {
          // find a new owner (first non-self)
          const newOwner = sids.find(id => id !== socket.id);
          rooms[roomId].owner = newOwner;
          io.to(roomId).emit('ownerChanged', { newOwner });
          console.log(`[ws] owner of ${roomId} changed to ${newOwner}`);
        } else {
          // no participants left, delete room
          delete rooms[roomId];
          console.log(`[ws] room ${roomId} deleted (owner left)`);
        }
      }
    }
  });

  socket.on('disconnect', () => {
    console.log('[ws] disconnect', socket.id);
  });
});

server.listen(PORT, () => {
  console.log(`Nachtschall Map running on http://localhost:${PORT}`);
});
