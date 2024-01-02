<script lang="ts">

    export let options: Array<{ value: string, label: string }>
    export let label: string
    export let value: string = options[0].value
    const name = label.toLowerCase().replace(/ /g, '-')
    const handleChange = (e: Event) => {
      const target = e.target as HTMLSelectElement
      value = target.value
    }
</script>

<div>
    <label for={name}>{label}</label>
    <select name={name} id=GP-{name} on:change={handleChange}>
        {#each options as option}
            <option value={option.value} selected={option.value === value}>{option.label}</option>
        {/each}
    </select>
</div>

<style>
    div {
        display: flex;
        flex-direction: column;
        position: relative;
    }
    label {
        font-size: 8px;
        position: absolute;
        font-weight: 500;
        line-height: 1rem;
        letter-spacing: 0.0333333333em;
        text-transform: uppercase;
        color: rgba(0, 0, 0, 0.6);
        background: #ebebef;
        padding-inline: 4px;
        left: 10px;
    }
    select {
        font-weight: 400;
        line-height: 1.5rem;
        letter-spacing: 0.00938em;
        color: rgba(0, 0, 0, 0.87);
        border-radius: 4px;
        border: 1px solid rgba(0, 0, 0, 0.23);
        background-color: #ebebef;
        transition: border-color 0.2s ease-in-out;
        font-size: 14px;
        width: 140px;
        -webkit-appearance: none;
        -moz-appearance: none;
        appearance: none;
        cursor: pointer;
        padding: 5px 23px 3px 13px;
        margin: 7px 0 0;
        height: 34px;
    }

    div:after {
        content: '⌄';
        position: absolute;
        top: 0;
        right: 17px;
        color: rgba(0, 0, 0, 0.54);
        width: 1px;
        height: 100%;
        box-sizing: border-box;
        padding-top: 8px;
        pointer-events: none;
    }

    select:focus {
        outline: none;
        border-color: #1976d2;
    }
    select:disabled {
        background-color: rgba(0, 0, 0, 0.12);
        color: rgba(0, 0, 0, 0.38);
        cursor: not-allowed;
    }
</style>
