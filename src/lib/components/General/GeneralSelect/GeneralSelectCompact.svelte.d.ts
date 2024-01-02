import { SvelteComponent } from "svelte";
declare const __propDef: {
    props: {
        options: {
            value: string;
            label: string;
        }[];
        label: string;
        value?: string | undefined;
    };
    events: {
        [evt: string]: CustomEvent<any>;
    };
    slots: {};
};
export type GeneralSelectCompactProps = typeof __propDef.props;
export type GeneralSelectCompactEvents = typeof __propDef.events;
export type GeneralSelectCompactSlots = typeof __propDef.slots;
export default class GeneralSelectCompact extends SvelteComponent<GeneralSelectCompactProps, GeneralSelectCompactEvents, GeneralSelectCompactSlots> {
}
export {};
