import {UpdateMessage} from "../common/UpdateMessage";
import {AbstractModel} from "../model/AbstractModel";

export class AbstractController {

    model: AbstractModel;

    constructor(model: AbstractModel) {
        this.model = model;
    }

    /**
     * Fire according event type handler. These type handlers should be customized to do expected actions.
     * @param e - Event passed from event listener in AbstractView
     */
    handleEvent(e: Event) {
        e.stopPropagation();
        switch (e.type) {
            case 'click' : this.handleClickEvent(e); break;
            case 'change' : this.handleChangeEvent(e); break;
            default : this.handleDefaultEvent(e);
        }
    }

    handleClickEvent(e: Event) {this.handleDefaultEvent(e)}

    handleChangeEvent(e: Event) {this.handleDefaultEvent(e)}

    handleDefaultEvent(e: Event) {
        console.warn('Event type not registered in controller', this, e)
    }

    /**
     * Create new UpdateMessage and post it to AbstractModel
     * @param type - String providing information about type of update
     * @param body - Actual data of update message
     * @param isViewOnly - Whether to propagate update by AbstractModel only to AbstractView
     */
    postUpdate(type: string, body: Object, isViewOnly: boolean = false) {
        this.model.update(new UpdateMessage(type, body, isViewOnly))
    }

}