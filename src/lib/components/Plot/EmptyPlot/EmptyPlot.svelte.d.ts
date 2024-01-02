/** @typedef {typeof __propDef.props}  EmptyPlotProps */
/** @typedef {typeof __propDef.events}  EmptyPlotEvents */
/** @typedef {typeof __propDef.slots}  EmptyPlotSlots */
export default class EmptyPlot extends SvelteComponent<{
    [x: string]: never;
}, {
    [evt: string]: CustomEvent<any>;
}, {}> {
}
export type EmptyPlotProps = typeof __propDef.props;
export type EmptyPlotEvents = typeof __propDef.events;
export type EmptyPlotSlots = typeof __propDef.slots;
import { SvelteComponent } from "svelte";
declare const __propDef: {
    props: {
        [x: string]: never;
    };
    events: {
        [evt: string]: CustomEvent<any>;
    };
    slots: {};
};
export {};
