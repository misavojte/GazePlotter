import { SvelteComponent } from "svelte";
declare const __propDef: {
    props: Record<string, never>;
    events: {
        [evt: string]: CustomEvent<any>;
    };
    slots: {};
};
export type ToasterProps = typeof __propDef.props;
export type ToasterEvents = typeof __propDef.events;
export type ToasterSlots = typeof __propDef.slots;
export default class Toaster extends SvelteComponent<ToasterProps, ToasterEvents, ToasterSlots> {
}
export {};
