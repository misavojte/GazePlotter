import { describe, expect, it } from 'vitest'
import {
  isTextEntryTarget,
  resolveWorkspaceShortcut,
} from '$lib/workspace/keys'

function key(init: {
  code?: string
  key?: string
  ctrlKey?: boolean
  metaKey?: boolean
  shiftKey?: boolean
  target?: unknown
}): KeyboardEvent {
  return {
    code: init.code ?? '',
    key: init.key ?? '',
    ctrlKey: init.ctrlKey ?? false,
    metaKey: init.metaKey ?? false,
    shiftKey: init.shiftKey ?? false,
    target: init.target ?? null,
  } as unknown as KeyboardEvent
}

describe('resolveWorkspaceShortcut', () => {
  it('claims nothing without Ctrl/Cmd, so bare typing never reaches the workspace', () => {
    expect(resolveWorkspaceShortcut(key({ code: 'KeyZ' }))).toBeNull()
    expect(resolveWorkspaceShortcut(key({ key: '0' }))).toBeNull()
    expect(resolveWorkspaceShortcut(key({ key: '-' }))).toBeNull()
  })

  it('maps the history chords, with Shift+Z as redo', () => {
    expect(resolveWorkspaceShortcut(key({ code: 'KeyZ', ctrlKey: true }))).toBe(
      'undo'
    )
    expect(
      resolveWorkspaceShortcut(key({ code: 'KeyZ', ctrlKey: true, shiftKey: true }))
    ).toBe('redo')
    expect(resolveWorkspaceShortcut(key({ code: 'KeyY', ctrlKey: true }))).toBe(
      'redo'
    )
    // Cmd on macOS is the same chord.
    expect(resolveWorkspaceShortcut(key({ code: 'KeyZ', metaKey: true }))).toBe(
      'undo'
    )
  })

  it('leaves Ctrl+Shift+Y unclaimed', () => {
    expect(
      resolveWorkspaceShortcut(
        key({ code: 'KeyY', key: 'Y', ctrlKey: true, shiftKey: true })
      )
    ).toBeNull()
  })

  it('maps the zoom chords, treating + and = as one key', () => {
    expect(resolveWorkspaceShortcut(key({ key: '+', ctrlKey: true }))).toBe(
      'zoom-in'
    )
    expect(resolveWorkspaceShortcut(key({ key: '=', ctrlKey: true }))).toBe(
      'zoom-in'
    )
    expect(resolveWorkspaceShortcut(key({ key: '-', ctrlKey: true }))).toBe(
      'zoom-out'
    )
    expect(resolveWorkspaceShortcut(key({ key: '0', ctrlKey: true }))).toBe(
      'zoom-reset'
    )
  })

  it('claims nothing for an unrelated Ctrl chord (Ctrl+S stays the browser’s)', () => {
    expect(
      resolveWorkspaceShortcut(key({ code: 'KeyS', key: 's', ctrlKey: true }))
    ).toBeNull()
  })
})

describe('isTextEntryTarget', () => {
  it('claims the editable targets and nothing else', () => {
    const editable = ['INPUT', 'TEXTAREA', 'SELECT']
    for (const tagName of editable) {
      expect(isTextEntryTarget(key({ target: { tagName } }))).toBe(true)
    }
    expect(isTextEntryTarget(key({ target: { tagName: 'CANVAS' } }))).toBe(false)
    expect(
      isTextEntryTarget(key({ target: { tagName: 'DIV', isContentEditable: true } }))
    ).toBe(true)
    expect(isTextEntryTarget(key({ target: null }))).toBe(false)
  })
})
