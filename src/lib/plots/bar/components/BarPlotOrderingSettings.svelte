<script lang="ts">
  import { type MenuItem } from '$lib/context-menu'
  import type { BarPlotGridType } from '$lib/workspace/type/gridType'

  interface Props {
    item: MenuItem
    syncs: {
      orderBy: { value: BarPlotGridType['orderBy'] }
      orderDirection: { value: BarPlotGridType['orderDirection'] }
      minScale: { value: number }
      maxScale: { value: number }
    }
    close: () => void
  }

  let { item, syncs, close }: Props = $props()

  function handleSubmit(e: Event) {
    e.preventDefault()
    close()
  }
</script>

<div class="settings-container">
  <form onsubmit={handleSubmit}>
    <div class="order-row">
      <div class="order-columns">
        <div class="column">
          <label class="column-label">Order by</label>
          <div class="radio-group">
            <label class="radio-label">
              <input
                type="radio"
                name="orderBy"
                value="value"
                bind:group={syncs.orderBy.value}
              />
              <span>Value</span>
            </label>
            <label class="radio-label">
              <input
                type="radio"
                name="orderBy"
                value="aoi"
                bind:group={syncs.orderBy.value}
              />
              <span>AOI order</span>
            </label>
          </div>
        </div>

        <div class="column">
          <label class="column-label">Direction</label>
          <div class="radio-group">
            <label class="radio-label">
              <input
                type="radio"
                name="orderDirection"
                value="asc"
                bind:group={syncs.orderDirection.value}
              />
              <span>ASC</span>
            </label>
            <label class="radio-label">
              <input
                type="radio"
                name="orderDirection"
                value="desc"
                bind:group={syncs.orderDirection.value}
              />
              <span>DESC</span>
            </label>
          </div>
        </div>
      </div>
    </div>

    <div class="separator"></div>

    <div class="scale-row">
      <span class="section-title">Scale range [ms]</span>
      <div class="scale-inputs">
        <div class="input-group">
          <label for="min-scale">Min</label>
          <input
            id="min-scale"
            type="number"
            bind:value={syncs.minScale.value}
            min="0"
          />
        </div>
        <div class="input-group">
          <label for="max-scale">Max (0 = Auto)</label>
          <input
            id="max-scale"
            type="number"
            bind:value={syncs.maxScale.value}
            min="0"
          />
        </div>
      </div>
    </div>
  </form>
</div>

<style>
  .settings-container {
    box-sizing: border-box;
  }
  form {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .separator {
    height: 1px;
    background: #e5e7eb;
    margin: 4px 0;
  }
  .order-row,
  .scale-row {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .section-title {
    font-size: 11px;
    font-weight: 500;
    color: #666;
    display: block;
  }
  .order-columns {
    display: flex;
    gap: 12px;
  }
  .column {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .column-label,
  .input-group label {
    font-size: 11px;
    font-weight: 500;
    color: #666;
    display: block;
  }
  .radio-group {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .radio-label {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 11px;
    cursor: pointer;
    color: #333;
    user-select: none;
    white-space: nowrap;
  }
  .radio-label input {
    margin: 0;
    cursor: pointer;
    accent-color: var(--c-brand);
    width: 12px;
    height: 12px;
  }
  .radio-label:hover {
    color: var(--c-brand);
  }
  .scale-inputs {
    display: flex;
    gap: 8px;
  }
  .input-group {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .input-group input {
    width: 100%;
    box-sizing: border-box;
    padding: 3px 6px;
    border: 1px solid #ccc;
    border-radius: var(--rounded, 4px);
    font-size: 11px;
    outline: none;
    transition: border-color 0.2s;
  }
  .input-group input:focus {
    border-color: var(--c-brand);
  }
</style>
