import { UpdateMessage } from "../common/UpdateMessage";
import {AbstractModel} from "./AbstractModel";

export class WorkplaceModel extends AbstractModel {

    observerType = 'workplaceModel';
    isVisible:boolean = false;

    update(msg: UpdateMessage) {
        switch (msg.type) {
            case 'start' : return this.startNewLoading();
            case 'firstChart' : return this.startPrintingFirstChart();
        }
        super.update(msg);
    }

    startNewLoading() : void {
        if (this.isVisible) {return this.postNotification('reload',{},[])}
        this.postNotification('reveal',{},[])
        this.isVisible = true;
    }

    startPrintingFirstChart() : void {
    }

}