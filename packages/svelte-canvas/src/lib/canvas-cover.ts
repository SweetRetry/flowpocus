/**
 * Generate a deterministic color palette from a string (canvas ID)
 * Uses a simple hash function to ensure same ID always produces same colors
 */
function hashString(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash // Convert to 32bit integer
  }
  return Math.abs(hash)
}

/**
 * Generate HSL color from hash
 */
function hashToHSL(hash: number, index: number): string {
  const hue = (hash + index * 137) % 360
  const saturation = 60 + (hash % 30) // 60-90%
  const lightness = 50 + ((hash + index * 50) % 20) // 50-70%
  return `hsl(${hue}, ${saturation}%, ${lightness}%)`
}

/**
 * Generate SVG cover pattern from canvas ID
 * Creates a unique, deterministic abstract pattern
 */
export function generateCanvasCover(canvasId: string): string {
  const hash = hashString(canvasId)

  // Generate colors
  const color1 = hashToHSL(hash, 0)
  const color2 = hashToHSL(hash, 1)
  const color3 = hashToHSL(hash, 2)
  const color4 = hashToHSL(hash, 3)

  // Pattern type based on hash
  const patternType = hash % 5

  switch (patternType) {
    case 0:
      return generateCirclePattern(color1, color2, color3, color4, hash)
    case 1:
      return generateWavePattern(color1, color2, color3, hash)
    case 2:
      return generateGridPattern(color1, color2, color3, color4, hash)
    case 3:
      return generateBlobPattern(color1, color2, color3, hash)
    default:
      return generateGradientPattern(color1, color2, color3, color4)
  }
}

function generateCirclePattern(
  c1: string,
  c2: string,
  c3: string,
  c4: string,
  hash: number
): string {
  const circles = []
  const count = 3 + (hash % 4)

  for (let i = 0; i < count; i++) {
    const cx = 20 + ((hash + i * 73) % 60)
    const cy = 20 + ((hash + i * 97) % 60)
    const r = 15 + ((hash + i * 31) % 25)
    const color = [c1, c2, c3, c4][i % 4]
    circles.push(`<circle cx="${cx}" cy="${cy}" r="${r}" fill="${color}" opacity="0.7"/>`)
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    <rect width="100" height="100" fill="${c1}"/>
    ${circles.join("\n    ")}
  </svg>`
}

function generateWavePattern(c1: string, c2: string, c3: string, hash: number): string {
  const amplitude1 = 5 + (hash % 10)
  const amplitude2 = 8 + ((hash >> 4) % 12)
  const offset = hash % 20

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    <rect width="100" height="100" fill="${c1}"/>
    <path d="M0,${50 + offset} Q25,${50 - amplitude1 + offset} 50,${50 + offset} T100,${50 + offset} V100 H0 Z" fill="${c2}" opacity="0.8"/>
    <path d="M0,${65 + offset} Q25,${65 + amplitude2 + offset} 50,${65 + offset} T100,${65 + offset} V100 H0 Z" fill="${c3}" opacity="0.6"/>
  </svg>`
}

function generateGridPattern(c1: string, c2: string, c3: string, c4: string, hash: number): string {
  const rects = []
  const size = 20 + (hash % 15)
  const colors = [c2, c3, c4]

  for (let x = 0; x < 100; x += size) {
    for (let y = 0; y < 100; y += size) {
      if ((hash + x + y) % 3 === 0) {
        const color = colors[(hash + x * y) % colors.length]
        rects.push(
          `<rect x="${x}" y="${y}" width="${size - 2}" height="${size - 2}" fill="${color}" opacity="0.8" rx="2"/>`
        )
      }
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    <rect width="100" height="100" fill="${c1}"/>
    ${rects.join("\n    ")}
  </svg>`
}

function generateBlobPattern(c1: string, c2: string, c3: string, hash: number): string {
  const x1 = 20 + (hash % 30)
  const y1 = 20 + ((hash >> 3) % 30)
  const x2 = 50 + ((hash >> 6) % 30)
  const y2 = 50 + ((hash >> 9) % 30)

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    <rect width="100" height="100" fill="${c1}"/>
    <ellipse cx="${x1}" cy="${y1}" rx="35" ry="25" fill="${c2}" opacity="0.7" transform="rotate(${hash % 45}, ${x1}, ${y1})"/>
    <ellipse cx="${x2}" cy="${y2}" rx="30" ry="40" fill="${c3}" opacity="0.6" transform="rotate(${(hash >> 4) % 45}, ${x2}, ${y2})"/>
  </svg>`
}

function generateGradientPattern(c1: string, c2: string, c3: string, c4: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    <defs>
      <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color:${c1}"/>
        <stop offset="33%" style="stop-color:${c2}"/>
        <stop offset="66%" style="stop-color:${c3}"/>
        <stop offset="100%" style="stop-color:${c4}"/>
      </linearGradient>
    </defs>
    <rect width="100" height="100" fill="url(#grad)"/>
  </svg>`
}

/**
 * Convert SVG string to data URL
 */
export function svgToDataUrl(svg: string): string {
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}
