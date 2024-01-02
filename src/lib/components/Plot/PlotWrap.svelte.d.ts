import { SvelteComponent } from "svelte";
declare const __propDef: {
    props: {
        title: string;
        maxWidth?: string | undefined;
    };
    events: {
        [evt: string]: CustomEvent<any>;
    };
    slots: {
        header: {};
        body: {};
    };
};
export type PlotWrapProps = typeof __propDef.props;
export type PlotWrapEvents = typeof __propDef.events;
export type PlotWrapSlots = typeof __propDef.slots;
export default class PlotWrap extends SvelteComponent<PlotWrapProps, PlotWrapEvents, PlotWrapSlots> {
}
export {};
