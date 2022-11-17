export class UpdateMessage {

    public type: string;
    public body: Object;
    public observerTypes: string[];


    constructor(type: string, body: Object, observerTypes: string[] = []) {
        this.type = type;
        this.body = body;
        this.observerTypes = observerTypes;
    }

    isForObserverType(observerType: string) : boolean {
        return this.observerTypes.length === 0 ? true : this.observerTypes.includes(observerType)
    }

    createChildMessage() {
        return new UpdateMessage(this.type, this.body, this.observerTypes)
    }
}