import {AbstractController} from "../controller/AbstractController";
import {UpdateMessage} from "../common/UpdateMessage";

export class AbstractView {

    get isView(): boolean {
        return this._isView;
    }

    private _isView: boolean = true;
    element: HTMLElement;
    controller: AbstractController;

    /**
     *
     * @param {AbstractController} controller
     * @param {HTMLElement} element
     * @param {boolean} registerToModel
     */
    constructor(controller: AbstractController, element: HTMLElement, registerToModel: boolean = true) {
        this.element = element;
        this.controller = controller;
        if (registerToModel) this.controller.model.addObserver(this);
        this.registerEventListeners();
    }

    registerEventListeners() {
        const EVENT_TYPES: string[] = ['click', 'change'];
        for (let eventIndex = 0; eventIndex < EVENT_TYPES.length; eventIndex++) {
            const toRegisterEvents = this.element.getElementsByClassName(`js-${EVENT_TYPES[eventIndex]}`);
            for (let i = 0; i < toRegisterEvents.length; i++) {
                toRegisterEvents[i].addEventListener(EVENT_TYPES[eventIndex], this.controller)
            }
        }
    }

    /**
     * Gets called by the AbstractModel::notify method.
     */
    update(data: UpdateMessage) {
        console.log('update received', this);
        this.handleUpdate(data);
    }

    handleUpdate(data: UpdateMessage) {
        console.warn("update method in view not implemented", this, data)
    }
}