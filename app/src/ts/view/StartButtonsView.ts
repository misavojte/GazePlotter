import {AbstractView} from "./AbstractView";
import {StartButtonsController} from "../controller/StartButtonsController";

export class StartButtonsView extends AbstractView {
    constructor(controller: StartButtonsController) {
        const el = document.querySelector('.cont1');
        if (!(el instanceof HTMLElement)) throw new TypeError('StartButtonsView element not found');
        super(controller, el);
    }
}