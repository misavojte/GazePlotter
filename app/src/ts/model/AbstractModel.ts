import {UpdateMessage} from "../common/UpdateMessage";
import {AbstractObserver} from "../common/AbstractObserver";

export class AbstractModel implements AbstractObserver {

    private observers: AbstractObserver[] = [];
    observerType: string = 'model';

    /**
     * Add an observer for changes to this.observingViews or this.observingModels
     * @param observer - Observer for changes
     */
    addObserver(observer: AbstractObserver) {
        this.observers.push(observer)
    }

    /**
     * Remove an observer for changes from this.observingViews or this.observingModels
     * @param observer - Observer for changes
     */
    removeObserver(observer: AbstractObserver) : void {
        const removeIndex = (observers: AbstractObserver[]) => observers.findIndex((obs) => {
            return observer === obs;
        });

        if (removeIndex(this.observers) !== -1) {
            this.observers.splice(removeIndex(this.observers), 1);
        }
    }

    /**
     * Loops over observingViews and observingModels and calls the update method on each of them.
     * The method will be called everytime AbstractModel is updated, unless stopped from within.
     * @param msg - UpdateMessage containing instructions how to update
     */
    notify(msg: UpdateMessage) : void {

        if(this.observers.length > 0) {
            this.observers.forEach((observer: AbstractObserver) => {
                if(msg.isForObserverType(observer.observerType)) observer.update(msg.createChildMessage());
            })
        }
    }

    /**
     * Gets called by the AbstractModel::notify method.
     * @param msg - UpdateMessage containing instructions how to update
     */
    update(msg: UpdateMessage) : void {
        console.warn("update method was not implemented in model extension", this, msg);
    }

    postNotification(type: string, body: Object, observerTypes: string[]) : void {
        this.notify(new UpdateMessage(type, body, observerTypes))
    }

}