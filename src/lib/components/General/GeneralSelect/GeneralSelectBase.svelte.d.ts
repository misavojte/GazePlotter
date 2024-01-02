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
export type GeneralSelectBaseProps = typeof __propDef.props;
export type GeneralSelectBaseEvents = typeof __propDef.events;
export type GeneralSelectBaseSlots = typeof __propDef.slots;
export default class GeneralSelectBase extends SvelteComponent<GeneralSelectBaseProps, GeneralSelectBaseEvents, GeneralSelectBaseSlots> {
}
export {};
