import { ref } from 'vue'

/**
 * Generate a random torn paper edge clip-path
 * Creates an irregular polygon for the medieval parchment effect
 */
export function useTornEdges() {
  const clipPath = ref(generateTornPath())

  function generateTornPath() {
    // Generate random torn edge points
    // Creates a polygon with irregular edges simulating torn parchment
    const points = []

    // Top edge - slight irregularities
    points.push(`2% 0%`, `10% 1%`, `25% 0.5%`, `40% 1%`, `60% 0.5%`, `80% 1%`, `98% 0%`)

    // Right edge
    points.push(`100% 3%`, `99% 15%`, `100% 30%`, `99.5% 50%`, `100% 70%`, `99% 85%`, `100% 97%`)

    // Bottom edge
    points.push(`98% 100%`, `80% 99%`, `60% 99.5%`, `40% 99%`, `25% 99.5%`, `10% 99%`, `2% 100%`)

    // Left edge
    points.push(`0% 97%`, `1% 85%`, `0.5% 70%`, `1% 50%`, `0% 30%`, `1% 15%`, `0% 3%`)

    return `polygon(${points.join(', ')})`
  }

  function regenerate() {
    clipPath.value = generateTornPath()
  }

  return { clipPath, regenerate }
}

/**
 * Theme color palette
 * Medieval-themed colors from the original design
 */
export function useThemeColors() {
  return {
    parchment: {
      light: '#f4e8d0',
      default: '#e8d7b8',
      dark: '#c9b79c'
    },
    leather: {
      dark: '#3d2f1f',
      darker: '#2a1f15'
    },
    ink: {
      black: '#1a1410',
      faded: '#4a3829'
    },
    accent: {
      red: '#8b1e1e',
      gray: '#5a5552',
      gold: '#c9a961',
      green: '#2d5016',
      blue: '#2c4c7e'
    }
  }
}

/**
 * Marker and ping colors
 * 8 colors used for markers and viewer pings
 */
export function useMarkerColors() {
  return {
    blue: {
      fill: '#4a90e2',
      border: '#2c5aa0',
      stroke: '#1e3a66',
      ornament: '#6bb6ff'
    },
    red: {
      fill: '#e74c3c',
      border: '#c0392b',
      stroke: '#7f1d1d',
      ornament: '#ff6b6b'
    },
    green: {
      fill: '#27ae60',
      border: '#229954',
      stroke: '#145a32',
      ornament: '#58d68d'
    },
    yellow: {
      fill: '#f39c12',
      border: '#d68910',
      stroke: '#9c640c',
      ornament: '#f8c471'
    },
    purple: {
      fill: '#9b59b6',
      border: '#7d3c98',
      stroke: '#4a235a',
      ornament: '#bb8fce'
    },
    orange: {
      fill: '#e67e22',
      border: '#ca6f1e',
      stroke: '#935116',
      ornament: '#f0b27a'
    },
    cyan: {
      fill: '#1abc9c',
      border: '#17a589',
      stroke: '#0e6655',
      ornament: '#76d7c4'
    },
    pink: {
      fill: '#e91e63',
      border: '#c2185b',
      stroke: '#880e4f',
      ornament: '#f48fb1'
    }
  }
}
