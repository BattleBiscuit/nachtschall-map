# Interactive Map with Fog of War - Gefängnis von Rabenfels

An interactive SVG-based map that uses the reference prison map image with fog-of-war reveal mechanics.

## Setup

1. **Add the map image**: Save your reference map image as `rabenfels-map.jpg` in this directory
2. Open `index.html` in a web browser

## Features

- **Fog of War Effect**: Map is completely obscured by default
- **Interactive Reveal**: Click or drag to reveal areas in a circular radius
- **Pan & Zoom**: 
  - Mouse wheel to zoom in/out
  - Ctrl + Click + Drag to pan the map
- **Image-based**: Uses your actual map artwork as the base layer
- **Responsive**: Adapts to window size while maintaining aspect ratio

## Controls

- **Click**: Reveal area at click position
- **Click + Drag**: Reveal areas along drag path
- **Ctrl + Click + Drag**: Pan the map
- **Mouse Wheel**: Zoom in/out
- **Tool Buttons**: Switch between reveal mode and other tools (top right)

## Files

- `index.html` - Main HTML page
- `map.js` - Interactive map logic with D3.js
- `rabenfels-map.jpg` - Your reference map image (you need to add this)

## How It Works

1. The map loads your reference image (`rabenfels-map.jpg`)
2. An SVG mask creates the fog-of-war effect (black overlay)
3. When you interact (click/drag), black circles are added to the mask to reveal areas
4. D3.js handles all the pan/zoom transformations
5. The image scales to fit your screen while maintaining its aspect ratio

## To Add Your Map Image

Save the reference image you provided as `rabenfels-map.jpg` in this directory. The code expects:
- Filename: `rabenfels-map.jpg`
- Aspect ratio: ~598x337 (automatically handled)
- Location: Same folder as `index.html`

If the image doesn't load, check:
1. The filename is exactly `rabenfels-map.jpg`
2. The file is in the same directory as `index.html`
3. Your browser console for any errors
