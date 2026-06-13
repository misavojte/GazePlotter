# Participant Library

The Participant Library renames participants and sets their order across all plots. Renaming changes only the displayed label; the original source name is preserved.

## Opening the library

1. Select a plot to open its [Settings Pane](/docs/visualizations/#configuration-and-settings-pane).
2. In the **Participant** or **Participant group** section, click **Edit participants…**.

## Editing participants

Each participant is a row showing its original name and an editable **Displayed name**. Drag the grip handle to reorder; the order sets how participants appear in every plot. Two buttons sit above the list:

- **Sort** — Order by original or displayed name, ascending or descending. Sorting uses natural ordering, so `Participant_2` comes before `Participant_10`.
- **Bulk actions** — Opens **Rename items…** for pattern-based renaming.

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
