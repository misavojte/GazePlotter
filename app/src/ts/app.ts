import "../css/workplace.css"
import {StartButtonsView} from "./view/StartButtonsView";
import {StartButtonsModel} from "./model/StartButtonsModel";
import { StartButtonsController } from "./controller/StartButtonsController";
import {WorkplaceModel} from "./model/WorkplaceModel";
import {WorkplaceView} from "./view/WorkplaceView";
import { WorkplaceController } from "./controller/WorkplaceController";

const startButtonModel = new StartButtonsModel();
const workplaceModel = new WorkplaceModel();
new StartButtonsView(new StartButtonsController(startButtonModel));

startButtonModel.addObserver(workplaceModel);

new WorkplaceView(new WorkplaceController(workplaceModel));