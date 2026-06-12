function isInputNumberValueEmpty(rawValue: string): boolean {
  return rawValue.trim().length === 0
}

function parseInputNumberValue(
  rawValue: string
): number | undefined {
  if (isInputNumberValueEmpty(rawValue)) {
    return undefined
  }

  const parsedValue = Number(rawValue)
  return Number.isFinite(parsedValue) ? parsedValue : undefined
}

export function formatInputNumberValue(
  value: number | undefined
): string {
  return value === undefined ? '' : String(value)
}

export function resolveInputNumberCommit(
  rawValue: string,
  allowEmpty: boolean
): { shouldCommit: boolean; value: number | undefined } {
  const parsedValue = parseInputNumberValue(rawValue)

  if (parsedValue !== undefined) {
    return { shouldCommit: true, value: parsedValue }
  }

  if (allowEmpty && isInputNumberValueEmpty(rawValue)) {
    return { shouldCommit: true, value: undefined }
  }

  return { shouldCommit: false, value: undefined }
}
