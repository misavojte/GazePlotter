<script lang="ts">
  import { CheckboxListField, Step } from '$lib/modals'
  import { getGazePlotterSession } from '$lib/session'
  import { getStimuliOptions } from '$lib/plots/shared'
  import { mapSelectableItems, toggleSetValue } from './helpers'
  import { stimuliSelectionSummary } from './stimuli'

  /** The stimulus step every export modal shares. */
  interface Props {
    n: number
    description: string
    selected: Set<string>
  }

  let { n, description, selected = $bindable() }: Props = $props()
  const { engine } = getGazePlotterSession()

  const items = $derived(mapSelectableItems(getStimuliOptions(engine), selected))
  const done = $derived(selected.size > 0)
</script>

<Step
  {n}
  title="Choose stimuli"
  {description}
  summary={stimuliSelectionSummary(engine, selected)}
  {done}
>
  <CheckboxListField
    title="Stimuli"
    {items}
    onItemChange={(key, checked) => (selected = toggleSetValue(selected, key, checked))}
    hasError={!done}
    errorMessage="Select at least one stimulus to export"
  />
</Step>
