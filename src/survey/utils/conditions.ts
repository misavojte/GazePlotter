/**
 * Utility functions for creating condition stores for survey tasks
 */

import { writable, type Writable } from 'svelte/store';

/**
 * Create a simple boolean condition store
 * @param initialValue - Initial value of the condition
 * @returns Writable store that can be updated
 */
export function createCondition(initialValue: boolean = false): Writable<boolean> {
  return writable(initialValue);
}
