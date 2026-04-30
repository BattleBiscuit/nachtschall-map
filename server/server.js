import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from 'redis';
import multer from 'multer';
import sharp from 'sharp';
import fs from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ── Express & Socket.IO Setup ─────────────────────────────────────────────────

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  maxHttpBufferSize: 50 * 1024 * 1024, // 50MB - allow large map images as data URLs
  pingTimeout: 60000,
  pingInterval: 25000,
  upgradeTimeout: 10000,

  // Performance: prefer WebSocket, skip long polling
  transports: ['websocket', 'polling'],
  allowUpgrades: true,

  // Compression for large payloads
  perMessageDeflate: {
    threshold: 1024 // Compress messages larger than 1KB
  },

  cors: {
    origin: '*'
  }
});

const PORT = process.env.PORT || 3000;
const REDIS_URL = process.env.REDIS_URL || 'redis://redis:6379';

// ── HTTP Routes ───────────────────────────────────────────────────────────────

// Map upload configuration
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(__dirname, '..', 'public', 'uploads', 'maps');
    await fs.mkdir(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueId = Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    cb(null, `map-${uniqueId}.webp`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (extname && mimetype) cb(null, true);
    else cb(new Error('Only image files allowed'));
  }
});

// Upload map endpoint - optimizes to WebP automatically
app.post('/api/upload-map', upload.single('map'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const filePath = req.file.path;

    // Optimize with Sharp: WebP conversion, max 4K resolution
    await sharp(filePath)
      .webp({ quality: 85 })
      .resize(4096, 4096, { fit: 'inside', withoutEnlargement: true })
      .toFile(filePath + '.tmp');

    // Replace original with optimized
    await fs.unlink(filePath);
    await fs.rename(filePath + '.tmp', filePath);

    // Get metadata for aspect ratio
    const metadata = await sharp(filePath).metadata();
    const aspectRatio = metadata.width / metadata.height;

    res.json({
      url: `/uploads/maps/${req.file.filename}`,
      aspectRatio,
      width: metadata.width,
      height: metadata.height,
      size: metadata.size
    });
  } catch (error) {
    console.error('[upload] error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Serve uploaded maps with cache headers
const uploadsDir = path.join(__dirname, '..', 'public', 'uploads');
app.use('/uploads', express.static(uploadsDir, {
  maxAge: '1y',
  immutable: true
}));

// Serve Vue build output from dist directory
const distDir = path.join(__dirname, '..', 'dist');
app.use(express.static(distDir));

// Fallback to index.html for SPA routing (Vue Router)
// This must come after all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(distDir, 'index.html'));
});

// ── Redis Connection & Helpers ───────────────────────────────────────────────

// Initialize Redis client for persistent room storage
const redis = createClient({ url: REDIS_URL });
redis.on('error', (err) => console.error('[redis] error:', err));
redis.on('connect', () => console.log('[redis] connected'));

// Connect to Redis
(async () => {
  await redis.connect();
})();

// In-memory room cache for performance
const roomCache = new Map();
const pendingWrites = new Map();
const WRITE_DEBOUNCE_MS = 500; // Write to Redis max once per 500ms per room

// Room storage helpers with caching
async function getRoom(roomId) {
  // Check cache first
  if (roomCache.has(roomId)) {
    return roomCache.get(roomId);
  }

  // Cache miss - fetch from Redis
  const data = await redis.get(`room:${roomId}`);
  const room = data ? JSON.parse(data) : null;

  if (room) {
    roomCache.set(roomId, room);
  }

  return room;
}

async function setRoom(roomId, room) {
  // Update cache immediately
  roomCache.set(roomId, room);

  // Debounce Redis write to avoid hammering on rapid actions
  if (pendingWrites.has(roomId)) {
    clearTimeout(pendingWrites.get(roomId));
  }

  const timeoutId = setTimeout(async () => {
    try {
      await redis.set(`room:${roomId}`, JSON.stringify(room));
      pendingWrites.delete(roomId);
    } catch (err) {
      console.error(`[redis] failed to write room ${roomId}:`, err);
    }
  }, WRITE_DEBOUNCE_MS);

  pendingWrites.set(roomId, timeoutId);
}

async function deleteRoom(roomId) {
  // Clear cache and pending writes
  roomCache.delete(roomId);
  if (pendingWrites.has(roomId)) {
    clearTimeout(pendingWrites.get(roomId));
    pendingWrites.delete(roomId);
  }

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
      snapshot: payload && payload.snapshot ? payload.snapshot : { mapUrl: null, mapAspectRatio: 1, revealShapes: [], markers: [], drawings: [] }
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
        room.snapshot.mapUrl = action.data.mapUrl;
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
      case 'markerUpdate':
        room.snapshot.markers = room.snapshot.markers || [];
        const markerToUpdate = room.snapshot.markers.find(m => m.id === action.data.id);
        if (markerToUpdate) {
          // Update existing marker (using viewBox coordinates x/y)
          if (typeof action.data.x === 'number') {
            markerToUpdate.x = action.data.x;
            markerToUpdate.y = action.data.y;
          }
          if (action.data.color !== undefined) markerToUpdate.color = action.data.color;
          if (action.data.name !== undefined) markerToUpdate.name = action.data.name;
        }
        break;
      case 'initiativeUpdate':
        room.snapshot.initiativeRounds = action.data.rounds;
        room.snapshot.initiativeAssignments = action.data.assignments;
        break;
      case 'drawingAdd':
        room.snapshot.drawings = room.snapshot.drawings || [];
        room.snapshot.drawings.push(action.data);
        break;
      case 'reset':
        room.snapshot.revealShapes = [];
        room.snapshot.markers = [];
        room.snapshot.drawings = [];
        room.snapshot.initiativeRounds = 3;
        room.snapshot.initiativeAssignments = {};
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
