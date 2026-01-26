import type { Node } from "@xyflow/svelte"

/**
 * Generate unique node ID
 */
function generateNodeId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export interface CreateImageNodeOptions {
  position: { x: number; y: number }
  label?: string
  imageUrl?: string
  width?: number
  height?: number
}

/**
 * Create an image node with random picsum image
 */
export function createImageNode(options: CreateImageNodeOptions): Node {
  const { position, label, width = 200, height = 150 } = options

  // Random image from picsum if not provided
  const seed = Math.random().toString(36).slice(2)
  const imageUrl = options.imageUrl ?? `https://picsum.photos/seed/${seed}/400/300`

  return {
    id: generateNodeId("image"),
    type: "image",
    position,
    width,
    height,
    data: {
      label: label ?? "Image",
      imageUrl
    }
  }
}

export interface CreateVideoNodeOptions {
  position: { x: number; y: number }
  label?: string
  videoUrl?: string
  width?: number
  height?: number
}

/**
 * Create a video node
 */
export function createVideoNode(options: CreateVideoNodeOptions): Node {
  const { position, label, width = 320, height = 180 } = options

  // Default sample video
  const videoUrl = options.videoUrl ?? "https://www.w3schools.com/html/mov_bbb.mp4"

  return {
    id: generateNodeId("video"),
    type: "video",
    position,
    width,
    height,
    data: {
      label: label ?? "Video",
      videoUrl
    }
  }
}

export interface CreateTextNodeOptions {
  position: { x: number; y: number }
  label?: string
  content?: string
  width?: number
  height?: number
}

/**
 * Create a text node with markdown support
 */
export function createTextNode(options: CreateTextNodeOptions): Node {
  const { position, label, content = "", width = 240, height = 160 } = options

  return {
    id: generateNodeId("text"),
    type: "text",
    position,
    width,
    height,
    data: {
      label: label ?? "Text",
      content
    }
  }
}
