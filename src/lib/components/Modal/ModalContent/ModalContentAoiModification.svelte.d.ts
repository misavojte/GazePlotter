import { SvelteComponent } from "svelte";
declare const __propDef: {
    props: {
        selectedStimulus?: string | undefined;
        userSelected?: string | undefined;
    };
    events: {
        [evt: string]: CustomEvent<any>;
    };
    slots: {};
};
export type ModalContentAoiModificationProps = typeof __propDef.props;
export type ModalContentAoiModificationEvents = typeof __propDef.events;
export type ModalContentAoiModificationSlots = typeof __propDef.slots;
export default class ModalContentAoiModification extends SvelteComponent<ModalContentAoiModificationProps, ModalContentAoiModificationEvents, ModalContentAoiModificationSlots> {
}
export {};
