/**
 * Format helper for JSON encoding.
 * Standardizes versioning and stringification.
 */

export function encodeJson(data: any, pretty: boolean = true): string {
  return JSON.stringify(data, null, pretty ? 2 : 0)
}

export function wrapProjectPayload(content: any, version: number = 3) {
  return {
    version,
    exportedAt: new Date().toISOString(),
    ...content,
  }
}
