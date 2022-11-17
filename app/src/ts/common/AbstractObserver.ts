import {UpdateMessage} from "./UpdateMessage";

export interface AbstractObserver {
    observerType: string;
    update(msg: UpdateMessage) : void;
}