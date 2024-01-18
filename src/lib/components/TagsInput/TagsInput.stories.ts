import type { Meta, StoryObj } from '@storybook/svelte'
// import { useArgs } from '@storybook/preview-api'

import TagsInput from './TagsInput.svelte'

const meta = {
  title: 'Inputs/TagsInput',
  component: TagsInput,
  tags: ['autodocs'],
  // TODO: make storybook updating args from within story
  // https://storybook.js.org/docs/writing-stories/args#setting-args-from-within-a-story
} satisfies Meta<TagsInput>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const FilledOut: Story = {
  args: {
    value: ['Agnes', 'Bartholomeus', 'Frida', 'Martin'],
  },
}

export const WithSuggestions: Story = {
  args: {
    value: ['Agnes', 'Bartholomeus'],
    suggestions: [...(FilledOut.args?.suggestions ?? []), 'John', 'Caroline'],
  },
}
