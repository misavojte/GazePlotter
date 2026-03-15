const CORE_LAYOUT_KEYS = new Set([
  'id', 
  'type', 
  'x', 
  'y', 
  'w', 
  'h', 
  'min', 
  'redrawTimestamp'
]);

/**
 * Sequentially upgrades raw JSON data to the modern Version 4 schema.
 * Operates entirely on raw data objects to ensure Web Worker safety.
 */
export function runMigrations(parsedJson: any): any {
  let data = parsedJson;
  let version = data.version || 1; // Fallback for unversioned legacy files

  // V1/V2 to V3: Standardize the version marker
  if (version <= 2) {
    data = { ...data, version: 3 };
    version = 3;
  }

  // V3 to V4: Flat to Nested Translation
  if (version === 3) {
    const migratedItems = (data.gridItems || []).map((item: any) => {
      // If it already has a settings object, leave it alone (duck-typing safety net)
      if (item.settings && typeof item.settings === 'object') {
        return item;
      }

      const core: Record<string, any> = {};
      const settings: Record<string, any> = {};

      for (const [key, value] of Object.entries(item)) {
        if (CORE_LAYOUT_KEYS.has(key)) {
          core[key] = value;
        } else {
          settings[key] = value;
        }
      }

      return { ...core, settings };
    });

    data = { ...data, version: 4, gridItems: migratedItems };
  }

  return data;
}
