import { writable } from 'svelte/store';
import type { SvelteComponent } from 'svelte';

type ComponentConstructor = new (...args: any) => SvelteComponent;

type Modal = {
  component: ComponentConstructor,
  title: string,
  props?: Record<string, any>
};

const createModalStore = () => {
  const { subscribe, set } = writable<Modal | null>(null);

  return {
    subscribe,
    open: (component: ComponentConstructor, title: string, props?: Record<string, any>) => set({component, title, props}),
    close: () => set(null)
  };
}

export const modalStore = createModalStore();
