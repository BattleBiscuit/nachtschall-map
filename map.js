// Map configuration
const config = {
    revealRadius: 60,
    minRevealRadius: 20,
    maxRevealRadius: 200,
    initialZoom: 1,
    minZoom: 0.5,
    maxZoom: 8
};

// Active tool state
let activeTool = 'reveal';

// Markers storage
let markers = [];
let markerIdCounter = 0;

// Storage for fog of war reveal shapes
let revealShapes = [];

// Color palette for markers
const markerColors = {
    blue: { fill: 'rgba(100, 150, 255, 0.5)', stroke: '#2a5caa' },
    red: { fill: 'rgba(255, 100, 100, 0.5)', stroke: '#aa2a2a' },
    green: { fill: 'rgba(100, 200, 100, 0.5)', stroke: '#2a8a2a' },
    yellow: { fill: 'rgba(255, 220, 100, 0.5)', stroke: '#aa9a2a' },
    purple: { fill: 'rgba(180, 100, 255, 0.5)', stroke: '#6a2aaa' },
    orange: { fill: 'rgba(255, 150, 80, 0.5)', stroke: '#aa6a2a' },
    cyan: { fill: 'rgba(100, 220, 220, 0.5)', stroke: '#2a9aaa' },
    pink: { fill: 'rgba(255, 150, 200, 0.5)', stroke: '#aa5a7a' }
};

let currentMarkerColor = 'blue';

// Initialize SVG and dimensions
const container = d3.select("#map-container");
const width = window.innerWidth;
const height = window.innerHeight;

const svg = container.append("svg")
    .attr("width", width)
    .attr("height", height);

// Create main group for pan/zoom
const g = svg.append("g");

// Store revealed circles
const revealedAreas = [];

// Create defs for mask and filters
const defs = svg.append("defs");

// Create extreme blur + displacement filter for fog of war
const blurFilter = defs.append("filter")
    .attr("id", "fog-blur");

// Create turbulence for displacement
blurFilter.append("feTurbulence")
    .attr("type", "turbulence")
    .attr("baseFrequency", "0.015")
    .attr("numOctaves", "4")
    .attr("result", "turbulence");

// Displace the image heavily
blurFilter.append("feDisplacementMap")
    .attr("in", "SourceGraphic")
    .attr("in2", "turbulence")
    .attr("scale", "80")
    .attr("xChannelSelector", "R")
    .attr("yChannelSelector", "G")
    .attr("result", "displaced");

// Apply extreme blur to the displaced image
blurFilter.append("feGaussianBlur")
    .attr("in", "displaced")
    .attr("stdDeviation", "60")
    .attr("result", "blurred");

// Create mask for fog of war
const mask = defs.append("mask")
    .attr("id", "fog-mask");

// White background for mask (visible areas will be black circles that block)
mask.append("rect")
    .attr("x", -10000)
    .attr("y", -10000)
    .attr("width", 20000)
    .attr("height", 20000)
    .attr("fill", "white");

// Group for revealed areas in mask (will be black to hide fog)
const revealGroup = mask.append("g")
    .attr("class", "reveal-group");

// Map layers
const mapGroup = g.append("g").attr("class", "map-layer");
const markersGroup = g.append("g").attr("class", "markers-layer"); // Layer for player/enemy markers
const fogGroup = g.append("g").attr("class", "fog-layer");

// Brush size indicator circle
const brushIndicator = g.append("circle")
    .attr("class", "brush-indicator")
    .attr("r", config.revealRadius)
    .attr("fill", "none")
    .attr("stroke", "#fff")
    .attr("stroke-width", 2)
    .attr("stroke-dasharray", "5,5")
    .attr("pointer-events", "none")
    .style("opacity", 0);

// Store map dimensions globally
let mapDimensions = {};

// Create Gefängnis von Rabenfels - Using reference image
function createRabenfelsMap() {
    const cx = width / 2;
    const cy = height / 2;

    // Calculate image dimensions - fill full width
    const imgAspectRatio = 598 / 337; // width / height of reference image

    // Always fit to full width
    const imgWidth = width;
    const imgHeight = imgWidth / imgAspectRatio;

    const imgX = 0;
    const imgY = cy - imgHeight / 2;

    // Store dimensions for fog overlay
    mapDimensions = {
        x: imgX,
        y: imgY,
        width: imgWidth,
        height: imgHeight
    };

    // Add the reference map image
    mapGroup.append("image")
        .attr("href", "rabenfels-map.png")
        .attr("x", imgX)
        .attr("y", imgY)
        .attr("width", imgWidth)
        .attr("height", imgHeight)
        .attr("preserveAspectRatio", "xMidYMid meet");
}

createRabenfelsMap();

// Create fog overlay using heavily blurred version of the map
// Make it larger than the actual map to avoid edge artifacts
const fogPadding = 0.2; // 20% padding
fogGroup.append("image")
    .attr("href", "rabenfels-map.png")
    .attr("x", mapDimensions.x - mapDimensions.width * fogPadding)
    .attr("y", mapDimensions.y - mapDimensions.height * fogPadding)
    .attr("width", mapDimensions.width * (1 + fogPadding * 2))
    .attr("height", mapDimensions.height * (1 + fogPadding * 2))
    .attr("preserveAspectRatio", "none") // Stretch to fill
    .attr("class", "fog-overlay")
    .attr("filter", "url(#fog-blur)") // Apply extreme blur
    .attr("mask", "url(#fog-mask)");  // Apply mask for reveals


// Function to reveal area at position with wonky fading effect
function revealArea(x, y) {
    // Create radial gradient for fading effect
    const gradientId = `reveal-gradient-${Date.now()}-${Math.random()}`;
    const gradient = defs.append("radialGradient")
        .attr("id", gradientId);

    // Create multiple stops for a softer, irregular fade
    gradient.append("stop")
        .attr("offset", "0%")
        .attr("stop-color", "black")
        .attr("stop-opacity", 1);

    gradient.append("stop")
        .attr("offset", "40%")
        .attr("stop-color", "black")
        .attr("stop-opacity", 0.9);

    gradient.append("stop")
        .attr("offset", "70%")
        .attr("stop-color", "black")
        .attr("stop-opacity", 0.6);

    gradient.append("stop")
        .attr("offset", "85%")
        .attr("stop-color", "black")
        .attr("stop-opacity", 0.3);

    gradient.append("stop")
        .attr("offset", "100%")
        .attr("stop-color", "black")
        .attr("stop-opacity", 0);

    // Create wonky shape instead of perfect circle
    const numPoints = 12 + Math.floor(Math.random() * 8); // 12-20 points
    const baseRadius = config.revealRadius;

    let pathData = "";
    for (let i = 0; i <= numPoints; i++) {
        const angle = (i / numPoints) * Math.PI * 2;
        // Add randomness to radius for wonky effect
        const radiusVariation = 0.7 + Math.random() * 0.6; // 70% to 130% of base
        const r = baseRadius * radiusVariation;
        const px = x + Math.cos(angle) * r;
        const py = y + Math.sin(angle) * r;

        if (i === 0) {
            pathData = `M ${px},${py}`;
        } else {
            // Use quadratic curves for smoother, organic edges
            const prevAngle = ((i - 1) / numPoints) * Math.PI * 2;
            const prevR = baseRadius * (0.7 + Math.random() * 0.6);
            const cpx = x + Math.cos((angle + prevAngle) / 2) * ((r + prevR) / 2);
            const cpy = y + Math.sin((angle + prevAngle) / 2) * ((r + prevR) / 2);
            pathData += ` Q ${cpx},${cpy} ${px},${py}`;
        }
    }
    pathData += " Z";

    const shape = revealGroup.append("path")
        .attr("d", pathData)
        .attr("fill", `url(#${gradientId})`)
        .attr("opacity", 0);

    shape.transition()
        .duration(300)
        .attr("opacity", 1);

    revealedAreas.push({ x, y, radius: config.revealRadius });

    // Store reveal data for saving
    revealShapes.push({ x, y, radius: config.revealRadius, pathData, gradientId });
    saveToLocalStorage();
}

// Function to add fog back at position with wonky fading effect
function addFog(x, y) {
    // Create radial gradient for fading effect (reverse of reveal)
    const gradientId = `fog-gradient-${Date.now()}-${Math.random()}`;
    const gradient = defs.append("radialGradient")
        .attr("id", gradientId);

    // Create gradient that goes from transparent to white (opposite of reveal)
    gradient.append("stop")
        .attr("offset", "0%")
        .attr("stop-color", "white")
        .attr("stop-opacity", 1);

    gradient.append("stop")
        .attr("offset", "40%")
        .attr("stop-color", "white")
        .attr("stop-opacity", 0.9);

    gradient.append("stop")
        .attr("offset", "70%")
        .attr("stop-color", "white")
        .attr("stop-opacity", 0.6);

    gradient.append("stop")
        .attr("offset", "85%")
        .attr("stop-color", "white")
        .attr("stop-opacity", 0.3);

    gradient.append("stop")
        .attr("offset", "100%")
        .attr("stop-color", "white")
        .attr("stop-opacity", 0);

    // Create wonky shape
    const numPoints = 12 + Math.floor(Math.random() * 8);
    const baseRadius = config.revealRadius;

    let pathData = "";
    for (let i = 0; i <= numPoints; i++) {
        const angle = (i / numPoints) * Math.PI * 2;
        const radiusVariation = 0.7 + Math.random() * 0.6;
        const r = baseRadius * radiusVariation;
        const px = x + Math.cos(angle) * r;
        const py = y + Math.sin(angle) * r;

        if (i === 0) {
            pathData = `M ${px},${py}`;
        } else {
            const prevAngle = ((i - 1) / numPoints) * Math.PI * 2;
            const prevR = baseRadius * (0.7 + Math.random() * 0.6);
            const cpx = x + Math.cos((angle + prevAngle) / 2) * ((r + prevR) / 2);
            const cpy = y + Math.sin((angle + prevAngle) / 2) * ((r + prevR) / 2);
            pathData += ` Q ${cpx},${cpy} ${px},${py}`;
        }
    }
    pathData += " Z";

    const shape = revealGroup.append("path")
        .attr("d", pathData)
        .attr("fill", `url(#${gradientId})`)
        .attr("opacity", 0);

    shape.transition()
        .duration(300)
        .attr("opacity", 1);

    // Store fog data for saving
    revealShapes.push({ x, y, radius: config.revealRadius, pathData, gradientId, isFog: true });
    saveToLocalStorage();
}

// Function to add a marker (player/enemy circle)
function addMarker(x, y, color = null) {
    const markerId = `marker-${markerIdCounter++}`;
    const markerRadius = Math.min(mapDimensions.width, mapDimensions.height) / 50; // Scale to map size (smaller)
    const markerColor = color || currentMarkerColor;
    const colors = markerColors[markerColor];

    // Create marker circle
    const markerCircle = markersGroup.append("circle")
        .attr("id", markerId)
        .attr("cx", x)
        .attr("cy", y)
        .attr("r", 0)
        .attr("fill", colors.fill)
        .attr("stroke", colors.stroke)
        .attr("stroke-width", 3)
        .attr("class", "marker")
        .attr("data-color", markerColor)
        .style("cursor", "inherit")
        .style("pointer-events", "auto");

    // Animate marker appearance
    markerCircle.transition()
        .duration(200)
        .attr("r", markerRadius);

    // Create text label for marker name
    const markerText = markersGroup.append("text")
        .attr("id", `${markerId}-text`)
        .attr("x", x)
        .attr("y", y + markerRadius + 15)
        .attr("text-anchor", "middle")
        .attr("class", "marker-label")
        .attr("fill", "#fff")
        .attr("font-size", "12px")
        .attr("font-family", "sans-serif")
        .attr("font-weight", "bold")
        .attr("stroke", "#000")
        .attr("stroke-width", "3")
        .attr("paint-order", "stroke")
        .style("cursor", "inherit")
        .style("pointer-events", "none")
        .style("user-select", "none")
        .text("");

    // Store marker data
    const markerData = { id: markerId, x, y, color: markerColor, name: "", element: markerCircle, textElement: markerText };
    markers.push(markerData);

    // Add drag behavior to marker (only active in marker mode)
    const drag = d3.drag()
        .filter(function(event) {
            // Only allow drag when in marker mode
            return activeTool === 'tool2';
        })
        .on("start", function(event) {
            if (activeTool === 'tool2') {
                d3.select(this).style("cursor", "grabbing");
                markerData.isDragging = true;
            }
        })
        .on("drag", function(event) {
            if (activeTool === 'tool2') {
                const [newX, newY] = d3.pointer(event, g.node());
                d3.select(this)
                    .attr("cx", newX)
                    .attr("cy", newY);
                // Update text position
                markerData.textElement
                    .attr("x", newX)
                    .attr("y", newY + markerRadius + 15);
                markerData.x = newX;
                markerData.y = newY;
            }
        })
        .on("end", function(event) {
            if (activeTool === 'tool2') {
                d3.select(this).style("cursor", "grab");
                // Save state after dragging
                saveToLocalStorage();
                // Delay clearing isDragging flag to prevent click event
                setTimeout(() => {
                    markerData.isDragging = false;
                }, 50);
            }
        });

    markerCircle.call(drag);

    // Add double-click event to edit marker name
    markerCircle.on("dblclick", function(event) {
        if (activeTool === 'tool2') {
            event.stopPropagation();
            const newName = prompt("Enter marker name:", markerData.name || "");
            if (newName !== null) {
                markerData.name = newName;
                markerData.textElement.text(newName);
                saveToLocalStorage();
            }
        }
    });

    // Save state after adding marker (but only if not loading from storage)
    if (!markerData.isLoading) {
        saveToLocalStorage();
    }

    return markerData;
}

// Function to check if clicking on an existing marker
function findMarkerAtPosition(x, y) {
    const markerRadius = Math.min(mapDimensions.width, mapDimensions.height) / 50;
    const clickRadius = markerRadius * 1.2; // Hit area

    // Find markers within click radius
    const foundMarker = markers.find(marker => {
        const dx = marker.x - x;
        const dy = marker.y - y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        return distance <= clickRadius;
    });

    return foundMarker;
}

// Function to remove marker at position
function removeMarker(x, y) {
    const markerRadius = Math.min(mapDimensions.width, mapDimensions.height) / 50;
    const clickRadius = markerRadius * 1.5; // Slightly larger hit area

    // Find markers within click radius
    const markersToRemove = markers.filter(marker => {
        const dx = marker.x - x;
        const dy = marker.y - y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        return distance <= clickRadius;
    });

    // Remove found markers
    markersToRemove.forEach(marker => {
        // Animate marker removal
        marker.element.transition()
            .duration(200)
            .attr("r", 0)
            .style("opacity", 0)
            .remove();

        // Remove text label
        marker.textElement.remove();

        // Remove from markers array
        markers = markers.filter(m => m.id !== marker.id);
    });

    // Save state after removal
    if (markersToRemove.length > 0) {
        saveToLocalStorage();
    }
}

// Track middle mouse button state for panning
let isMiddleMouseDown = false;

// Zoom behavior - now supports middle mouse button panning
const zoom = d3.zoom()
    .scaleExtent([config.initialZoom, config.maxZoom])
    .translateExtent([
        [0, 0],
        [width, height]
    ])
    .filter((event) => {
        // Allow wheel zoom normally
        if (event.type === 'wheel') return true;
        // Allow pan with middle mouse button (button 1)
        if (event.type === 'mousedown' || event.type === 'mousemove') {
            return event.button === 1 || isMiddleMouseDown;
        }
        return false;
    })
    .on("zoom", (event) => {
        g.attr("transform", event.transform);
    });

svg.call(zoom);

// Mouse/touch interaction for revealing
let isMouseDown = false;
let isRightMouseDown = false;
let isDragging = false;
let lastRevealTime = 0;
const revealThrottle = 50; // milliseconds

// Handle right-click (contextmenu) separately
svg.on("contextmenu", function(event) {
    event.preventDefault();

    // Only act if not in panning mode
    if (!event.ctrlKey) {
        const [x, y] = d3.pointer(event, g.node());

        if (activeTool === 'reveal') {
            // Right click - add fog
            addFog(x, y);
        } else if (activeTool === 'tool2') {
            // Right click - remove marker
            removeMarker(x, y);
        }
    }
});

svg.on("mousedown touchstart", function(event) {
    if (event.button === 1) {
        // Middle mouse button - for panning
        event.preventDefault();
        isMiddleMouseDown = true;
        container.node().classList.add('panning');
    } else {
        // Left or right mouse button
        if (event.button === 2) {
            // Right mouse button
            isRightMouseDown = true;
        } else if (event.button === 0) {
            // Left mouse button
            isMouseDown = true;
        }
        isDragging = false;
    }
});

svg.on("mouseup touchend", function(event) {
    if (event.button === 1) {
        // Middle mouse button released
        isMiddleMouseDown = false;
        container.node().classList.remove('panning');
    }
    isMouseDown = false;
    isRightMouseDown = false;
});

svg.on("mousemove touchmove", function(event) {
    const [x, y] = d3.pointer(event, g.node());

    // Update brush indicator position and show it when reveal tool is active
    if (activeTool === 'reveal' && !isMiddleMouseDown) {
        brushIndicator
            .attr("cx", x)
            .attr("cy", y)
            .style("opacity", 0.6);
    } else {
        brushIndicator.style("opacity", 0);
    }

    // Only reveal/fog if mouse is down and Ctrl is not pressed (not panning)
    if ((isMouseDown || isRightMouseDown) && !event.ctrlKey) {
        isDragging = true;

        if (activeTool === 'reveal') {
            const now = Date.now();
            if (now - lastRevealTime < revealThrottle) return;
            lastRevealTime = now;

            if (isRightMouseDown) {
                // Right mouse - add fog
                addFog(x, y);
            } else {
                // Left mouse - reveal
                revealArea(x, y);
            }
        }
        // Tool 2 doesn't do anything on drag, only on click
    }
});

svg.on("click", function(event) {
    // Only act on LEFT click if not dragging and Ctrl is not pressed
    if (!isDragging && !event.ctrlKey) {
        const [x, y] = d3.pointer(event, g.node());

        if (activeTool === 'reveal') {
            // Left click - reveal
            revealArea(x, y);
        } else if (activeTool === 'tool2') {
            // Check if clicking on existing marker
            const existingMarker = findMarkerAtPosition(x, y);

            // Only add new marker if not clicking on existing one and not dragging
            if (!existingMarker || (existingMarker && !existingMarker.isDragging)) {
                // Don't add if we just finished dragging a marker
                const anyMarkerDragging = markers.some(m => m.isDragging);
                if (!anyMarkerDragging && !existingMarker) {
                    addMarker(x, y);
                }
            }
        }
    }
});

svg.on("mouseleave", function() {
    brushIndicator.style("opacity", 0);
});

// Handle window resize
window.addEventListener("resize", () => {
    const newWidth = window.innerWidth;
    const newHeight = window.innerHeight;

    svg.attr("width", newWidth)
        .attr("height", newHeight);

    // Redraw the map
    mapGroup.selectAll("*").remove();
    createRabenfelsMap();

    // Redraw fog overlay with new dimensions
    const fogPadding = 0.2;
    fogGroup.selectAll("image").remove();
    fogGroup.append("image")
        .attr("href", "rabenfels-map.png")
        .attr("x", mapDimensions.x - mapDimensions.width * fogPadding)
        .attr("y", mapDimensions.y - mapDimensions.height * fogPadding)
        .attr("width", mapDimensions.width * (1 + fogPadding * 2))
        .attr("height", mapDimensions.height * (1 + fogPadding * 2))
        .attr("preserveAspectRatio", "none")
        .attr("class", "fog-overlay")
        .attr("filter", "url(#fog-blur)")
        .attr("mask", "url(#fog-mask)");
});

// Save state to localStorage
function saveToLocalStorage() {
    const state = {
        revealShapes: revealShapes,
        markers: markers.map(m => ({ x: m.x, y: m.y, id: m.id, color: m.color, name: m.name || "" })),
        brushSize: config.revealRadius
    };
    localStorage.setItem('mapState', JSON.stringify(state));
}

// Load state from localStorage
function loadFromLocalStorage() {
    const savedState = localStorage.getItem('mapState');
    if (!savedState) return;

    try {
        const state = JSON.parse(savedState);

        // Restore brush size
        if (state.brushSize) {
            config.revealRadius = state.brushSize;
            brushSlider.value = state.brushSize;
            updateBrushSize(state.brushSize);
        }

        // Restore reveal shapes
        if (state.revealShapes) {
            state.revealShapes.forEach(shapeData => {
                if (shapeData.isFog) {
                    // Recreate fog shape
                    const gradient = defs.append("radialGradient")
                        .attr("id", shapeData.gradientId);

                    gradient.append("stop")
                        .attr("offset", "0%")
                        .attr("stop-color", "white")
                        .attr("stop-opacity", 1);

                    gradient.append("stop")
                        .attr("offset", "40%")
                        .attr("stop-color", "white")
                        .attr("stop-opacity", 0.9);

                    gradient.append("stop")
                        .attr("offset", "70%")
                        .attr("stop-color", "white")
                        .attr("stop-opacity", 0.6);

                    gradient.append("stop")
                        .attr("offset", "85%")
                        .attr("stop-color", "white")
                        .attr("stop-opacity", 0.3);

                    gradient.append("stop")
                        .attr("offset", "100%")
                        .attr("stop-color", "white")
                        .attr("stop-opacity", 0);

                    revealGroup.append("path")
                        .attr("d", shapeData.pathData)
                        .attr("fill", `url(#${shapeData.gradientId})`)
                        .attr("opacity", 1);
                } else {
                    // Recreate reveal shape
                    const gradient = defs.append("radialGradient")
                        .attr("id", shapeData.gradientId);

                    gradient.append("stop")
                        .attr("offset", "0%")
                        .attr("stop-color", "black")
                        .attr("stop-opacity", 1);

                    gradient.append("stop")
                        .attr("offset", "40%")
                        .attr("stop-color", "black")
                        .attr("stop-opacity", 0.9);

                    gradient.append("stop")
                        .attr("offset", "70%")
                        .attr("stop-color", "black")
                        .attr("stop-opacity", 0.6);

                    gradient.append("stop")
                        .attr("offset", "85%")
                        .attr("stop-color", "black")
                        .attr("stop-opacity", 0.3);

                    gradient.append("stop")
                        .attr("offset", "100%")
                        .attr("stop-color", "black")
                        .attr("stop-opacity", 0);

                    revealGroup.append("path")
                        .attr("d", shapeData.pathData)
                        .attr("fill", `url(#${shapeData.gradientId})`)
                        .attr("opacity", 1);
                }
            });
            revealShapes = state.revealShapes;
        }

        // Restore markers
        if (state.markers) {
            state.markers.forEach(markerData => {
                const marker = addMarker(markerData.x, markerData.y, markerData.color || 'blue');
                marker.isLoading = true; // Mark as loading to prevent saving during restore
                // Restore marker name
                if (markerData.name) {
                    marker.name = markerData.name;
                    marker.textElement.text(markerData.name);
                }
            });
        }
    } catch (e) {
        console.error('Failed to load map state:', e);
    }
}

// Load saved state after fog is set up
setTimeout(() => {
    loadFromLocalStorage();
}, 100);

// No initial reveal - map starts completely fogged

// Tool button functionality
const revealToolBtn = document.getElementById('reveal-tool');
const tool2Btn = document.getElementById('tool-2');
const resetBtn = document.getElementById('reset-btn');

function setActiveTool(tool) {
    activeTool = tool;

    // Update button states
    revealToolBtn.classList.remove('active');
    tool2Btn.classList.remove('active');

    // Show/hide color palette and brush control based on active tool
    const colorPalette = document.getElementById('color-palette');
    const brushControl = document.getElementById('brush-control');

    if (tool === 'reveal') {
        revealToolBtn.classList.add('active');
        revealToolBtn.title = 'Reveal Tool (Active)';
        tool2Btn.title = 'Markers Tool - Add/Remove tokens';
        colorPalette.classList.remove('visible');
        brushControl.classList.add('visible');
        // Make markers non-interactive in reveal mode
        markersGroup.selectAll('.marker')
            .style("cursor", "inherit")
            .style("pointer-events", "none");
    } else if (tool === 'tool2') {
        tool2Btn.classList.add('active');
        tool2Btn.title = 'Markers Tool (Active)';
        revealToolBtn.title = 'Reveal Tool';
        colorPalette.classList.add('visible');
        brushControl.classList.remove('visible');
        // Make markers interactive with grab cursor in marker mode
        markersGroup.selectAll('.marker')
            .style("cursor", "grab")
            .style("pointer-events", "auto");
    }
}

function resetMap() {
    if (confirm('Are you sure you want to reset the map? This will clear all fog reveals and markers.')) {
        // Clear localStorage
        localStorage.removeItem('mapState');

        // Clear all reveal/fog shapes
        revealGroup.selectAll("*").remove();
        revealShapes = [];

        // Clear all markers
        markersGroup.selectAll("*").remove();
        markers = [];
        markerIdCounter = 0;

        alert('Map reset! All fog and markers cleared.');
    }
}

revealToolBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    setActiveTool('reveal');
});

tool2Btn.addEventListener('click', (e) => {
    e.stopPropagation();
    setActiveTool('tool2');
});

resetBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    resetMap();
});

// Color palette functionality
const colorButtons = document.querySelectorAll('.color-button');
colorButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        // Remove active class from all buttons
        colorButtons.forEach(b => b.classList.remove('active'));
        // Add active class to clicked button
        btn.classList.add('active');
        // Update current marker color
        currentMarkerColor = btn.dataset.color;
    });
});

// Brush size slider functionality
const brushSlider = document.getElementById('brush-size-slider');
const brushSizeValue = document.getElementById('brush-size-value');
const brushPreview = document.getElementById('brush-preview');

function updateBrushSize(value) {
    const size = parseInt(value);
    config.revealRadius = size;
    brushIndicator.attr("r", size);
    brushSizeValue.textContent = size + 'px';

    // Update preview circle size (scale to fit in 36px container)
    const previewSize = Math.min(32, (size / 200) * 32);
    brushPreview.style.setProperty('--preview-size', previewSize + 'px');
}

brushSlider.addEventListener('input', (e) => {
    e.stopPropagation();
    updateBrushSize(e.target.value);
});

// Initialize preview circle size
brushPreview.style.setProperty('--preview-size', '10px');

// Initialize brush control visibility (reveal tool is active by default)
document.getElementById('brush-control').classList.add('visible');
