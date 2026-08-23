/**
 * Generates a time-stamp based unique number ID.
 * Guaranteed to be unique within the current session by using a fallback counter.
 * @returns A unique numeric ID
 */
let lastId = 0
const generateUniqueId = (): number => {
  const now = Date.now()
  if (now <= lastId) {
    lastId++
  } else {
    lastId = now
  }
  return lastId
}

export { generateUniqueId }
