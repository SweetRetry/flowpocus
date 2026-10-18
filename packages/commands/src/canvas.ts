import { z } from "zod"

const positionSchema = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
})

const dimensionsSchema = {
  width: z.number().positive().optional(),
  height: z.number().positive().optional(),
}

export const createNodeInputSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("text"),
    id: z.string().min(1).max(255).optional(),
    position: positionSchema,
    label: z.string().max(255).optional(),
    content: z.string().optional(),
    ...dimensionsSchema,
  }),
  z.object({
    type: z.literal("image"),
    id: z.string().min(1).max(255).optional(),
    position: positionSchema,
    label: z.string().max(255).optional(),
    imageUrl: z.url().optional(),
    ...dimensionsSchema,
  }),
  z.object({
    type: z.literal("video"),
    id: z.string().min(1).max(255).optional(),
    position: positionSchema,
    label: z.string().max(255).optional(),
    videoUrl: z.url().optional(),
    ...dimensionsSchema,
  }),
])

export const canvasCommandDefinitions = {
  create_node: {
    description: "Create a text, image, or video node on a canvas",
    inputSchema: createNodeInputSchema,
  },
} as const

export type CanvasCommandName = keyof typeof canvasCommandDefinitions
export type CreateNodeInput = z.infer<typeof createNodeInputSchema>

export const canvasCommandRequestSchema = z.object({
  commandId: z.string().min(1).max(128),
  name: z.string().min(1).max(128),
  input: z.unknown(),
})

export const canvasCommandReceiptSchema = z.object({
  commandId: z.string(),
  canvasId: z.string(),
  name: z.string(),
  status: z.literal("completed"),
  result: z.record(z.string(), z.unknown()),
  executedAt: z.iso.datetime(),
  replayed: z.boolean(),
})

export type CanvasCommandRequest = z.infer<typeof canvasCommandRequestSchema>
export type CanvasCommandReceipt = z.infer<typeof canvasCommandReceiptSchema>

export function getCanvasCommandDefinition(name: string) {
  return canvasCommandDefinitions[name as CanvasCommandName]
}

export interface CanvasCommandDefinitionSummary {
  name: string
  description: string
  /** JSON Schema document; kept structural so route types stay portable. */
  inputSchema: Record<string, unknown>
}

export function listCanvasCommandDefinitions(): CanvasCommandDefinitionSummary[] {
  return Object.entries(canvasCommandDefinitions).map(([name, definition]) => ({
    name,
    description: definition.description,
    inputSchema: z.toJSONSchema(definition.inputSchema),
  }))
}
