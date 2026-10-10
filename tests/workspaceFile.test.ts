import { describe, expect, it, vi } from 'vitest'
import { UndoRedoStateStore, type WorkspaceCommandChain } from '$lib/workspace/commands'
import { WorkspaceFile } from '$lib/data/export/workspaceFile.svelte'
import type { SaveTarget } from '$lib/data/export/download'

let nextChainId = 1
function edit(history: UndoRedoStateStore): void {
  const command: WorkspaceCommandChain = {
    type: 'updateLayout',
    updates: [{ itemId: 1, layout: { x: 1 } }],
    source: 'workspace',
    chainId: nextChainId++,
    isRootCommand: true,
  }
  history.recordCommand(command, command)
  history.finalizeChain()
}
function undo(history: UndoRedoStateStore): void {
  history.undo()
  history.endUndoRedo()
}

describe('unsaved tracking on the undo history', () => {
  it('is clean after a load, dirty after an edit, clean again when undone to the save', () => {
    const history = new UndoRedoStateStore()
    expect(history.isDirty).toBe(false)
    edit(history)
    expect(history.isDirty).toBe(true)
    history.markSaved(history.head)
    expect(history.isDirty).toBe(false)
    edit(history)
    expect(history.isDirty).toBe(true)
    undo(history)
    expect(history.isDirty).toBe(false)
    history.clear()
    expect(history.isDirty).toBe(false)
  })

  it('stays dirty when the capped stack is undone to empty (trimmed edits remain applied)', () => {
    const history = new UndoRedoStateStore()
    for (let i = 0; i < 51; i++) edit(history)
    for (let i = 0; i < 60; i++) undo(history)
    expect(history.canUndo).toBe(false)
    expect(history.isDirty).toBe(true)
  })
})

/** A writable fake file with a modification clock. */
function fakeTarget(name = 'study.gazeplotter') {
  let content: Blob | null = null
  let modified = 0
  const target: SaveTarget & { writes: number; touch(): void } = {
    name,
    writes: 0,
    async write(blob) {
      content = blob
      modified++
      target.writes++
    },
    async read() {
      return content ? new File([content], name, { lastModified: modified }) : null
    },
    touch() {
      modified++ // someone else saved the file
    },
  }
  return target
}

function setup(options: { userDataset?: boolean; pick?: SaveTarget | null; overwrite?: boolean } = {}) {
  const history = new UndoRedoStateStore()
  const ingest = { isLoading: false, isUserDataset: options.userDataset ?? true, input: { fileNames: ['data.tsv'] } }
  const target = fakeTarget()
  const pickSaveTarget = vi.fn(async () => (options.pick === undefined ? target : options.pick))
  const confirmOverwrite = vi.fn(() => options.overwrite ?? false)
  const toastState = { addSuccess: vi.fn() }
  const errorService = { report: vi.fn() }
  const saveFile = vi.fn()
  const deps = {
    build: async () => new Blob(['workspace']),
    history,
    ingest,
    rebindMedia: async () => {},
    pickSaveTarget: pickSaveTarget as typeof pickSaveTarget | null,
    saveFile,
    confirmOverwrite,
    errorService: errorService as never,
    toastState,
  }
  const file = new WorkspaceFile(deps)
  return { history, ingest, target, pickSaveTarget, confirmOverwrite, toastState, errorService, saveFile, deps, file }
}

/** A write that resolves only when released. */
function holdWrites(target: SaveTarget): () => void {
  let release = () => {}
  const gate = new Promise<void>(resolve => (release = resolve))
  const write = target.write
  target.write = async blob => {
    await gate
    await write(blob)
  }
  return release
}

describe('WorkspaceFile', () => {
  it('asks once, then saves silently into the chosen file', async () => {
    const { history, file, target, pickSaveTarget, toastState } = setup()
    edit(history)
    expect(file.indicator).toBe('unsaved')
    expect(file.suggestedName).toBe('data')
    expect(await file.save()).toBe(true)
    expect(pickSaveTarget).toHaveBeenCalledWith('data', '.gazeplotter')
    expect(file.target).toBe(target)
    expect(file.indicator).toBe('saved')
    expect(toastState.addSuccess).toHaveBeenCalledWith('Saved study.gazeplotter')
    edit(history)
    expect(await file.save()).toBe(true)
    expect(pickSaveTarget).toHaveBeenCalledTimes(1)
    expect(target.writes).toBe(2)
  })

  it('Save as always asks, and the new file becomes the one Save writes', async () => {
    const { file, pickSaveTarget, history } = setup()
    edit(history)
    await file.save()
    const other = fakeTarget('study-v2.gazeplotter')
    pickSaveTarget.mockResolvedValueOnce(other)
    expect(await file.saveAs()).toBe(true)
    expect(file.target).toBe(other)
    expect(file.suggestedName).toBe('study-v2')
  })

  it('host-provided data (the demo) stays "not in a file" until saved', async () => {
    const { history, file } = setup({ userDataset: false })
    expect(file.indicator).toBe('new')
    edit(history)
    expect(file.indicator).toBe('new')
    expect(file.hasUnsavedWork).toBe(false)
    await file.save()
    edit(history)
    expect(file.indicator).toBe('unsaved')
  })

  it('a cancelled picker changes nothing', async () => {
    const { history, file } = setup({ pick: null })
    edit(history)
    expect(await file.save()).toBe(false)
    expect(file.target).toBeNull()
    expect(history.isDirty).toBe(true)
  })

  it('asks before overwriting a file changed elsewhere', async () => {
    const declined = setup({ overwrite: false })
    edit(declined.history)
    await declined.file.save()
    declined.target.touch()
    edit(declined.history)
    expect(await declined.file.save()).toBe(false)
    expect(declined.confirmOverwrite).toHaveBeenCalledWith('study.gazeplotter')
    expect(declined.target.writes).toBe(1)
    expect(declined.history.isDirty).toBe(true)

    const accepted = setup({ overwrite: true })
    edit(accepted.history)
    await accepted.file.save()
    accepted.target.touch()
    edit(accepted.history)
    expect(await accepted.file.save()).toBe(true)
    expect(accepted.target.writes).toBe(2)
  })

  it('a workspace loaded during a save is not bound to the old file', async () => {
    const { history, file, target } = setup()
    const release = holdWrites(target)
    edit(history)
    const saving = file.save()
    await Promise.resolve()
    await Promise.resolve()
    file.reset() // a new load
    history.clear()
    release()
    expect(await saving).toBe(false)
    expect(file.target).toBeNull()
  })

  it('ignores a second save while one is running', async () => {
    const { history, file, target } = setup()
    edit(history)
    await file.save()
    const release = holdWrites(target)
    edit(history)
    const first = file.save()
    await Promise.resolve()
    expect(await file.save()).toBe(false)
    release()
    expect(await first).toBe(true)
  })

  it('a failed build is no save: still unsaved, reported, file untouched', async () => {
    const { history, file, target, errorService, deps } = setup()
    edit(history)
    await file.save()
    edit(history)
    deps.build = async () => {
      throw new Error('Reference media for Stimulus A could not be read')
    }
    expect(await file.save()).toBe(false)
    expect(file.indicator).toBe('unsaved')
    expect(target.writes).toBe(1)
    expect(errorService.report).toHaveBeenCalledTimes(1)
  })

  it('downloads a copy where no file can be chosen, and counts it as saved', async () => {
    const { history, file, saveFile, deps } = setup()
    deps.pickSaveTarget = null
    expect(file.canChooseFile).toBe(false)
    edit(history)
    expect(await file.download('my study')).toBe(true)
    expect(saveFile).toHaveBeenCalledWith(expect.any(Blob), 'my study.gazeplotter', '.gazeplotter')
    expect(file.indicator).toBe('saved')
  })

  it('names files from what was saved or loaded', () => {
    const { file, ingest } = setup()
    ingest.input = { fileNames: ['study.gazeplotter.zip'] }
    expect(file.suggestedName).toBe('study')
    ingest.input = { fileNames: ['DP-2024 Data export.tsv'] }
    expect(file.suggestedName).toBe('DP-2024 Data export')
  })
})
