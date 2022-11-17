import { UpdateMessage } from "../common/UpdateMessage";
import {AbstractModel} from "./AbstractModel";

export class StartButtonsModel extends AbstractModel {

    observerType = 'startModel';

    update(msg: UpdateMessage) {
        switch (msg.type) {
            case 'startDemo' : return this.startDemo();
            case 'newFile' : return this.startNewFile(msg.body);
        }
        super.update(msg);
    }

    startDemo(): void {
        this.postNotification('start',{}, ['workplaceModel']);
        fetch('/demodata.json')
            .then(response => {
                return response.json()
            })
            .then(x => {
                console.log(x);
                // this.#printNewScarf();
            })
    }

    startNewFile(file: Object) : void {
        if (!(file instanceof FileList)) return;
        console.log("A");
    }
}