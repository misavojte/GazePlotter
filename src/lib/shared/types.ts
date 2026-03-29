import type { Component } from 'svelte'
import type { IconProps } from 'lucide-svelte'

export type LucideIconComponent =
  | Component<IconProps>
  | typeof import('lucide-svelte').Icon
