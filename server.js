const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const { createClient } = require('redis');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;
const REDIS_URL = process.env.REDIS_URL || 'redis://redis:6379';

// Serve static files from current directory
app.use(express.static(path.join(__dirname)));

// Initialize Redis client
const redis = createClient({ url: REDIS_URL });
redis.on('error', (err) => console.error('[redis] error:', err));
redis.on('connect', () => console.log('[redis] connected'));

// Connect to Redis
(async () => {
  await redis.connect();
})();

// Helper functions for Redis-backed room storage
async function getRoom(roomId) {
  const data = await redis.get(`room:${roomId}`);
  return data ? JSON.parse(data) : null;
}

async function setRoom(roomId, room) {
  await redis.set(`room:${roomId}`, JSON.stringify(room));
}

async function deleteRoom(roomId) {
  await redis.del(`room:${roomId}`);
}

function makeRoomId() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

io.on('connection', (socket) => {
  console.log('[ws] connection', socket.id);

  socket.on('createRoom', async (payload, cb) => {
    const roomId = makeRoomId();
    const room = {
      owner: socket.id,
      snapshot: payload && payload.snapshot ? payload.snapshot : { mapFile: null, mapAspectRatio: 1, revealShapes: [], markers: [], drawings: [] }
    };
    await setRoom(roomId, room);
    socket.join(roomId);
    console.log(`[ws] room ${roomId} created by ${socket.id}`);
    if (cb) cb({ ok: true, roomId });
  });

  socket.on('joinRoom', async (roomId, cb) => {
    const room = await getRoom(roomId);
    if (!room) {
      if (cb) cb({ ok: false, error: 'Room not found' });
      return;
    }
    socket.join(roomId);
    console.log(`[ws] ${socket.id} joined ${roomId}, stored owner: ${room.owner}`);

    // Check if this is the owner rejoining (room has no active owner socket)
    const roomSockets = Array.from(io.sockets.adapter.rooms.get(roomId) || []);
    const ownerInRoom = roomSockets.includes(room.owner);
    console.log(`[ws] room ${roomId} sockets:`, roomSockets, `owner ${room.owner} in room: ${ownerInRoom}`);

    let role = 'viewer';

    if (socket.id === room.owner) {
      role = 'owner';
      console.log(`[ws] ${socket.id} is owner (exact match)`);
    } else if (!ownerInRoom) {
      // Owner socket is not in the room, so this must be the owner rejoining with a new socket ID
      // Update the owner to the new socket ID
      const oldOwner = room.owner;
      room.owner = socket.id;
      await setRoom(roomId, room);
      role = 'owner';
      console.log(`[ws] owner of ${roomId} updated from ${oldOwner} to ${socket.id}`);
    } else {
      console.log(`[ws] ${socket.id} joining as viewer`);
    }

    if (cb) cb({ ok: true, role, snapshot: room.snapshot });
    // Notify owner about new participant (only if this is a viewer joining)
    if (role === 'viewer') {
      io.to(room.owner).emit('participantJoined', { id: socket.id });
    }
  });

  socket.on('getSnapshot', async (roomId, cb) => {
    const room = await getRoom(roomId);
    if (!room) return cb && cb({ ok: false, error: 'Room not found' });
    cb && cb({ ok: true, snapshot: room.snapshot });
  });

  // Actions only accepted from owner; server applies to snapshot and broadcasts to room
  socket.on('action', async (roomId, action) => {
    const room = await getRoom(roomId);
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

    // Save updated room to Redis
    await setRoom(roomId, room);

    // Broadcast to everyone in the room except the sender
    socket.to(roomId).emit('action', action);
  });

  // Viewer pings: allow any participant to send a short-lived ping visible to the room
  socket.on('ping', async (roomId, data) => {
    const room = await getRoom(roomId);
    if (!room) return;
    // Broadcast ping to everyone in the room (including sender)
    io.to(roomId).emit('ping', Object.assign({}, data, { from: socket.id }));
  });

  socket.on('disconnecting', async () => {
    // If owner leaves, promote someone else or mark room for cleanup
    for (const roomId of socket.rooms) {
      const room = await getRoom(roomId);
      if (room && room.owner === socket.id) {
        const sids = Array.from(io.sockets.adapter.rooms.get(roomId) || []);
        // remove owner
        if (sids.length > 1) {
          // find a new owner (first non-self)
          const newOwner = sids.find(id => id !== socket.id);
          room.owner = newOwner;
          await setRoom(roomId, room);
          io.to(roomId).emit('ownerChanged', { newOwner });
          console.log(`[ws] owner of ${roomId} changed to ${newOwner}`);
        } else {
          // no other participants left, but don't delete immediately
          // Keep room for 30 seconds to allow owner to reconnect (page reload)
          console.log(`[ws] owner of ${roomId} disconnected, keeping room for reconnection`);
          setTimeout(async () => {
            const currentRoom = await getRoom(roomId);
            if (currentRoom) {
              // Check if anyone rejoined
              const roomStillExists = io.sockets.adapter.rooms.get(roomId);
              if (!roomStillExists || roomStillExists.size === 0) {
                await deleteRoom(roomId);
                console.log(`[ws] room ${roomId} deleted after timeout (no reconnection)`);
              }
            }
          }, 30000); // 30 second grace period
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
