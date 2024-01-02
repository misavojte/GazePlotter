import { SvelteComponent } from "svelte";
declare const __propDef: {
    props: {
        legend: string;
        files?: FileList | null | undefined;
        multiple?: boolean | undefined;
        accept?: string[] | undefined;
    };
    events: {
        [evt: string]: CustomEvent<any>;
    };
    slots: {};
};
export type GeneralInputFileProps = typeof __propDef.props;
export type GeneralInputFileEvents = typeof __propDef.events;
export type GeneralInputFileSlots = typeof __propDef.slots;
export default class GeneralInputFile extends SvelteComponent<GeneralInputFileProps, GeneralInputFileEvents, GeneralInputFileSlots> {
}
export {};
