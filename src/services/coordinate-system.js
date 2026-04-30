/**
 * Coordinate System Service
 *
 * Handles normalization and denormalization of coordinates
 * to ensure fog/markers stay in correct positions across zoom levels
 */

export class CoordinateSystem {
  constructor() {
    this.mapDimensions = { x: 0, y: 0, width: 0, height: 0 }
  }

  /**
   * Set the current map dimensions
   */
  setMapDimensions(x, y, width, height) {
    this.mapDimensions = { x, y, width, height }
  }

  /**
   * Convert pixel coordinates to normalized coordinates (0-1 range)
   * @param {number} x - Pixel x coordinate
   * @param {number} y - Pixel y coordinate
   * @returns {{ nx: number, ny: number }}
   */
  normalize(x, y) {
    const { x: offsetX, y: offsetY, width, height } = this.mapDimensions

    if (width === 0 || height === 0) {
      console.warn('[CoordinateSystem] Map dimensions not set')
      return { nx: 0, ny: 0 }
    }

    return {
      nx: (x - offsetX) / width,
      ny: (y - offsetY) / height
    }
  }

  /**
   * Convert normalized coordinates (0-1 range) to pixel coordinates
   * @param {number} nx - Normalized x coordinate
   * @param {number} ny - Normalized y coordinate
   * @returns {{ x: number, y: number }}
   */
  denormalize(nx, ny) {
    const { x: offsetX, y: offsetY, width, height } = this.mapDimensions

    return {
      x: nx * width + offsetX,
      y: ny * height + offsetY
    }
  }

  /**
   * Get current map dimensions
   */
  getMapDimensions() {
    return { ...this.mapDimensions }
  }
}
