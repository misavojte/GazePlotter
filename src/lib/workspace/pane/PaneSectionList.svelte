<script lang="ts">
  import type { PaneSectionEntry } from '$lib/plots/definePlot'
  import type { AllGridTypes } from '$lib/workspace'

  interface Props {
    /** Ordered sections to render. */
    sections: PaneSectionEntry[]
    /** The representative item; each section reads the live edit-target set
     *  from the `paneEditItems` context for bulk display/writes. */
    item: AllGridTypes
  }

  let { sections, item }: Props = $props()
</script>

{#each sections as section (section.key)}
  {@const Section = section.component}
  <Section {item} />
{/each}
