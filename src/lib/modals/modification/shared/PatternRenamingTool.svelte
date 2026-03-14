<script lang="ts">
  import {
    GeneralButtonMajor,
    GeneralButtonPreset,
    GeneralInputText,
  } from '$lib/shared/components'
  import { SectionHeader } from '$lib/modals'

  interface Props {
    onRenameCommand: (findText: string, replaceText: string) => void
  }

  let { onRenameCommand }: Props = $props()

  // Pattern renaming state
  let findText = $state('')
  let replaceText = $state('')

  const WILDCARD_PATTERNS = [
    { label: 'Any number (e.g., 123)', value: '\\d+' },
    { label: 'Any space', value: '\\s' },
    { label: 'Any letter', value: '[A-Za-z]' },
    { label: 'Any character', value: '.' },
  ]

  const handleFindTextInput = (event: CustomEvent) => {
    findText = event.detail
  }

  const handleReplaceTextInput = (event: CustomEvent) => {
    replaceText = event.detail
  }

  const handlePatternButtonClick = (pattern: string) => {
    findText += pattern
  }

  const handlePatternRename = () => {
    if (!findText) return
    onRenameCommand(findText, replaceText)
  }
</script>

<div class="pattern-tool">
  <SectionHeader text="Pattern Renaming" />
  <div class="pattern-inputs">
    <div class="input-row">
      <div class="input-group">
        <GeneralInputText
          label="Find text"
          value={findText}
          oninput={handleFindTextInput}
        />
      </div>
      <div class="input-group">
        <GeneralInputText
          label="Replace with"
          value={replaceText}
          oninput={handleReplaceTextInput}
        />
      </div>
    </div>
    <div class="pattern-section">
      <div class="pattern-title">
        Wildcard Patterns (e.g., "\d+" to remove numbers", and "\s" to remove
        spaces)
      </div>
      <div class="pattern-buttons">
        {#each WILDCARD_PATTERNS as pattern}
          <GeneralButtonPreset
            label={pattern.label}
            onclick={() => handlePatternButtonClick(pattern.value)}
          />
        {/each}
      </div>
    </div>
    <div class="apply-button">
      <GeneralButtonMajor onclick={handlePatternRename} size="sm">
        Apply renaming to all
      </GeneralButtonMajor>
    </div>
  </div>
</div>

<style>
  .pattern-tool {
    margin: 20px 0;
    margin-bottom: 30px;
  }

  .input-row {
    display: flex;
    gap: 15px;
  }

  .input-group {
    flex: 1;
  }

  .pattern-section {
    margin-top: 2px;
  }

  .pattern-title {
    font-size: 12px;
    color: var(--c-midgrey);
    margin-bottom: 3px;
  }

  .pattern-buttons {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }

  .apply-button {
    margin-top: 10px;
  }
</style>
