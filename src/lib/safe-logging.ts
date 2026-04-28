const SECRET_KEY_PATTERN = /(api[_-]?key|token|authorization|cookie|secret|password)/i

const MAX_STRING_LENGTH = 240
const MAX_ARRAY_LENGTH = 10
const MAX_OBJECT_KEYS = 20
const MAX_DEPTH = 3

function truncateString(value: string, maxLength = MAX_STRING_LENGTH): string {
  if (value.length <= maxLength) {
    return value
  }

  return `${value.slice(0, maxLength)}...[truncated ${value.length - maxLength} chars]`
}

function maskSecretString(value: string): string {
  if (!value) {
    return '[REDACTED]'
  }

  if (value.length <= 8) {
    return '[REDACTED]'
  }

  if (value.length <= 16) {
    return `${value.slice(0, 2)}...[REDACTED]...${value.slice(-2)}`
  }

  return `${value.slice(0, 4)}...[REDACTED]...${value.slice(-4)}`
}

function sanitizeValue(value: unknown, depth: number, seen: WeakSet<object>): unknown {
  if (value == null || typeof value === 'number' || typeof value === 'boolean') {
    return value
  }

  if (typeof value === 'string') {
    return truncateString(value)
  }

  if (value instanceof Error) {
    return toSafeError(value)
  }

  if (depth >= MAX_DEPTH) {
    if (Array.isArray(value)) {
      return `[Array(${value.length})]`
    }

    return '[Object]'
  }

  if (Array.isArray(value)) {
    const items = value.slice(0, MAX_ARRAY_LENGTH).map((item) => sanitizeValue(item, depth + 1, seen))
    if (value.length > MAX_ARRAY_LENGTH) {
      items.push(`[+${value.length - MAX_ARRAY_LENGTH} more items]`)
    }
    return items
  }

  if (typeof value === 'object') {
    if (seen.has(value)) {
      return '[Circular]'
    }

    seen.add(value)

    const entries = Object.entries(value as Record<string, unknown>)
    const limitedEntries = entries.slice(0, MAX_OBJECT_KEYS)
    const result: Record<string, unknown> = {}

    for (const [key, entryValue] of limitedEntries) {
      if (SECRET_KEY_PATTERN.test(key)) {
        result[key] = typeof entryValue === 'string' ? maskSecretString(entryValue) : '[REDACTED]'
        continue
      }

      result[key] = sanitizeValue(entryValue, depth + 1, seen)
    }

    if (entries.length > MAX_OBJECT_KEYS) {
      result.__truncated__ = `+${entries.length - MAX_OBJECT_KEYS} more keys`
    }

    seen.delete(value)
    return result
  }

  return String(value)
}

export function maskSecrets<T>(value: T): T {
  return sanitizeValue(value, 0, new WeakSet<object>()) as T
}

export function truncateForLog<T>(value: T): T {
  return sanitizeValue(value, 0, new WeakSet<object>()) as T
}

export function toSafeError(error: unknown): { name: string; message: string } {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: truncateString(error.message),
    }
  }

  return {
    name: 'Error',
    message: truncateString(typeof error === 'string' ? error : String(error)),
  }
}

export function formatForLog(value: unknown): string {
  const safeValue = sanitizeValue(value, 0, new WeakSet<object>())

  if (typeof safeValue === 'string') {
    return safeValue
  }

  try {
    return JSON.stringify(safeValue)
  } catch {
    return '[Unserializable log value]'
  }
}
