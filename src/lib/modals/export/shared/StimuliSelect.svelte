<script lang="ts">
  import { CheckboxListField } from '$lib/modals'
  import { getGazePlotterSession } from '$lib/session'
  import { getStimuliOptions } from '$lib/plots/shared'
  import { mapSelectableItems, toggleSetValue } from './helpers'

  /** The stimulus picker every export modal shares. */
  interface Props {
    selected: ReadonlySet<string>
    onchange: (next: Set<string>) => void
    hasError?: boolean
  }

  let { selected, onchange, hasError = false }: Props = $props()
  const { engine } = getGazePlotterSession()

  const items = $derived(mapSelectableItems(getStimuliOptions(engine), selected))
</script>

<CheckboxListField
  title="Stimuli"
  {items}
  onItemChange={(key, checked) => onchange(toggleSetValue(selected, key, checked))}
  {hasError}
  errorMessage="Select at least one stimulus to export"
/>
