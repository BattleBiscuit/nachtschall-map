/**
 * Fog Shape Optimization Service
 * Merges overlapping shapes to reduce storage/render overhead
 */

export class FogOptimizer {
  constructor() {
    this.gridSize = 100 // 100 viewBox units spatial grid
  }

  /**
   * Merge overlapping circles into larger circles
   */
  optimizeShapes(shapes) {
    if (shapes.length < 20) return shapes

    const revealShapes = shapes.filter(s => s.type === 'reveal')
    const fogShapes = shapes.filter(s => s.type === 'fog')

    const mergedReveals = this.mergeOverlapping(revealShapes)
    const mergedFogs = this.mergeOverlapping(fogShapes)

    const result = [...mergedReveals, ...mergedFogs]

    console.log(`[FogOptimizer] ${shapes.length} → ${result.length} shapes (${Math.round((1 - result.length / shapes.length) * 100)}% reduction)`)

    return result
  }

  /**
   * Merge overlapping shapes using spatial grid + clustering
   */
  mergeOverlapping(shapes) {
    if (shapes.length === 0) return []

    // Build spatial grid
    const grid = new Map()
    shapes.forEach((shape, idx) => {
      const cellX = Math.floor(shape.x / this.gridSize)
      const cellY = Math.floor(shape.y / this.gridSize)
      const key = `${cellX},${cellY}`
      if (!grid.has(key)) grid.set(key, [])
      grid.get(key).push({ ...shape, idx })
    })

    // Merge shapes per grid cell
    const merged = []
    const processed = new Set()

    grid.forEach((cellShapes) => {
      cellShapes.forEach((shape) => {
        if (processed.has(shape.idx)) return

        // Find all overlapping shapes
        const cluster = [shape]
        processed.add(shape.idx)

        for (const other of cellShapes) {
          if (processed.has(other.idx)) continue

          const dx = shape.x - other.x
          const dy = shape.y - other.y
          const distance = Math.sqrt(dx * dx + dy * dy)
          const overlapThreshold = (shape.radius + other.radius) * 0.6

          if (distance < overlapThreshold) {
            cluster.push(other)
            processed.add(other.idx)
          }
        }

        // Merge cluster into single circle
        if (cluster.length === 1) {
          merged.push({
            type: cluster[0].type,
            x: cluster[0].x,
            y: cluster[0].y,
            radius: cluster[0].radius
          })
        } else {
          // Calculate bounding circle
          const avgX = cluster.reduce((sum, s) => sum + s.x, 0) / cluster.length
          const avgY = cluster.reduce((sum, s) => sum + s.y, 0) / cluster.length
          const maxDist = Math.max(...cluster.map(s => {
            const dx = s.x - avgX
            const dy = s.y - avgY
            return Math.sqrt(dx * dx + dy * dy) + s.radius
          }))

          merged.push({
            type: cluster[0].type,
            x: avgX,
            y: avgY,
            radius: maxDist * 1.05  // 5% padding
          })
        }
      })
    })

    return merged
  }
}
