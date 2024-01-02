import { SvelteComponent } from "svelte";
declare const __propDef: {
    props: {
        options: {
            value: string;
            label: string;
        }[];
        legend: string;
        userSelected?: string | undefined;
    };
    events: {
        [evt: string]: CustomEvent<any>;
    };
    slots: {};
};
export type GeneralRadioProps = typeof __propDef.props;
export type GeneralRadioEvents = typeof __propDef.events;
export type GeneralRadioSlots = typeof __propDef.slots;
export default class GeneralRadio extends SvelteComponent<GeneralRadioProps, GeneralRadioEvents, GeneralRadioSlots> {
}
export {};
