<script lang="ts">
  import { plotRegistry } from '$lib/plots/registry'
  import { SHARED_SECTIONS } from '$lib/plots/shared/components/sections'
  import PaneSectionList from './PaneSectionList.svelte'
  import { setPaneEditItems } from './paneEditItems'
  import { commonSectionKeys } from './bulkSections'
  import type { PaneSectionEntry } from '$lib/plots/definePlot'
  import type { AllGridTypes } from '$lib/workspace'

  interface Props {
    /** The currently selected grid items (2+ when this renders). */
    items: AllGridTypes[]
  }

  let { items }: Props = $props()

  // The live selection is the SINGLE source of divergence: sections read it via
  // this context (`createBulkContext` → `bulk.common`), compute "Mixed" per
  // field from the real values, and write back to every item. No merged facade,
  // no in-band sentinel — so a control's value is always a real value.
  setPaneEditItems(() => items)

  // Sections still receive a representative item for plot type/id and any
  // representative-only reads (e.g. AOI stimulus filtering). Divergence-sensitive
  // controls never read it directly — they go through `bulk.common`.
  const representative = $derived(items[0])

  function sectionsOf(type: string): PaneSectionEntry[] {
    return (plotRegistry as Record<string, any>)[type]?.paneSections ?? []
  }

  const homogeneous = $derived(new Set(items.map(i => i.type)).size === 1)

  // Same type → the type's full pane verbatim (every section), edits applied to
  // all. Mixed types → the sections COMMON to every selected type: section keys
  // present in all selected types' `paneSections`, limited to cross-type-safe
  // shared sections, in the representative's declared order, rendered in their
  // canonical form. Pure list intersection — no plot-type knowledge here.
  const sharedKeys = new Set(Object.keys(SHARED_SECTIONS))
  const entries = $derived.by<PaneSectionEntry[]>(() => {
    if (!representative) return []
    if (homogeneous) return sectionsOf(representative.type)
    const repKeys = sectionsOf(representative.type).map(e => e.key)
    const perTypeKeys = items.map(i => sectionsOf(i.type).map(e => e.key))
    return commonSectionKeys(repKeys, perTypeKeys, sharedKeys).map(key => ({
      key,
      component: SHARED_SECTIONS[key],
    }))
  })
</script>

{#if representative}
  <PaneSectionList sections={entries} item={representative} />
{/if}
