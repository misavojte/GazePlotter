import {AbstractController} from "./AbstractController";
import {WorkplaceModel} from "../model/WorkplaceModel";

export class WorkplaceController extends AbstractController {
    constructor(model: WorkplaceModel) {
        super(model);
    }
}