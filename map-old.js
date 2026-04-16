// Map configuration
const config = {
    revealRadius: 100,
    initialZoom: 1,
    minZoom: 0.5,
    maxZoom: 8
};

// Active tool state
let activeTool = 'reveal';

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

// Create defs for mask
const defs = svg.append("defs");

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
const fogGroup = g.append("g").attr("class", "fog-layer");

// Create Gefängnis von Rabenfels (Rabenfels Prison) map - Hand-drawn Parchment Style
function createRabenfelsMap() {
    const centerX = width / 2;
    const centerY = height / 2;
    const scale = Math.min(width, height) / 1000;

    // Parchment background
    mapGroup.append("rect")
        .attr("x", -10000)
        .attr("y", -10000)
        .attr("width", 20000)
        .attr("height", 20000)
        .attr("fill", "#f4e4c4");

    // Main cliff face - highly irregular organic shape
    const cliffPoints = [];
    const numPoints = 60;
    for (let i = 0; i < numPoints; i++) {
        const angle = (i / numPoints) * Math.PI * 2;
        const baseRadius = 520;
        const variation = Math.sin(i * 0.7) * 80 + Math.cos(i * 1.3) * 60 + (Math.random() - 0.5) * 40;
        const radius = (baseRadius + variation) * scale;

        cliffPoints.push({
            x: centerX + Math.cos(angle) * radius,
            y: centerY + Math.sin(angle) * radius * 0.85
        });
    }
    cliffPoints.push(cliffPoints[0]); // Close the path

    let cliffPath = `M ${cliffPoints[0].x},${cliffPoints[0].y}`;
    for (let i = 1; i < cliffPoints.length; i++) {
        const prev = cliffPoints[i - 1];
        const curr = cliffPoints[i];
        const cp1x = prev.x + (curr.x - prev.x) * 0.5 + (Math.random() - 0.5) * 15;
        const cp1y = prev.y + (curr.y - prev.y) * 0.5 + (Math.random() - 0.5) * 15;
        cliffPath += ` Q ${cp1x},${cp1y} ${curr.x},${curr.y}`;
    }

    mapGroup.append("path")
        .attr("d", cliffPath)
        .attr("fill", "url(#cliffGradient)")
        .attr("stroke", "#1a1108")
        .attr("stroke-width", 4);

    // Add rocky cliff texture layers
    for (let layer = 0; layer < 3; layer++) {
        for (let i = 0; i < 80; i++) {
            const angle = Math.random() * Math.PI * 2;
            const dist = (380 + layer * 50 + Math.random() * 80) * scale;
            const x = centerX + Math.cos(angle) * dist;
            const y = centerY + Math.sin(angle) * dist * 0.85;

            const rockPoints = [];
            const sides = 5 + Math.floor(Math.random() * 4);
            for (let j = 0; j < sides; j++) {
                const a = (j / sides) * Math.PI * 2;
                const r = (8 + Math.random() * 12) * scale;
                rockPoints.push({
                    x: x + Math.cos(a) * r,
                    y: y + Math.sin(a) * r
                });
            }
            rockPoints.push(rockPoints[0]);

            let rockPath = `M ${rockPoints[0].x},${rockPoints[0].y}`;
            for (let j = 1; j < rockPoints.length; j++) {
                rockPath += ` L ${rockPoints[j].x},${rockPoints[j].y}`;
            }

            const shade = 0.3 + layer * 0.15 + Math.random() * 0.2;
            mapGroup.append("path")
                .attr("d", rockPath)
                .attr("fill", `rgba(90, 79, 69, ${shade})`)
                .attr("stroke", `rgba(58, 47, 37, ${shade + 0.2})`)
                .attr("stroke-width", 1);
        }
    }

    // Inner courtyard area - organic irregular shape
    const courtyardPoints = [
        { x: centerX - 310 * scale, y: centerY - 60 * scale },
        { x: centerX - 305 * scale, y: centerY + 5 * scale },
        { x: centerX - 308 * scale, y: centerY + 80 * scale },
        { x: centerX - 300 * scale, y: centerY + 160 * scale },
        { x: centerX - 295 * scale, y: centerY + 255 * scale },
        { x: centerX - 180 * scale, y: centerY + 262 * scale },
        { x: centerX - 50 * scale, y: centerY + 258 * scale },
        { x: centerX + 80 * scale, y: centerY + 265 * scale },
        { x: centerX + 200 * scale, y: centerY + 260 * scale },
        { x: centerX + 305 * scale, y: centerY + 253 * scale },
        { x: centerX + 310 * scale, y: centerY + 150 * scale },
        { x: centerX + 308 * scale, y: centerY + 50 * scale },
        { x: centerX + 305 * scale, y: centerY - 55 * scale },
        { x: centerX + 200 * scale, y: centerY - 62 * scale },
        { x: centerX + 80 * scale, y: centerY - 58 * scale },
        { x: centerX - 50 * scale, y: centerY - 60 * scale },
        { x: centerX - 180 * scale, y: centerY - 63 * scale }
    ];

    let courtPath = `M ${courtyardPoints[0].x},${courtyardPoints[0].y}`;
    for (let i = 1; i < courtyardPoints.length; i++) {
        const prev = courtyardPoints[i - 1];
        const curr = courtyardPoints[i];
        const cp1x = prev.x + (curr.x - prev.x) * 0.5;
        const cp1y = prev.y + (curr.y - prev.y) * 0.5;
        courtPath += ` Q ${cp1x},${cp1y} ${curr.x},${curr.y}`;
    }
    courtPath += ` Q ${(courtyardPoints[courtyardPoints.length - 1].x + courtyardPoints[0].x) / 2},${(courtyardPoints[courtyardPoints.length - 1].y + courtyardPoints[0].y) / 2} ${courtyardPoints[0].x},${courtyardPoints[0].y} Z`;

    mapGroup.append("path")
        .attr("d", courtPath)
        .attr("fill", "#6b5a48")
        .attr("stroke", "#3b2a18")
        .attr("stroke-width", 4);

    // Stone courtyard tiles - organic irregular stones
    for (let i = -3; i <= 3; i++) {
        for (let j = 0; j <= 3; j++) {
            if (Math.random() > 0.2) {
                const baseX = centerX + i * 75 * scale + (Math.random() - 0.5) * 30 * scale;
                const baseY = centerY + j * 75 * scale + (Math.random() - 0.5) * 30 * scale;

                const stonePoints = [];
                const corners = 5 + Math.floor(Math.random() * 3);
                for (let k = 0; k < corners; k++) {
                    const angle = (k / corners) * Math.PI * 2;
                    const radius = (25 + Math.random() * 20) * scale;
                    stonePoints.push({
                        x: baseX + Math.cos(angle) * radius,
                        y: baseY + Math.sin(angle) * radius
                    });
                }

                let stonePath = `M ${stonePoints[0].x},${stonePoints[0].y}`;
                for (let k = 1; k < stonePoints.length; k++) {
                    stonePath += ` L ${stonePoints[k].x},${stonePoints[k].y}`;
                }
                stonePath += ` Z`;

                const stoneColors = ["#7b6a58", "#6b5a48", "#8b7a68", "#5b4a38"];
                mapGroup.append("path")
                    .attr("d", stonePath)
                    .attr("fill", stoneColors[Math.floor(Math.random() * stoneColors.length)])
                    .attr("stroke", "#4b3a28")
                    .attr("stroke-width", 2);
            }
        }
    }

    // Zellentrakt - hand-carved into cliff wall with irregular edges
    const cellBlockOutline = [
        { x: centerX - 405 * scale, y: centerY - 255 * scale },
        { x: centerX - 398 * scale, y: centerY - 248 * scale },
        { x: centerX - 315 * scale, y: centerY - 252 * scale },
        { x: centerX - 310 * scale, y: centerY - 245 * scale },
        { x: centerX - 312 * scale, y: centerY - 180 * scale },
        { x: centerX - 308 * scale, y: centerY - 100 * scale },
        { x: centerX - 310 * scale, y: centerY - 20 * scale },
        { x: centerX - 315 * scale, y: centerY + 50 * scale },
        { x: centerX - 318 * scale, y: centerY + 85 * scale },
        { x: centerX - 395 * scale, y: centerY + 82 * scale },
        { x: centerX - 402 * scale, y: centerY + 75 * scale },
        { x: centerX - 408 * scale, y: centerY + 20 * scale },
        { x: centerX - 405 * scale, y: centerY - 60 * scale },
        { x: centerX - 410 * scale, y: centerY - 140 * scale },
        { x: centerX - 407 * scale, y: centerY - 210 * scale }
    ];

    let cellPath = `M ${cellBlockOutline[0].x},${cellBlockOutline[0].y}`;
    for (let i = 1; i < cellBlockOutline.length; i++) {
        const prev = cellBlockOutline[i - 1];
        const curr = cellBlockOutline[i];
        const cp1x = prev.x + (curr.x - prev.x) * 0.6 + (Math.random() - 0.5) * 8;
        const cp1y = prev.y + (curr.y - prev.y) * 0.6 + (Math.random() - 0.5) * 8;
        cellPath += ` Q ${cp1x},${cp1y} ${curr.x},${curr.y}`;
    }
    cellPath += ` Z`;

    // Add stone texture gradient
    const cellGradient = defs.append("linearGradient")
        .attr("id", "cellGradient")
        .attr("x1", "0%")
        .attr("y1", "0%")
        .attr("x2", "100%")
        .attr("y2", "100%");

    cellGradient.append("stop")
        .attr("offset", "0%")
        .attr("stop-color", "#2a1f15");

    cellGradient.append("stop")
        .attr("offset", "100%")
        .attr("stop-color", "#1a0f05");

    mapGroup.append("path")
        .attr("d", cellPath)
        .attr("fill", "url(#cellGradient)")
        .attr("stroke", "#0a0000")
        .attr("stroke-width", 5);

    // Add carved stone blocks to walls
    for (let i = 0; i < 25; i++) {
        const bx = centerX - 400 * scale + Math.random() * 80 * scale;
        const by = centerY - 240 * scale + Math.random() * 310 * scale;

        const blockW = (15 + Math.random() * 25) * scale;
        const blockH = (12 + Math.random() * 18) * scale;

        mapGroup.append("path")
            .attr("d", `M ${bx},${by}
                        L ${bx + blockW},${by + (Math.random() - 0.5) * 3}
                        L ${bx + blockW + (Math.random() - 0.5) * 3},${by + blockH}
                        L ${bx + (Math.random() - 0.5) * 3},${by + blockH} Z`)
            .attr("fill", "none")
            .attr("stroke", "rgba(60, 50, 40, 0.6)")
            .attr("stroke-width", 1.5);
    }

    // Cell doors with organic arched frames
    for (let i = 0; i < 6; i++) {
        const cellY = centerY - 230 * scale + i * 55 * scale;
        const cellX = centerX - 370 * scale;

        // Arched door frame - hand-carved stone
        const doorFrame = `M ${cellX - 8 * scale},${cellY + 50 * scale}
                          L ${cellX - 8 * scale},${cellY + 10 * scale}
                          Q ${cellX - 8 * scale},${cellY - 5 * scale} ${cellX},${cellY - 8 * scale}
                          Q ${cellX + 8 * scale},${cellY - 5 * scale} ${cellX + 45 * scale},${cellY - 5 * scale}
                          Q ${cellX + 53 * scale},${cellY - 8 * scale} ${cellX + 53 * scale},${cellY}
                          Q ${cellX + 53 * scale},${cellY + 5 * scale} ${cellX + 53 * scale},${cellY + 10 * scale}
                          L ${cellX + 53 * scale},${cellY + 50 * scale}
                          L ${cellX + 45 * scale},${cellY + 52 * scale}
                          L ${cellX},${cellY + 52 * scale} Z`;

        mapGroup.append("path")
            .attr("d", doorFrame)
            .attr("fill", "#1a1005")
            .attr("stroke", "#0a0000")
            .attr("stroke-width", 3);

        // Wooden door texture
        for (let p = 0; p < 8; p++) {
            mapGroup.append("line")
                .attr("x1", cellX)
                .attr("y1", cellY + 2 * scale + p * 6 * scale)
                .attr("x2", cellX + 45 * scale)
                .attr("y2", cellY + 2 * scale + p * 6 * scale)
                .attr("stroke", "rgba(60, 40, 20, 0.4)")
                .attr("stroke-width", 1);
        }

        // Iron bars - hand-forged appearance
        for (let b = 0; b < 6; b++) {
            const barX = cellX + 5 * scale + b * 7 * scale;
            const barPath = `M ${barX},${cellY}
                            C ${barX + (Math.random() - 0.5) * 1},${cellY + 12 * scale}
                              ${barX + (Math.random() - 0.5) * 1},${cellY + 25 * scale}
                              ${barX},${cellY + 37 * scale}`;

            mapGroup.append("path")
                .attr("d", barPath)
                .attr("fill", "none")
                .attr("stroke", "#4a4a4a")
                .attr("stroke-width", 2.5)
                .attr("stroke-linecap", "round");

            // Iron rivets
            mapGroup.append("circle")
                .attr("cx", barX)
                .attr("cy", cellY + 2 * scale)
                .attr("r", 1.5 * scale)
                .attr("fill", "#3a3a3a");

            mapGroup.append("circle")
                .attr("cx", barX)
                .attr("cy", cellY + 35 * scale)
                .attr("r", 1.5 * scale)
                .attr("fill", "#3a3a3a");
        }

        // Door handle/lock
        mapGroup.append("circle")
            .attr("cx", cellX + 38 * scale)
            .attr("cy", cellY + 25 * scale)
            .attr("r", 3 * scale)
            .attr("fill", "#2a2a2a")
            .attr("stroke", "#1a1a1a")
            .attr("stroke-width", 1.5);
    }

    // Wachstube (Guard room) - medieval stone building with organic walls
    const guardWalls = [
        { x: centerX - 255 * scale, y: centerY - 255 * scale },
        { x: centerX - 248 * scale, y: centerY - 248 * scale },
        { x: centerX - 148 * scale, y: centerY - 252 * scale },
        { x: centerX - 145 * scale, y: centerY - 245 * scale },
        { x: centerX - 147 * scale, y: centerY - 200 * scale },
        { x: centerX - 145 * scale, y: centerY - 150 * scale },
        { x: centerX - 148 * scale, y: centerY - 145 * scale },
        { x: centerX - 250 * scale, y: centerY - 147 * scale },
        { x: centerX - 258 * scale, y: centerY - 152 * scale },
        { x: centerX - 257 * scale, y: centerY - 200 * scale }
    ];

    let guardPath = `M ${guardWalls[0].x},${guardWalls[0].y}`;
    for (let i = 1; i < guardWalls.length; i++) {
        guardPath += ` L ${guardWalls[i].x + (Math.random() - 0.5) * 3},${guardWalls[i].y + (Math.random() - 0.5) * 3}`;
    }
    guardPath += ` Z`;

    mapGroup.append("path")
        .attr("d", guardPath)
        .attr("fill", "#5a4a38")
        .attr("stroke", "#2a1a08")
        .attr("stroke-width", 5);

    // Stone blocks - irregular medieval masonry
    const blockRows = 5;
    const blocksPerRow = 6;
    for (let row = 0; row < blockRows; row++) {
        for (let col = 0; col < blocksPerRow; col++) {
            const bx = centerX - 245 * scale + col * 17 * scale + (Math.random() - 0.5) * 5 * scale;
            const by = centerY - 240 * scale + row * 20 * scale + (Math.random() - 0.5) * 3 * scale;
            const bw = (14 + Math.random() * 8) * scale;
            const bh = (16 + Math.random() * 6) * scale;

            mapGroup.append("path")
                .attr("d", `M ${bx},${by}
                            L ${bx + bw},${by + (Math.random() - 0.5) * 2}
                            L ${bx + bw},${by + bh}
                            L ${bx},${by + bh} Z`)
                .attr("fill", "none")
                .attr("stroke", "#4a3a28")
                .attr("stroke-width", 1.5);
        }
    }

    // Wooden door - hand-hewn planks
    const doorX = centerX - 212 * scale;
    const doorY = centerY - 195 * scale;

    // Door frame
    mapGroup.append("path")
        .attr("d", `M ${doorX - 5 * scale},${doorY - 5 * scale}
                    L ${doorX + 28 * scale},${doorY - 5 * scale}
                    Q ${doorX + 30 * scale},${doorY - 3 * scale} ${doorX + 30 * scale},${doorY}
                    L ${doorX + 30 * scale},${doorY + 38 * scale}
                    L ${doorX - 5 * scale},${doorY + 40 * scale} Z`)
        .attr("fill", "#3a2010")
        .attr("stroke", "#1a1000")
        .attr("stroke-width", 3);

    // Wood grain
    for (let i = 0; i < 6; i++) {
        mapGroup.append("path")
            .attr("d", `M ${doorX},${doorY + i * 6 * scale}
                        Q ${doorX + 10 * scale},${doorY + i * 6 * scale + (Math.random() - 0.5) * 2}
                          ${doorX + 22 * scale},${doorY + i * 6 * scale}`)
            .attr("fill", "none")
            .attr("stroke", "rgba(50, 30, 10, 0.5)")
            .attr("stroke-width", 1);
    }

    // Iron hinges
    for (let h = 0; h < 2; h++) {
        const hy = doorY + 8 * scale + h * 22 * scale;
        mapGroup.append("path")
            .attr("d", `M ${doorX - 3 * scale},${hy}
                        L ${doorX + 5 * scale},${hy}`)
            .attr("stroke", "#2a2a2a")
            .attr("stroke-width", 3)
            .attr("stroke-linecap", "round");

        mapGroup.append("circle")
            .attr("cx", doorX + 2 * scale)
            .attr("cy", hy)
            .attr("r", 2 * scale)
            .attr("fill", "#3a3a3a");
    }

    // Waschküche (Laundry) - weathered stone washhouse
    const laundryPoints = [
        { x: centerX - 395 * scale, y: centerY + 98 * scale },
        { x: centerX - 308 * scale, y: centerY + 102 * scale },
        { x: centerX - 305 * scale, y: centerY + 185 * scale },
        { x: centerX - 392 * scale, y: centerY + 182 * scale }
    ];

    let laundryPath = `M ${laundryPoints[0].x},${laundryPoints[0].y}`;
    for (let i = 1; i < laundryPoints.length; i++) {
        laundryPath += ` L ${laundryPoints[i].x + (Math.random() - 0.5) * 4},${laundryPoints[i].y + (Math.random() - 0.5) * 4}`;
    }
    laundryPath += ` Z`;

    mapGroup.append("path")
        .attr("d", laundryPath)
        .attr("fill", "#4a5555")
        .attr("stroke", "#2a3535")
        .attr("stroke-width", 4);

    // Water stains and moss
    for (let i = 0; i < 15; i++) {
        mapGroup.append("circle")
            .attr("cx", centerX - 390 * scale + Math.random() * 85 * scale)
            .attr("cy", centerY + 105 * scale + Math.random() * 75 * scale)
            .attr("r", (2 + Math.random() * 4) * scale)
            .attr("fill", `rgba(60, 80, 60, ${0.2 + Math.random() * 0.3})`);
    }

    // Chimney - brick construction
    const chimneyPoints = [
        { x: centerX - 372 * scale, y: centerY + 88 * scale },
        { x: centerX - 358 * scale, y: centerY + 90 * scale },
        { x: centerX - 356 * scale, y: centerY + 65 * scale },
        { x: centerX - 370 * scale, y: centerY + 63 * scale }
    ];

    let chimneyPath = `M ${chimneyPoints[0].x},${chimneyPoints[0].y}`;
    for (let i = 1; i < chimneyPoints.length; i++) {
        chimneyPath += ` L ${chimneyPoints[i].x},${chimneyPoints[i].y}`;
    }
    chimneyPath += ` Z`;

    mapGroup.append("path")
        .attr("d", chimneyPath)
        .attr("fill", "#3a3030")
        .attr("stroke", "#1a1010")
        .attr("stroke-width", 2);

    // Brick pattern on chimney
    for (let b = 0; b < 4; b++) {
        mapGroup.append("line")
            .attr("x1", centerX - 370 * scale)
            .attr("y1", centerY + 85 * scale - b * 6 * scale)
            .attr("x2", centerX - 358 * scale)
            .attr("y2", centerY + 85 * scale - b * 6 * scale)
            .attr("stroke", "#2a2020")
            .attr("stroke-width", 1);
    }

    // Kommandantenbüro (Commander's Office) - fortified tower
    const commanderTower = `M ${centerX - 80 * scale},${centerY - 280 * scale}
                            L ${centerX + 80 * scale},${centerY - 280 * scale}
                            L ${centerX + 80 * scale},${centerY - 100 * scale}
                            L ${centerX - 80 * scale},${centerY - 100 * scale} Z`;

    mapGroup.append("path")
        .attr("d", commanderTower)
        .attr("fill", "#5a4030")
        .attr("stroke", "#2a1010")
        .attr("stroke-width", 5);

    // Tower battlements
    for (let i = 0; i < 6; i++) {
        mapGroup.append("rect")
            .attr("x", centerX - 80 * scale + i * 27 * scale)
            .attr("y", centerY - 295 * scale)
            .attr("width", 20 * scale)
            .attr("height", 20 * scale)
            .attr("fill", "#6a5040")
            .attr("stroke", "#2a1010")
            .attr("stroke-width", 2);
    }

    // Windows
    for (let i = 0; i < 2; i++) {
        for (let j = 0; j < 3; j++) {
            mapGroup.append("rect")
                .attr("x", centerX - 60 * scale + i * 70 * scale)
                .attr("y", centerY - 250 * scale + j * 50 * scale)
                .attr("width", 15 * scale)
                .attr("height", 25 * scale)
                .attr("fill", "#1a1a0a")
                .attr("stroke", "#0a0a00")
                .attr("stroke-width", 2);
        }
    }

    // Die Garnison (Garrison) - large medieval barracks carved into cliff
    const garrison = `M ${centerX + 150 * scale},${centerY - 250 * scale}
                      L ${centerX + 380 * scale},${centerY - 250 * scale}
                      L ${centerX + 390 * scale},${centerY - 240 * scale}
                      L ${centerX + 390 * scale},${centerY + 80 * scale}
                      L ${centerX + 150 * scale},${centerY + 80 * scale} Z`;

    mapGroup.append("path")
        .attr("d", garrison)
        .attr("fill", "#4a3a28")
        .attr("stroke", "#1a0a00")
        .attr("stroke-width", 5);

    // Barracks windows (small slits)
    for (let i = 0; i < 5; i++) {
        for (let j = 0; j < 6; j++) {
            mapGroup.append("rect")
                .attr("x", centerX + 170 * scale + i * 45 * scale)
                .attr("y", centerY - 230 * scale + j * 50 * scale)
                .attr("width", 8 * scale)
                .attr("height", 20 * scale)
                .attr("fill", "#1a1a0a")
                .attr("stroke", "#0a0a00")
                .attr("stroke-width", 1);
        }
    }

    // Haupttor & Fallgitter (Main gate with portcullis)
    const gateStructure = `M ${centerX - 60 * scale},${centerY + 250 * scale}
                           L ${centerX - 60 * scale},${centerY + 320 * scale}
                           L ${centerX + 60 * scale},${centerY + 320 * scale}
                           L ${centerX + 60 * scale},${centerY + 250 * scale} Z`;

    mapGroup.append("path")
        .attr("d", gateStructure)
        .attr("fill", "#3a2a1a")
        .attr("stroke", "#1a0a00")
        .attr("stroke-width", 6);

    // Gate arch
    mapGroup.append("path")
        .attr("d", `M ${centerX - 50 * scale},${centerY + 250 * scale}
                    Q ${centerX},${centerY + 220 * scale} ${centerX + 50 * scale},${centerY + 250 * scale}`)
        .attr("fill", "none")
        .attr("stroke", "#2a1a0a")
        .attr("stroke-width", 4);

    // Portcullis (iron gate)
    for (let i = 0; i < 8; i++) {
        mapGroup.append("line")
            .attr("x1", centerX - 45 * scale + i * 13 * scale)
            .attr("y1", centerY + 255 * scale)
            .attr("x2", centerX - 45 * scale + i * 13 * scale)
            .attr("y2", centerY + 315 * scale)
            .attr("stroke", "#444")
            .attr("stroke-width", 3);
    }

    // Horizontal bars
    for (let i = 0; i < 4; i++) {
        mapGroup.append("line")
            .attr("x1", centerX - 45 * scale)
            .attr("y1", centerY + 265 * scale + i * 15 * scale)
            .attr("x2", centerX + 45 * scale)
            .attr("y2", centerY + 265 * scale + i * 15 * scale)
            .attr("stroke", "#444")
            .attr("stroke-width", 3);
    }

    // Kanalisation entrance (hidden sewer grate)
    const sewerEntrance = `M ${centerX - 350 * scale},${centerY + 180 * scale}
                           L ${centerX - 320 * scale},${centerY + 180 * scale}
                           L ${centerX - 320 * scale},${centerY + 210 * scale}
                           L ${centerX - 350 * scale},${centerY + 210 * scale} Z`;

    mapGroup.append("path")
        .attr("d", sewerEntrance)
        .attr("fill", "#1a1a0a")
        .attr("stroke", "#0a0a00")
        .attr("stroke-width", 2);

    // Sewer grate bars
    for (let i = 0; i < 4; i++) {
        mapGroup.append("line")
            .attr("x1", centerX - 345 * scale + i * 8 * scale)
            .attr("y1", centerY + 185 * scale)
            .attr("x2", centerX - 345 * scale + i * 8 * scale)
            .attr("y2", centerY + 205 * scale)
            .attr("stroke", "#333")
            .attr("stroke-width", 2);
    }

    // Sewer tunnel path (underground - dashed)
    const sewerPath = `M ${centerX - 335 * scale},${centerY + 210 * scale}
                       Q ${centerX - 400 * scale},${centerY + 300 * scale}
                         ${centerX - 350 * scale},${centerY + 380 * scale}`;

    mapGroup.append("path")
        .attr("d", sewerPath)
        .attr("fill", "none")
        .attr("stroke", "#2a2a1a")
        .attr("stroke-width", 12)
        .attr("stroke-dasharray", "15,10")
        .attr("opacity", 0.6);

    // Cliff path to bridge
    const pathToBridge = `M ${centerX},${centerY + 320 * scale}
                       L ${centerX + 200 * scale},${centerY + 380 * scale}`;

    mapGroup.append("path")
        .attr("d", pathToBridge)
        .attr("fill", "none")
        .attr("stroke", "#5a4a38")
        .attr("stroke-width", 35);

    // Rocky cliff edges along path
    for (let i = 0; i < 8; i++) {
        mapGroup.append("circle")
            .attr("cx", centerX + 25 * i * scale + 10 * scale)
            .attr("cy", centerY + 328 * scale + i * 8 * scale)
            .attr("r", (5 + Math.random() * 8) * scale)
            .attr("fill", "#4a3a28")
            .attr("stroke", "#2a1a08")
            .attr("stroke-width", 1);
    }

    // Klippenbrücke (Rope bridge over abyss)
    const bridgeStart = { x: centerX + 200 * scale, y: centerY + 380 * scale };
    const bridgeEnd = { x: centerX + 450 * scale, y: centerY + 420 * scale };

    // Rope sides
    mapGroup.append("path")
        .attr("d", `M ${bridgeStart.x},${bridgeStart.y - 10 * scale}
                    Q ${centerX + 325 * scale},${centerY + 410 * scale}
                      ${bridgeEnd.x},${bridgeEnd.y - 10 * scale}`)
        .attr("fill", "none")
        .attr("stroke", "#4a3a2a")
        .attr("stroke-width", 3);

    mapGroup.append("path")
        .attr("d", `M ${bridgeStart.x},${bridgeStart.y + 10 * scale}
                    Q ${centerX + 325 * scale},${centerY + 420 * scale}
                      ${bridgeEnd.x},${bridgeEnd.y + 10 * scale}`)
        .attr("fill", "none")
        .attr("stroke", "#4a3a2a")
        .attr("stroke-width", 3);

    // Wooden planks
    for (let i = 0; i < 12; i++) {
        const t = i / 11;
        const x = bridgeStart.x + (bridgeEnd.x - bridgeStart.x) * t;
        const y = bridgeStart.y + (bridgeEnd.y - bridgeStart.y) * t + Math.sin(t * Math.PI) * 10 * scale;

        mapGroup.append("rect")
            .attr("x", x - 15 * scale)
            .attr("y", y - 3 * scale)
            .attr("width", 30 * scale)
            .attr("height", 6 * scale)
            .attr("fill", "#6a4a2a")
            .attr("stroke", "#3a2a0a")
            .attr("stroke-width", 1)
            .attr("transform", `rotate(${15 + Math.random() * 10}, ${x}, ${y})`);

        // Rope connections
        if (i % 2 === 0) {
            mapGroup.append("line")
                .attr("x1", x - 12 * scale)
                .attr("y1", y - 10 * scale)
                .attr("x2", x - 12 * scale)
                .attr("y2", y + 10 * scale)
                .attr("stroke", "#3a2a1a")
                .attr("stroke-width", 1.5);
        }
    }

    // Elite Sentinels on bridge
    const sentinelPositions = [
        { x: centerX + 250 * scale, y: centerY + 395 * scale },
        { x: centerX + 380 * scale, y: centerY + 410 * scale }
    ];

    sentinelPositions.forEach(pos => {
        // Sentinel body
        mapGroup.append("circle")
            .attr("cx", pos.x)
            .attr("cy", pos.y)
            .attr("r", 12 * scale)
            .attr("fill", "#8a0000")
            .attr("stroke", "#5a0000")
            .attr("stroke-width", 3);

        // Helmet/head
        mapGroup.append("circle")
            .attr("cx", pos.x)
            .attr("cy", pos.y - 8 * scale)
            .attr("r", 6 * scale)
            .attr("fill", "#666")
            .attr("stroke", "#333")
            .attr("stroke-width", 2);

        // Spear
        mapGroup.append("line")
            .attr("x1", pos.x + 10 * scale)
            .attr("y1", pos.y - 15 * scale)
            .attr("x2", pos.x + 10 * scale)
            .attr("y2", pos.y + 20 * scale)
            .attr("stroke", "#3a2a1a")
            .attr("stroke-width", 2);

        // Spear tip
        mapGroup.append("path")
            .attr("d", `M ${pos.x + 10 * scale},${pos.y - 20 * scale}
                        L ${pos.x + 6 * scale},${pos.y - 12 * scale}
                        L ${pos.x + 14 * scale},${pos.y - 12 * scale} Z`)
            .attr("fill", "#888")
            .attr("stroke", "#444")
            .attr("stroke-width", 1);
    });

    // Watchtowers at cliff edges
    const towerPositions = [
        { x: centerX - 300 * scale, y: centerY - 280 * scale },
        { x: centerX + 300 * scale, y: centerY - 280 * scale },
        { x: centerX - 300 * scale, y: centerY + 250 * scale },
        { x: centerX + 300 * scale, y: centerY + 250 * scale }
    ];

    towerPositions.forEach(pos => {
        // Tower base (stone)
        mapGroup.append("circle")
            .attr("cx", pos.x)
            .attr("cy", pos.y)
            .attr("r", 35 * scale)
            .attr("fill", "#4a3a2a")
            .attr("stroke", "#2a1a0a")
            .attr("stroke-width", 4);

        // Tower battlements
        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2;
            const bx = pos.x + Math.cos(angle) * 35 * scale;
            const by = pos.y + Math.sin(angle) * 35 * scale;

            if (i % 2 === 0) {
                mapGroup.append("rect")
                    .attr("x", bx - 6 * scale)
                    .attr("y", by - 15 * scale)
                    .attr("width", 12 * scale)
                    .attr("height", 15 * scale)
                    .attr("fill", "#5a4a3a")
                    .attr("stroke", "#2a1a0a")
                    .attr("stroke-width", 2);
            }
        }

        // Conical roof
        mapGroup.append("path")
            .attr("d", `M ${pos.x - 45 * scale},${pos.y}
                        L ${pos.x},${pos.y - 50 * scale}
                        L ${pos.x + 45 * scale},${pos.y} Z`)
            .attr("fill", "#6a3a2a")
            .attr("stroke", "#3a1a0a")
            .attr("stroke-width", 3);

        // Arrow slit
        mapGroup.append("rect")
            .attr("x", pos.x - 3 * scale)
            .attr("y", pos.y - 10 * scale)
            .attr("width", 6 * scale)
            .attr("height", 20 * scale)
            .attr("fill", "#0a0a00")
            .attr("stroke", "#000")
            .attr("stroke-width", 1);
    });

    // Add labels with medieval font style
    const labelData = [
        { text: "Zellentrakt", x: centerX - 355 * scale, y: centerY - 280 * scale, size: 16 },
        { text: "Wachstube", x: centerX - 200 * scale, y: centerY - 280 * scale, size: 14 },
        { text: "Waschküche", x: centerX - 350 * scale, y: centerY + 90 * scale, size: 13 },
        { text: "Kommandantenbüro", x: centerX, y: centerY - 310 * scale, size: 15 },
        { text: "Die Garnison", x: centerX + 270 * scale, y: centerY - 280 * scale, size: 16 },
        { text: "Innenhof", x: centerX, y: centerY + 150 * scale, size: 18 },
        { text: "Haupttor", x: centerX, y: centerY + 340 * scale, size: 14 },
        { text: "Klippenbrücke", x: centerX + 325 * scale, y: centerY + 450 * scale, size: 15 },
        { text: "Kanalisation", x: centerX - 335 * scale, y: centerY + 230 * scale, size: 12 }
    ];

    labelData.forEach(label => {
        // Text shadow for readability
        mapGroup.append("text")
            .attr("x", label.x)
            .attr("y", label.y)
            .attr("text-anchor", "middle")
            .attr("fill", "#000")
            .attr("font-size", label.size * scale)
            .attr("font-weight", "bold")
            .attr("font-family", "serif")
            .attr("stroke", "#000")
            .attr("stroke-width", 4)
            .text(label.text);

        mapGroup.append("text")
            .attr("x", label.x)
            .attr("y", label.y)
            .attr("text-anchor", "middle")
            .attr("fill", "#f4e4c4")
            .attr("font-size", label.size * scale)
            .attr("font-weight", "bold")
            .attr("font-family", "serif")
            .text(label.text);
    });
}

createRabenfelsMap();

// Create fog overlay
fogGroup.append("rect")
    .attr("x", -10000)
    .attr("y", -10000)
    .attr("width", 20000)
    .attr("height", 20000)
    .attr("class", "fog-overlay")
    .attr("mask", "url(#fog-mask)");

// Function to reveal area at position
function revealArea(x, y) {
    const circle = revealGroup.append("circle")
        .attr("cx", x)
        .attr("cy", y)
        .attr("r", 0)
        .attr("fill", "black");

    circle.transition()
        .duration(300)
        .attr("r", config.revealRadius);

    revealedAreas.push({ x, y, radius: config.revealRadius });
}

// Zoom behavior with filter to only pan on Ctrl+drag
const zoom = d3.zoom()
    .scaleExtent([config.minZoom, config.maxZoom])
    .filter((event) => {
        // Allow wheel zoom always
        if (event.type === 'wheel') return true;
        // Allow pan only when Ctrl is pressed
        if (event.type === 'mousedown' || event.type === 'mousemove') {
            return event.ctrlKey;
        }
        return false;
    })
    .on("zoom", (event) => {
        g.attr("transform", event.transform);
    });

svg.call(zoom);

// Mouse/touch interaction for revealing
let isMouseDown = false;
let isDragging = false;
let lastRevealTime = 0;
const revealThrottle = 50; // milliseconds

svg.on("mousedown touchstart", function(event) {
    // Only track mouse down for reveal tool if Ctrl is not pressed
    if (!event.ctrlKey) {
        isMouseDown = true;
        isDragging = false;
    }
});

svg.on("mouseup touchend", function(event) {
    isMouseDown = false;
});

svg.on("mousemove touchmove", function(event) {
    // Only reveal if mouse is down and Ctrl is not pressed (not panning)
    if (isMouseDown && !event.ctrlKey) {
        isDragging = true;

        if (activeTool === 'reveal') {
            const now = Date.now();
            if (now - lastRevealTime < revealThrottle) return;
            lastRevealTime = now;

            const [x, y] = d3.pointer(event, g.node());
            revealArea(x, y);
        }
    }
});

svg.on("click", function(event) {
    // Only reveal on click if not dragging and Ctrl is not pressed
    if (!isDragging && !event.ctrlKey) {
        if (activeTool === 'reveal') {
            const [x, y] = d3.pointer(event, g.node());
            revealArea(x, y);
        }
        // Tool 2 functionality will go here
    }
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
});

// Initial reveal at center
setTimeout(() => {
    revealArea(width / 2, height / 2);
}, 500);

// Tool button functionality
const revealToolBtn = document.getElementById('reveal-tool');
const tool2Btn = document.getElementById('tool-2');

function setActiveTool(tool) {
    activeTool = tool;

    // Update button states
    revealToolBtn.classList.remove('active');
    tool2Btn.classList.remove('active');

    if (tool === 'reveal') {
        revealToolBtn.classList.add('active');
        revealToolBtn.title = 'Reveal Tool (Active)';
        tool2Btn.title = 'Tool 2';
    } else if (tool === 'tool2') {
        tool2Btn.classList.add('active');
        tool2Btn.title = 'Tool 2 (Active)';
        revealToolBtn.title = 'Reveal Tool';
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
