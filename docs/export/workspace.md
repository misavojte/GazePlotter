# Workspace Export

Saving the workspace keeps your whole session in one `.gazeplotter` file: data, layout, plot settings, and library customizations. Open the file later to continue exactly where you left off, or send it to a colleague.

GazePlotter does not save automatically and keeps nothing of your study in the browser. Your work lives only in the file you save.

## What it includes

- The full dataset (parsed gaze segments, AOIs, events).
- Grid layout: each plot's position and size.
- Every plot's settings (group, stimulus, metric, axis bounds, colors, view modes).
- Library customizations: [participant selections](/docs/workspace/participant-library/#participant-selections), [AOI names and colors](/docs/workspace/aoi-library/), [participant names](/docs/workspace/participant-library/), and [stimulus names](/docs/workspace/stimuli-library/).
- [Reference media](/docs/workspace/stimuli-library/#reference-media) attached to stimuli, as the original image and video files.
- [Merges](/docs/workspace/participant-library/#merging-participants) of participants or stimuli, kept reversible: the file stores the original data and re-applies the merges on open.

Because the data is embedded, file size scales with your dataset and its media. The segment data is stored in binary form rather than as text, which keeps the file compact.

## Saving

| Action | Windows / Linux | macOS |
| --- | --- | --- |
| Save | Ctrl+S | ⌘S |
| Save as | Ctrl+Shift+S | ⇧⌘S |

The first **Save** asks where to put the file. After that, every **Save** writes into the same file without asking, and a short confirmation names it. **Save as** always asks for a new file, and later saves go into that new file.

You can also save from the **Workspace** section of the **Export** dialog. It shows the file you are saving into, whether everything is saved, and the time of the last save.

Opening a `.gazeplotter` file does not make it the save target. The first **Save** after opening asks where to save, suggesting the same name, so a shared or archived file is never overwritten by accident.

### Firefox and Safari

These browsers cannot write to a file you chose, so saving downloads a new copy instead. **Ctrl+S** (or **⌘S**) opens the **Export** dialog, where you name the file and click **Download**. Each download is a separate copy in your Downloads folder.

## Save status

A small dot on the **Export** button in the header shows the state of the workspace:

- **Grey**: the workspace is not saved to a file yet.
- **Amber**: there are unsaved changes.
- **Green**: all changes are saved.

Undoing back to the last save counts as saved again.

## Protection against lost work

- Closing or reloading the tab with unsaved changes asks for confirmation first.
- Opening new data while there are unsaved changes asks before replacing them.
- If the saved file was changed elsewhere since your last save (for example in another tab), GazePlotter asks before overwriting it.
- If a save fails, for example because an attached media file was moved, nothing is written and the changes stay marked as unsaved. Reattach the media in the [Stimuli Library](/docs/workspace/stimuli-library/#reference-media), then save again.

## Opening

1. Click **Import** in the header, or drop the file onto the page.
2. Select a `.gazeplotter` file.

Opening replaces the current workspace with the saved data, plots, settings, and layout.

Workspaces saved by earlier versions open as before: a single `.json` file, or a `.gazeplotter.zip` archive with media.
