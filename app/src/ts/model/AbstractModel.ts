import {UpdateMessage} from "../common/UpdateMessage";
import {AbstractView} from "../view/AbstractView";

export class AbstractModel {

    private observingViews: AbstractView[] = [];
    private observingModels: AbstractModel[] = [];

    /**
     * Add an observer for changes to this.observingViews or this.observingModels
     * @param observer - Observer for changes
     */
    addObserver(observer: AbstractModel|AbstractView) {
        if (observer instanceof AbstractView) {
            this.observingViews.push(observer);return
        }
        this.observingModels.push(observer)
    }

    /**
     * Remove an observer for changes from this.observingViews or this.observingModels
     * @param observer - Observer for changes
     */
    removeObserver(observer: AbstractModel|AbstractView) {
        const removeIndex = (observers: AbstractModel[]|AbstractView[]) => observers.findIndex((obs) => {
            return observer === obs;
        });

        let observers = observer instanceof AbstractView ? this.observingViews : this.observingModels;

        if (removeIndex(observers) !== -1) {
            observers = observers.slice(removeIndex(observers), 1);
        }
    }

    /**
     * Loops over observingViews and observingModels and calls the update method on each of them.
     * The method will be called everytime AbstractModel is updated, unless stopped from within.
     * @param msg - UpdateMessage containing instructions how to update
     */
    notify(msg: UpdateMessage) {

        const doNotification = (observers: AbstractModel[]|AbstractView[]) => {
            if(observers.length > 0) {
                observers.forEach((observer: AbstractModel|AbstractView) => {
                    observer.update(msg.createChildMessage());
                })
            }
        }

        doNotification(this.observingViews);
        if (msg.isViewOnly) return;
        doNotification(this.observingModels);

    }

    /**
     * Gets called by the AbstractModel::notify method.
     * Firstly the update is handled. If it returns TRUE, notify method is called.
     * @param msg - UpdateMessage containing instructions how to update
     */
    update(msg: UpdateMessage) {
        if (this.handleUpdate(msg)) this.notify(msg);
    }

    /**
     *
     * @param {UpdateMessage} msg
     */
    handleUpdate(msg: UpdateMessage) {
        console.warn("handleUpdate method was not implemented in model extension", this, msg);
        return false;
    }

    postNotification(type: string, body: Object, isViewOnly: boolean = true) {
        this.notify(new UpdateMessage(type, body, isViewOnly))
    }

}