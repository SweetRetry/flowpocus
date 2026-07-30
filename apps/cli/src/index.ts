#!/usr/bin/env node

import { randomUUID } from "node:crypto"
import { canvasCommandReceiptSchema, canvasCommandRequestSchema } from "@workspace/commands"
import { Command, CommanderError, Option } from "commander"
import { z } from "zod"

const DEFAULT_SERVER_URL = "http://localhost:3001"

const serverErrorBodySchema = z.object({
  error: z
    .object({
      code: z.string().optional(),
      message: z.string().optional(),
      details: z.unknown().optional(),
    })
    .optional(),
})

const createCanvasOptionsSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
})

const executeCommandOptionsSchema = z.object({
  canvasId: z.string().min(1),
  input: z.string().min(1),
  commandId: z.string().min(1).max(128),
})

class CliError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly details?: unknown
  ) {
    super(message)
    this.name = "CliError"
  }
}

function normalizeServerUrl(value: string): string {
  const parsed = z.url().safeParse(value)
  if (!parsed.success || !/^https?:\/\//.test(parsed.data)) {
    throw new CliError("INVALID_SERVER_URL", "--server must be an HTTP or HTTPS URL")
  }

  return parsed.data.replace(/\/$/, "")
}

function parseOptions<T>(schema: z.ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value)
  if (!parsed.success) {
    throw new CliError("INVALID_OPTIONS", "Invalid CLI options", parsed.error.flatten())
  }

  return parsed.data
}

async function requestJson(serverUrl: string, path: string, init?: RequestInit): Promise<unknown> {
  const normalizedServerUrl = normalizeServerUrl(serverUrl)
  let response: Response

  try {
    response = await fetch(`${normalizedServerUrl}${path}`, {
      ...init,
      headers: {
        "content-type": "application/json",
        ...init?.headers,
      },
    })
  } catch (error) {
    throw new CliError(
      "SERVER_UNREACHABLE",
      `Cannot reach Flowpocus server at ${serverUrl}`,
      error instanceof Error ? error.message : String(error)
    )
  }

  const text = await response.text()
  let decodedBody: unknown

  try {
    decodedBody = text ? JSON.parse(text) : null
  } catch {
    throw new CliError("INVALID_RESPONSE", `Server returned non-JSON response (${response.status})`)
  }

  const parsedBody = z.json().safeParse(decodedBody)
  if (!parsedBody.success) {
    throw new CliError("INVALID_RESPONSE", "Server response is not valid JSON data")
  }
  const body = parsedBody.data

  if (!response.ok) {
    const serverError = serverErrorBodySchema.safeParse(body)
    throw new CliError(
      serverError.success
        ? (serverError.data.error?.code ?? `HTTP_${response.status}`)
        : `HTTP_${response.status}`,
      serverError.success
        ? (serverError.data.error?.message ??
            `Server request failed with status ${response.status}`)
        : `Server request failed with status ${response.status}`,
      serverError.success ? serverError.data.error?.details : undefined
    )
  }

  return body
}

function parseInput(value: string): unknown {
  let decoded: unknown

  try {
    decoded = JSON.parse(value)
  } catch {
    throw new CliError("INVALID_INPUT_JSON", "--input must be valid JSON")
  }

  const parsed = z.json().safeParse(decoded)
  if (!parsed.success) {
    throw new CliError("INVALID_INPUT_JSON", "--input must contain JSON-compatible data")
  }
  return parsed.data
}

function writeJson(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value)}\n`)
}

const program = new Command()
  .name("flowpocus")
  .description("Call Flowpocus server-owned commands")
  .version("0.0.1")
  .exitOverride()
  .configureOutput({ writeErr: () => undefined })
  .addOption(
    new Option("-s, --server <url>", "Flowpocus server URL")
      .env("FLOWPOCUS_SERVER_URL")
      .default(DEFAULT_SERVER_URL)
  )

const canvases = program.command("canvases").description("Manage canvases through the server API")

canvases
  .command("create")
  .description("Create a canvas")
  .requiredOption("--name <name>", "Canvas name")
  .option("--description <description>", "Canvas description")
  .action(async (options: { name: string; description?: string }) => {
    const { server } = program.opts<{ server: string }>()
    const input = parseOptions(createCanvasOptionsSchema, options)
    const result = await requestJson(server, "/api/canvases", {
      method: "POST",
      body: JSON.stringify(input),
    })
    writeJson(result)
  })

const commands = program
  .command("commands")
  .description("Discover and execute server-owned canvas commands")

commands
  .command("list")
  .description("List command names and input schemas from the server")
  .action(async () => {
    const { server } = program.opts<{ server: string }>()
    writeJson(await requestJson(server, "/api/commands"))
  })

commands
  .command("execute <name>")
  .description("Execute a command without duplicating its schema in the CLI")
  .requiredOption("--canvas-id <id>", "Target canvas ID")
  .requiredOption("--input <json>", "Command input as JSON")
  .option("--command-id <id>", "Stable idempotency ID", randomUUID())
  .action(async (name: string, options: { canvasId: string; input: string; commandId: string }) => {
    const { server } = program.opts<{ server: string }>()
    const input = parseOptions(executeCommandOptionsSchema, options)
    const request = parseOptions(canvasCommandRequestSchema, {
      commandId: input.commandId,
      name,
      input: parseInput(input.input),
    })
    const result = await requestJson(
      server,
      `/api/commands/${encodeURIComponent(input.canvasId)}`,
      {
        method: "POST",
        body: JSON.stringify(request),
      }
    )
    writeJson(parseOptions(canvasCommandReceiptSchema, result))
  })

program.parseAsync().catch((error: unknown) => {
  if (
    error instanceof CommanderError &&
    (error.code === "commander.helpDisplayed" || error.code === "commander.version")
  ) {
    return
  }

  const cliError =
    error instanceof CliError
      ? error
      : error instanceof CommanderError
        ? new CliError("INVALID_ARGUMENTS", error.message)
        : new CliError("CLI_FAILED", error instanceof Error ? error.message : String(error))

  process.stderr.write(
    `${JSON.stringify({
      error: {
        code: cliError.code,
        message: cliError.message,
        details: cliError.details,
      },
    })}\n`
  )
  process.exitCode = 1
})
