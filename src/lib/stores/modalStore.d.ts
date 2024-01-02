import type { SvelteComponent } from 'svelte';
type ComponentConstructor = new (...args: any) => SvelteComponent;
type Modal = {
    component: ComponentConstructor;
    title: string;
    props?: Record<string, any>;
};
export declare const modalStore: {
    subscribe: (this: void, run: import("svelte/store").Subscriber<Modal | null>, invalidate?: import("svelte/store").Invalidator<Modal | null> | undefined) => import("svelte/store").Unsubscriber;
    open: (component: ComponentConstructor, title: string, props?: Record<string, any>) => void;
    close: () => void;
};
export {};
