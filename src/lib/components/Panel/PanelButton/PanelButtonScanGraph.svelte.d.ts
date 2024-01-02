import { SvelteComponent } from "svelte";
declare const __propDef: {
    props: Record<string, never>;
    events: {
        [evt: string]: CustomEvent<any>;
    };
    slots: {};
};
export type PanelButtonScanGraphProps = typeof __propDef.props;
export type PanelButtonScanGraphEvents = typeof __propDef.events;
export type PanelButtonScanGraphSlots = typeof __propDef.slots;
export default class PanelButtonScanGraph extends SvelteComponent<PanelButtonScanGraphProps, PanelButtonScanGraphEvents, PanelButtonScanGraphSlots> {
}
export {};
