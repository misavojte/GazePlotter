import { SvelteComponent } from "svelte";
declare const __propDef: {
    props: {
        scarfId: number;
    };
    events: {
        [evt: string]: CustomEvent<any>;
    };
    slots: {};
};
export type ScarfPlotSelectStimulusProps = typeof __propDef.props;
export type ScarfPlotSelectStimulusEvents = typeof __propDef.events;
export type ScarfPlotSelectStimulusSlots = typeof __propDef.slots;
export default class ScarfPlotSelectStimulus extends SvelteComponent<ScarfPlotSelectStimulusProps, ScarfPlotSelectStimulusEvents, ScarfPlotSelectStimulusSlots> {
}
export {};
