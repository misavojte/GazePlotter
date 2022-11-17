import {AbstractController} from "./AbstractController";
import {StartButtonsModel} from "../model/StartButtonsModel";

export class StartButtonsController extends AbstractController {

    constructor(model: StartButtonsModel) {
        super(model);
    }

    handleClickEvent(e: Event) {
        if((<HTMLInputElement>e.target).id === 'start-demo') this.postUpdate('startDemo', {});
    }

    handleChangeEvent(e: Event) {
        const files = (<HTMLInputElement>e.target).files;
        if (files !== null) this.postUpdate('newFile', files);
    }
}