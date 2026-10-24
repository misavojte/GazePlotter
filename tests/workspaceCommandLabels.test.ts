import { describe, expect, it } from 'vitest'
import { getCommandLabel } from '$lib/workspace/commands/labels'

describe('getCommandLabel', () => {
  it('names a stimulus-only settings edit, and nothing broader', () => {
    const settings = (s: Record<string, unknown>) => ({
      type: 'updateSettings' as const,
      updates: [{ itemId: 1, settings: s }],
      source: 'scarf.1.workspace',
    })
    expect(getCommandLabel(settings({ stimulusId: 2 }), 'undone')).toBe(
      'Undone: stimulus change'
    )
    expect(
      getCommandLabel(settings({ stimulusId: 2, groupId: 1 }), 'undone')
    ).toBe('Undone: plot update')
    expect(getCommandLabel(settings({ groupId: 1 }), 'redone')).toBe(
      'Redone: plot update'
    )
  })
})
