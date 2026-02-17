---
title: Stimuli customization
order: 8
---

# Stimuli customization

Stimuli customization in GazePlotter allows you to rename stimuli and change their display order in eye-tracking plots. You can use pattern-based renaming for batch operations or edit individual stimulus names.

![](/docs/images/stimuli-customization_1.jpg)

![](/docs/images/stimuli-customization_2.jpg)

## Accessing stimuli customization

To customize stimuli:

1. Click on the `More options` button in the top right corner of any plot.
2. Select `Stimulus customization` from the pop-up menu.

## Pattern Renaming

Pattern renaming allows bulk renaming operations using regular expressions for find-and-replace across all stimuli.

### Find and Replace

1. Enter text or pattern to find in the `Find text` field
2. Enter replacement text in the `Replace with` field
3. Click `Apply renaming to all` to execute the replacement

### Wildcard Patterns

Wildcard buttons insert regex patterns into the Find text field:

- **Any number (e.g., 123)** â†' `\d+` - matches one or more digits
- **Any space** â†' `\s` - matches any whitespace character
- **Any letter** â†' `[A-Za-z]` - matches any single letter
- **Any character** â†' `.` - matches any single character

### Common Use Cases

Simple examples:

- Remove numbers: Find `\d+`, Replace with empty
- Remove spaces: Find `\s`, Replace with empty
- Replace prefixes: Find `Stimulus`, Replace with `S`
- Standardize naming: Find `_`, Replace with `-`

### Complex Example

Transform `SMI Base` to `Base`:

- **Find text**: `SMI\s`
- **Replace with**: `` (empty)
- **Result**: `SMI Base` â†' `Base`

This pattern breaks down as:

- `SMI` - matches the literal text "SMI"
- `\s` - matches the space after "SMI"

### Advanced Regex Usage

You can input any valid regular expression in the Find text field. For complex patterns, consider using AI tools like ChatGPT to generate regex patterns by describing your transformation needs.

## Individual Stimulus Editing

For each stimulus you can:

- Edit the `Displayed name` while keeping the original name unchanged
- Change stimulus order using the up/down arrows in the `Order` column

### Bulk Stimulus Sorting

Click on column headers to sort stimuli:

- **Original name** - sorts by the original stimulus names
- **Displayed name** - sorts by the current displayed names
- Click again to reverse sort direction (ascending/descending)

The sorting uses natural ordering, so `Stimulus10` correctly comes after `Stimulus2` (not alphabetically before it).

## Applying Changes

Click `Apply` to save all modifications. Changes are discarded if you close the window without applying.
