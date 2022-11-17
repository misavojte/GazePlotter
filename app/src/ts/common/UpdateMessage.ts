export class UpdateMessage {

    public type: string;
    public body: Object;
    public isViewOnly: boolean;


    constructor(type: string, body: Object, isViewOnly: boolean) {
        this.type = type;
        this.body = body;
        this.isViewOnly = isViewOnly;
    }
    
    createChildMessage() {
        return new UpdateMessage(this.type, this.body, this.isViewOnly)
    }
}