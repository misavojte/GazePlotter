/**
 * Generates a time-stamp based unique number ID
 * @returns A unique string ID
 */
const generateUniqueId = () => {
  return Date.now() + Math.floor(Math.random() * 1000)
}

export { generateUniqueId }