# Participant Library

The Participant Library renames, reorders, and merges participants, and manages [participant selections](#participant-selections) — all in one modal. Renaming changes only the displayed label; the original source name is preserved.

## Opening the library

1. Select a plot to open its [Pane](/docs/visualizations/#visualization-configuration-pane).
2. In the **Participant** or **Participants** section, click **Edit participants & selections…**.

## Editing participants

Each participant is a row with its original name and an editable **Displayed name**. Drag the grip handle to reorder; the order sets how participants appear in every plot. The list header holds:

- **Sort** — Order by original or displayed name, ascending or descending. Sorting uses natural ordering, so `Participant_2` comes before `Participant_10`.
- **Bulk actions** — Opens **Rename items…** for pattern-based renaming.

## Selecting rows

Click a row to select it (a dashed outline appears); Shift-click selects a range. The tray at the bottom offers **Merge**, **Select all / Deselect all**, and **Save as selection**; dragging any selected row's handle moves the whole selected block. Esc clears the selection.

## Merging participants

Participants that share the same **Displayed name** merge into one participant: their recordings are combined, and the merge stays reversible (rename a row apart to restore the original). Select rows and click **Merge** in the tray, or type matching names. Merging is refused when the participants' recordings overlap on a stimulus — the row explains why and offers **Undo rename**.

## Participant selections

Named participant subsets let each plot target *All participants* or one selection. They live in the *Selections* row beneath the list and are edited directly on it:

- **Create from the list** — Click rows to select them (dashed outline), then click **+ Save as selection** in the tray.
- **Create from scratch** — Click **+ New** in the *Selections* row, then click participants to include them.
- **Edit** — Click a selection's chip to open it; its members show a solid outline and clicking rows toggles them. The tray bubble renames it, shows the live member count, and offers **Select all / Deselect all**. With rows already selected, clicking a chip instead offers **Add selected** / **Remove selected**.
- **Dissolve** — **Dissolve selection** removes the named subset (the participants stay untouched); plots that used it fall back to *All participants*.

Selection edits are saved with the rest of the modal on **Apply**.

## Pattern renaming

For systematic renames across many participants, use **Bulk actions → Rename items…**. The flyout finds a regular expression in the displayed names and replaces every match:

1. Enter a **Pattern (regex)**. The status line shows how many names match.
2. Enter **Replace with** text (leave empty to delete the matched part).
3. Click **Replace**.

The wildcard buttons append common tokens to the pattern: `\d+` (any number), `\s` (any space), `[A-Za-z]` (any letter), and `.` (any character).

Examples:

- Strip a prefix: pattern `Participant`, replace with `P`.
- Remove a file extension: pattern `\.tsv`, replace with empty.
- Drop a recording prefix: pattern `Recording\d+\s`, replace with empty — turns `Recording34 P20` into `P20`.

The engine uses standard JavaScript regular expressions, so an external LLM can help you craft a pattern from example strings.

## Saving

Click **Apply** to save, or **Cancel** to discard all changes.
