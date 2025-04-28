<script lang="ts">
  type ColumnType = 'originalName' | 'displayedName'

  interface Props {
    column: ColumnType
    label: string
    sortColumn: ColumnType | null
    sortDirection: 'asc' | 'desc' | null
    onSort: (params: {
      column: ColumnType
      newSortDirection: 'asc' | 'desc'
    }) => void
  }

  let { column, label, sortColumn, sortDirection, onSort }: Props = $props()

  // SVG icons
  const sortIcons = {
    up: `<svg width="8" height="14" viewBox="0 0 8 10" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 1L6 3M4 1L2 3M4 1V9" stroke="currentColor" stroke-width="1" stroke-linecap="round"/></svg>`,
    down: `<svg width="8" height="14" viewBox="0 0 8 10" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 9L2 7M4 9L6 7M4 9V1" stroke="currentColor" stroke-width="1" stroke-linecap="round"/></svg>`,
    both: `<svg width="8" height="14" viewBox="0 0 8 10" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 1L6 3M4 1L2 3M4 1V9M4 9L2 7M4 9L6 7" stroke="currentColor" stroke-width="1" stroke-linecap="round"/></svg>`,
  }

  const handleClick = () => {
    const newSortDirection =
      sortColumn === column && sortDirection === 'asc' ? 'desc' : 'asc'
    onSort({ column, newSortDirection })
  }
</script>

<button class="sort-header" onclick={handleClick}>
  {label}
  <span class="sort-icon">
    {@html sortColumn === column
      ? sortDirection === 'asc'
        ? sortIcons.up
        : sortIcons.down
      : sortIcons.both}
  </span>
</button>

<style>
  .sort-header {
    display: flex;
    align-items: center;
    gap: 2px;
    cursor: pointer;
    user-select: none;
    background: none;
    border: none;
    padding: 0;
    font: inherit;
    color: inherit;
    text-align: left;
  }

  .sort-header:hover {
    color: var(--c-primary);
  }

  .sort-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
    color: #999999;
    border-radius: 50%;
    transition: all 0.2s ease;
  }

  .sort-header:hover .sort-icon {
    background-color: #999999;
    color: white;
  }
</style>
