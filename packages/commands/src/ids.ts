const ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"

/**
 * Unbiased base62 ID. Bytes >= 248 are rejected so every character is equally likely.
 */
function createBase62Id(length: number): string {
  let id = ""
  while (id.length < length) {
    for (const byte of crypto.getRandomValues(new Uint8Array(length))) {
      if (byte < 248 && id.length < length) id += ALPHABET[byte % 62]
    }
  }
  return id
}

/** Globally unique canvas ID used in URLs, e.g. `/canvas/k3TzQ8aB1xYw` (62^12 ≈ 3e21). */
export function createCanvasId(): string {
  return createBase62Id(12)
}

/** Node or edge ID, unique within one canvas (62^8 ≈ 2e14). */
export function createElementId(): string {
  return createBase62Id(8)
}
