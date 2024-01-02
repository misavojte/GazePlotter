/// <reference types="svelte" />
import type { ToastFillingType } from '../../type/Filling/ToastFilling/ToastFillingType.ts';
export declare const toastStore: import("svelte/store").Writable<ToastFillingType[]>;
export declare const addToast: (toast: ToastFillingType) => void;
export declare const addErrorToast: (message: string) => void;
export declare const addSuccessToast: (message: string) => void;
export declare const addInfoToast: (message: string) => void;
