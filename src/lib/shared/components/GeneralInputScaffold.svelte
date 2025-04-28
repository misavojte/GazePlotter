<script lang="ts">
  /**
   * GeneralInputScaffold is a base component that provides consistent styling and structure
   * for form input components. It handles the layout of labels and input elements,
   * ensuring consistent spacing and accessibility across all input types.
   *
   * This component is used as a wrapper by other input components (Text, Number, File, etc.)
   * to maintain a consistent look and feel throughout the application.
   *
   * @example
   * ```svelte
   * <GeneralInputScaffold label="Username" id="username">
   *   <input type="text" />
   * </GeneralInputScaffold>
   * ```
   */
  interface Props {
    /** The text label for the input field */
    label: string
    /** The unique identifier for the input field */
    id: string
    /** The input element(s) to be wrapped by the scaffold */
    children?: import('svelte').Snippet<[any]>
  }

  let { label, id, children }: Props = $props()
</script>

<div class="input">
  <label for={id}>{label}</label>
  {@render children?.({ itemtype: 'input' })}
</div>

<style>
  .input {
    display: flex;
    flex-direction: column;
    margin-bottom: 15px;
    gap: 5px;
  }

  label {
    font-size: 14px;
    color: var(--c-black);
    font-weight: 500;
  }
</style>
