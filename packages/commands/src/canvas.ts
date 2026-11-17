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

/** How the caller appears to people watching the canvas while its command runs. */
export const canvasAgentSchema = z.object({
  name: z.string().min(1).max(40),
  color: z
    .string()
    .regex(/^#[0-9a-f]{6}$/i)
    .optional(),
  /** Model the agent runs on, such as "deepseek-v4". Self-declared, not verified. */
  model: z.string().min(1).max(80).optional(),
  /** HTTPS image the agent claims as its avatar. Self-declared, not verified. */
  avatarUrl: z
    .url({ protocol: /^https$/ })
    .max(2048)
    .optional(),
})

export const canvasCommandRequestSchema = z.object({
  commandId: z.string().min(1).max(128),
  name: z.string().min(1).max(128),
  input: z.unknown(),
  agent: canvasAgentSchema.optional(),
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

export type CanvasAgent = z.infer<typeof canvasAgentSchema>
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
