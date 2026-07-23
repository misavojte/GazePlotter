<script lang="ts">
  import {
    paneSectionKey,
    type PaneSectionEntry,
    type SchemaPaneSectionEntry,
  } from '$lib/plots/definePlot'
  import type { AllGridTypes } from '$lib/workspace'
  import SchemaSection from '$lib/plots/shared/components/sections/SchemaSection.svelte'
  import {
    SHARED_SECTIONS,
    type SharedPaneSection,
  } from '$lib/plots/shared/components/sections'

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
  function resolveShared(key: string): SharedPaneSection {
    const entry = SHARED_SECTIONS[key]
    if (!entry) throw new Error(`[pane] Unknown shared section key "${key}"`)
    return entry
  }

  const isSchema = (e: SharedPaneSection): e is SchemaPaneSectionEntry =>
    'fields' in e
</script>

{#each sections as section (paneSectionKey(section))}
  {#if typeof section === 'string'}
    {@const resolved = resolveShared(section)}
    {#if isSchema(resolved)}
      <SchemaSection {item} entry={resolved} />
    {:else}
      {@const Section = resolved}
      <Section {item} />
    {/if}
  {:else if 'fields' in section}
    <SchemaSection {item} entry={section} />
  {:else}
    {@const resolved = resolveShared(section.key)}
    {#if isSchema(resolved)}
      <!-- `props` on a schema key are entry-field overrides (e.g.
           metric-correlation's plural title for 'metric'). -->
      <SchemaSection
        {item}
        entry={{ ...resolved, ...section.props } as SchemaPaneSectionEntry}
      />
    {:else}
      {@const Section = resolved}
      <Section {item} {...section.props} />
    {/if}
  {/if}
{/each}
