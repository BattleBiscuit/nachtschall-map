# Nachtschall Map

Interactive fog-of-war map application for tabletop RPGs with real-time collaboration.

## Features

- **Fog of War System**: Reveal/hide areas with torn paper edge effects
- **Multi-User Collaboration**: Room-based sessions with owner/viewer roles
- **Interactive Tools**:
  - Reveal/fog brush with adjustable size
  - Marker placement with colors and labels
  - Freehand drawing
  - Viewer pings
- **Real-time Sync**: Socket.IO for instant updates across all participants
- **Persistent State**: Redis-backed room storage
- **Undo/Redo**: Full history system with keyboard shortcuts

## Architecture

### Two-Page Structure

#### Lobby (`/`)
- Create new rooms with map selection or upload
- Join existing rooms by code
- Clean separation from map interface

#### Map Viewer (`/room/:code`)
- Path-based routing (`/room/ABC123`)
- Auto-join room from URL
- Owner controls (reveal, markers, drawings)
- Viewer mode (view-only with ping ability)

### Tech Stack

**Backend:**
- Node.js + Express
- Socket.IO for real-time communication
- Redis for room state persistence

**Frontend:**
- D3.js for SVG manipulation and pan/zoom
- Canvas-based fog rendering
- Vanilla JavaScript (no framework)

**Deployment:**
- Docker + Docker Compose
- Traefik reverse proxy
- Let's Encrypt SSL

## File Structure

```
nachtschall-map/
├── public/                 # Frontend assets (served by Express)
│   ├── index.html         # Lobby page
│   ├── map.html           # Map viewer page
│   ├── js/
│   │   ├── lobby.js       # Lobby logic (room creation/joining)
│   │   └── map-client.js  # Map interface and real-time sync
│   ├── assets/
│   │   ├── maps.json      # Available map presets
│   │   └── rabenfels-map.png  # Default map image
│   └── css/               # (Future: stylesheets)
├── src/
│   └── server.js          # Express + Socket.IO server
├── config/                # (Future: configuration files)
├── docker-compose.yml     # Production deployment
├── Dockerfile             # Container image
├── package.json           # Dependencies
└── README.md              # Documentation
```

## Setup

### Development

```bash
# Install dependencies
npm install

# Start server (requires Redis running)
npm start

# Or use Docker Compose
docker-compose up
```

### Production

```bash
# Build and deploy
docker-compose up -d
```

**Environment Variables:**
- `PORT` - Server port (default: 3000)
- `REDIS_URL` - Redis connection URL (default: redis://redis:6379)

## Usage

### Creating a Room

1. Visit `/` (lobby)
2. Go to "Create Room" tab
3. Select a map from dropdown or upload custom image
4. Click "Create Room"
5. Share the room URL (`/room/ABC123`) with players

### Joining a Room

1. Visit `/` (lobby)
2. Enter room code in "Join Room" tab
3. Click "Join Room"
4. Join as viewer (owner can control the map)

### Map Controls

**Owner Tools:**
- **Reveal Tool**: Click/drag to remove fog
- **Markers Tool**: Click to place colored tokens, double-click to edit
- **Drawing Tool**: Freehand drawing on map
- **Brush Size**: Slider (right side)
- **Undo/Redo**: Ctrl+Z / Ctrl+Y
- **Reset**: Clear all fog and markers

**Viewer Tools:**
- **Ping**: Click to send temporary ping visible to all participants
- **Color Palette**: Choose ping color

**Common Controls:**
- **Pan**: Ctrl + Click + Drag
- **Zoom**: Mouse wheel
- **Lobby**: Return to lobby (with confirmation)

## API

### Socket.IO Events

#### Client → Server

- `createRoom(payload, callback)` - Create new room
  - Payload: `{ snapshot: { mapFile, mapAspectRatio, revealShapes, markers, drawings } }`
  - Response: `{ ok: true, roomId: string }`

- `joinRoom(roomId, callback)` - Join existing room
  - Response: `{ ok: true, role: 'owner'|'viewer', snapshot: {...} }`

- `action(roomId, action)` - Send action (owner only)
  - Actions: `setMap`, `reveal`, `fog`, `markerAdd`, `markerRemove`, `drawingAdd`, `reset`

- `ping(roomId, data)` - Send ping to room
  - Data: `{ nx, ny, color }`

#### Server → Client

- `action(action)` - Broadcast action to room
- `ping(data)` - Broadcast ping to room
- `ownerChanged({ newOwner })` - Notify of owner change
- `participantJoined({ id })` - Notify owner of new viewer

## Configuration

### Adding Maps

Edit `public/assets/maps.json`:

```json
[
  {
    "name": "My Map",
    "file": "/assets/my-map.png",
    "preview": "/assets/my-map-preview.png"
  }
]
```

Place map images in the `public/assets/` directory.
**Note:** Use absolute paths starting with `/assets/` for proper resolution.

### Socket.IO Limits

Default max buffer size: 50MB (configurable in `src/server.js`)

```javascript
const io = new Server(server, {
  maxHttpBufferSize: 50 * 1024 * 1024
});
```

## Development Notes

### Session Management

- Rooms persist in Redis
- 30-second grace period for owner reconnection
- Owner socket mismatch handled automatically
- Viewers promoted to owner if original leaves

### Coordinate System

- All coordinates normalized (0-1 range) for resolution independence
- Denormalized on client based on viewport size
- Allows different screen sizes to view same map

### Fog Rendering

- Canvas-based system with pre-blurred textures
- Mask canvas for reveal/fog shapes
- Irregular torn-paper edge effect
- Efficient rendering for large maps

## Troubleshooting

**Map not loading:**
- Check browser console for errors
- Verify map file exists and is accessible
- Check socket connection status

**Joined as viewer instead of owner:**
- Room created from different browser/tab
- Original owner socket still connected
- Clear browser cache and retry

**413 Payload Too Large:**
- Map image too large (>50MB)
- Reduce image size or increase `maxHttpBufferSize`

## License

This project is for personal use in tabletop RPG sessions.

## Credits

Built with:
- [D3.js](https://d3js.org/) - Data visualization and SVG manipulation
- [Socket.IO](https://socket.io/) - Real-time communication
- [Redis](https://redis.io/) - State persistence
- [Express](https://expressjs.com/) - Web framework
