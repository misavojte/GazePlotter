import { SvelteComponent } from "svelte";
declare const __propDef: {
    props: {
        isOpen?: boolean | undefined;
        items: {
            label: string;
            action: () => void;
        }[];
    };
    events: {
        [evt: string]: CustomEvent<any>;
    };
    slots: {};
};
export type GeneralButtonMenuProps = typeof __propDef.props;
export type GeneralButtonMenuEvents = typeof __propDef.events;
export type GeneralButtonMenuSlots = typeof __propDef.slots;
export default class GeneralButtonMenu extends SvelteComponent<GeneralButtonMenuProps, GeneralButtonMenuEvents, GeneralButtonMenuSlots> {
}
export {};
