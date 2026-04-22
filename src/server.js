const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const { createClient } = require('redis');

// ── Express & Socket.IO Setup ─────────────────────────────────────────────────

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  maxHttpBufferSize: 50 * 1024 * 1024, // 50MB - allow large map images as data URLs
  pingTimeout: 60000,
  cors: {
    origin: '*'
  }
});

const PORT = process.env.PORT || 3000;
const REDIS_URL = process.env.REDIS_URL || 'redis://redis:6379';

// ── HTTP Routes ───────────────────────────────────────────────────────────────

// Serve static files from public directory (CSS, JS, images, assets)
const publicDir = path.join(__dirname, '..', 'public');
app.use(express.static(publicDir));

// Route handler for /room/:code - serves map viewer page
app.get('/room/:code', (req, res) => {
  res.sendFile(path.join(publicDir, 'map.html'));
});

// Root path serves lobby (index.html is served by static middleware)

// ── Redis Connection & Helpers ───────────────────────────────────────────────

// Initialize Redis client for persistent room storage
const redis = createClient({ url: REDIS_URL });
redis.on('error', (err) => console.error('[redis] error:', err));
redis.on('connect', () => console.log('[redis] connected'));

// Connect to Redis
(async () => {
  await redis.connect();
})();

// Room storage helpers
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

// Generate random 6-character room code (e.g., "AB3X9K")
function makeRoomId() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

// ── Socket.IO Event Handlers ─────────────────────────────────────────────────

io.on('connection', (socket) => {
  console.log('[ws] connection', socket.id);

  // Create a new room with initial snapshot
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

  // Join an existing room
  // Handles owner reconnection: if owner socket disconnected, promote new connection to owner
  socket.on('joinRoom', async (roomId, cb) => {
    const room = await getRoom(roomId);
    if (!room) {
      if (cb) cb({ ok: false, error: 'Room not found' });
      return;
    }
    socket.join(roomId);
    console.log(`[ws] ${socket.id} joined ${roomId}, stored owner: ${room.owner}`);

    // Determine role: owner or viewer
    const roomSockets = Array.from(io.sockets.adapter.rooms.get(roomId) || []);
    const ownerInRoom = roomSockets.includes(room.owner);
    const ownerSocketExists = io.sockets.sockets.has(room.owner);

    console.log(`[ws] room ${roomId} sockets:`, roomSockets, `owner ${room.owner} in room: ${ownerInRoom}, owner socket exists: ${ownerSocketExists}`);

    let role = 'viewer';

    if (socket.id === room.owner) {
      // Exact match - this is the owner
      role = 'owner';
      console.log(`[ws] ${socket.id} is owner (exact match)`);
    } else if (!ownerInRoom || !ownerSocketExists) {
      // Owner disconnected - promote this connection to owner
      const oldOwner = room.owner;
      room.owner = socket.id;
      await setRoom(roomId, room);
      role = 'owner';
      console.log(`[ws] owner of ${roomId} updated from ${oldOwner} to ${socket.id} (ownerInRoom: ${ownerInRoom}, ownerSocketExists: ${ownerSocketExists})`);
    } else {
      console.log(`[ws] ${socket.id} joining as viewer`);
    }

    if (cb) cb({ ok: true, role, snapshot: room.snapshot });

    // Notify owner about new participant (only if this is a viewer joining)
    if (role === 'viewer') {
      io.to(room.owner).emit('participantJoined', { id: socket.id });
    }
  });

  // Get current room snapshot (for debugging/recovery)
  socket.on('getSnapshot', async (roomId, cb) => {
    const room = await getRoom(roomId);
    if (!room) return cb && cb({ ok: false, error: 'Room not found' });
    cb && cb({ ok: true, snapshot: room.snapshot });
  });

  // Handle owner actions (reveal, fog, markers, drawings, etc.)
  // Only the room owner can send actions; viewers are read-only
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

  // Viewer pings: any participant can send a temporary ping (visible dot on map)
  socket.on('ping', async (roomId, data) => {
    const room = await getRoom(roomId);
    if (!room) return;
    // Broadcast ping to everyone in the room (including sender)
    io.to(roomId).emit('ping', Object.assign({}, data, { from: socket.id }));
  });

  // Handle socket disconnection - manage owner transitions and room cleanup
  socket.on('disconnecting', async () => {
    // Check all rooms this socket is in
    for (const roomId of socket.rooms) {
      const room = await getRoom(roomId);
      if (room && room.owner === socket.id) {
        const sids = Array.from(io.sockets.adapter.rooms.get(roomId) || []);

        if (sids.length > 1) {
          // Other participants present - promote first viewer to owner
          const newOwner = sids.find(id => id !== socket.id);
          room.owner = newOwner;
          await setRoom(roomId, room);
          io.to(roomId).emit('ownerChanged', { newOwner });
          console.log(`[ws] owner of ${roomId} changed to ${newOwner}`);
        } else {
          // No other participants - keep room for 30s to allow owner reconnection
          console.log(`[ws] owner of ${roomId} disconnected, keeping room for reconnection`);
          setTimeout(async () => {
            const currentRoom = await getRoom(roomId);
            if (currentRoom) {
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
