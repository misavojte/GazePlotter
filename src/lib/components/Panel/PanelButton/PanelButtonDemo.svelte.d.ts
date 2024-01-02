import { SvelteComponent } from "svelte";
declare const __propDef: {
    props: Record<string, never>;
    events: {
        [evt: string]: CustomEvent<any>;
    };
    slots: {};
};
export type PanelButtonDemoProps = typeof __propDef.props;
export type PanelButtonDemoEvents = typeof __propDef.events;
export type PanelButtonDemoSlots = typeof __propDef.slots;
export default class PanelButtonDemo extends SvelteComponent<PanelButtonDemoProps, PanelButtonDemoEvents, PanelButtonDemoSlots> {
}
export {};
