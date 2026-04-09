<script lang="ts">
  import { InputText } from '$lib/shared/components'
  import ButtonPreset from '$lib/shared/components/ButtonPreset.svelte'
  import {
    CompactSettingsSection,
    CompactSettingsSeparator,
  } from '$lib/plots/shared/components'
  import { tooltipAction } from '$lib/tooltip'

  interface Props {
    onRenameCommand: (findText: string, replaceText: string) => void
  }

  let { onRenameCommand }: Props = $props()

  let findText = $state('')
  let replaceText = $state('')

  const WILDCARD_PATTERNS = [
    { label: '\\d+', value: '\\d+', tooltip: 'Any number' },
    { label: '\\s', value: '\\s', tooltip: 'Any space' },
    { label: '[A-Za-z]', value: '[A-Za-z]', tooltip: 'Any letter' },
    { label: '.', value: '.', tooltip: 'Any character' },
  ]

  const handlePatternButtonClick = (pattern: string) => {
    findText += pattern
  }

  const handlePatternRename = () => {
    if (!findText) return
    onRenameCommand(findText, replaceText)
  }
</script>

<div class="rename-container">
  <div class="input-pair">
    <div class="compact-input">
      <InputText
        label="Find (regex)"
        value={findText}
        fill={true}
        oninput={e => {
          findText = e.detail
        }}
      />
    </div>
    <div class="compact-input">
      <InputText
        label="Replace with"
        value={replaceText}
        fill={true}
        oninput={e => {
          replaceText = e.detail
        }}
      />
    </div>
  </div>

  <CompactSettingsSeparator />

  <CompactSettingsSection title="Wildcards">
    <div class="wildcard-buttons">
      {#each WILDCARD_PATTERNS as pattern}
        <span use:tooltipAction={{ content: pattern.tooltip, position: 'bottom' }}>
          <ButtonPreset
            label={pattern.label}
            onclick={() => handlePatternButtonClick(pattern.value)}
          />
        </span>
      {/each}
    </div>
  </CompactSettingsSection>

  <CompactSettingsSeparator />

  <button class="apply-btn" onclick={handlePatternRename}>
    Apply to all
  </button>
</div>

<style>
  .rename-container {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .input-pair {
    display: flex;
    gap: 8px;
  }

  .compact-input {
    flex: 1;
    min-width: 0;
  }

  .compact-input :global(label) {
    font-size: 11px;
    color: var(--c-darkgrey);
  }

  .compact-input :global(input) {
    font-size: 12px;
    padding: 4px 6px;
  }

  .wildcard-buttons {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }

  .apply-btn {
    align-self: flex-end;
    background-color: var(--c-brand);
    border: none;
    border-radius: var(--rounded);
    padding: 4px 12px;
    font-size: 11px;
    font-weight: 500;
    color: var(--c-white);
    cursor: pointer;
    transition: opacity 0.15s ease;
  }

  .apply-btn:hover {
    opacity: 0.85;
  }
</style>
