<script lang="ts">
  import { page } from '$app/state'
  import { getPrevNextLinks } from '../navigation'
  let { data } = $props()
  const Doc = $derived(data.doc.component)

  let prevNext = $derived.by(() => {
    return getPrevNextLinks(page.url.pathname, page.data.allLinks ?? [])
  })
</script>

<Doc />

<svelte:head>
  <title>{data.doc.metadata.seoTitle}</title>
  {#if data.doc.metadata.description}
    <meta name="description" content={data.doc.metadata.description} />
  {/if}
</svelte:head>

{#if prevNext.prev || prevNext.next}
  <nav class="prev-next" aria-label="Page navigation">
    {#if prevNext.prev}
      <a href={prevNext.prev.href} class="prev-next-link prev">
        <span class="prev-next-label">← Previous</span>
        <span class="prev-next-title">{prevNext.prev.name}</span>
      </a>
    {/if}
    {#if prevNext.next}
      <a href={prevNext.next.href} class="prev-next-link next">
        <span class="prev-next-label">Next →</span>
        <span class="prev-next-title">{prevNext.next.name}</span>
      </a>
    {/if}
  </nav>
{/if}

<style>
  .prev-next {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
    margin-top: 4rem;
    padding-top: 2rem;
    border-top: 1px solid #e2e8f0;
  }

  .prev-next-link {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    padding: 1rem 1.25rem;
    border: 1px solid #e2e8f0;
    border-radius: 10px;
    text-decoration: none;
    transition: all 0.2s ease;
    min-width: 0;
  }

  .prev-next-link.prev {
    grid-column: 1;
  }

  .prev-next-link.next {
    grid-column: 2;
    text-align: right;
  }

  .prev-next-link:hover {
    border-color: var(--c-brand, #cd1404);
    background-color: #fef2f2;
  }

  .prev-next-label {
    font-size: 0.8rem;
    color: #94a3b8;
    font-weight: 500;
  }

  .prev-next-title {
    font-size: 0.9375rem;
    font-weight: 600;
    color: #334155;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .prev-next-link:hover .prev-next-title {
    color: var(--c-brand, #cd1404);
  }

  @media (max-width: 640px) {
    .prev-next {
      grid-template-columns: 1fr;
    }

    .prev-next-link.next {
      grid-column: 1;
    }
  }
</style>
