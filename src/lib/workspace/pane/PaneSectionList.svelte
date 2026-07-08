<script lang="ts">
  import { paneSectionKey, type PaneSectionEntry } from '$lib/plots/definePlot'
  import type { AllGridTypes } from '$lib/workspace'
  import SchemaSection from '$lib/plots/shared/components/sections/SchemaSection.svelte'
  import { PANE_SECTION_COMPONENTS } from '$lib/plots/shared/components/sections'

  interface Props {
    /** Ordered sections to render. */
    sections: PaneSectionEntry[]
    /** The representative item; each section reads the live edit-target set
     *  from the `paneEditItems` context for bulk display/writes. */
    item: AllGridTypes
  }

  let { sections, item }: Props = $props()

  // Loud failure: a definition referencing an unknown shared-section key is a
  // registration bug, not something to render around.
  function resolveShared(key: string) {
    const component = PANE_SECTION_COMPONENTS[key]
    if (!component) throw new Error(`[pane] Unknown shared section key "${key}"`)
    return component
  }
</script>

{#each sections as section (paneSectionKey(section))}
  {#if typeof section === 'string'}
    {@const Section = resolveShared(section)}
    <Section {item} />
  {:else if 'fields' in section}
    <SchemaSection {item} entry={section} />
  {:else}
    {@const Section = resolveShared(section.key)}
    <Section {item} {...section.props} />
  {/if}
{/each}
