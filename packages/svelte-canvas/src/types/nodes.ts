/**
 * Image node data
 */
export interface ImageNodeData extends Record<string, unknown> {
  label?: string
  imageUrl?: string
  width?: number
  height?: number
}

/**
 * Video node data
 */
export interface VideoNodeData extends Record<string, unknown> {
  label?: string
  videoUrl?: string
  width?: number
  height?: number
}
