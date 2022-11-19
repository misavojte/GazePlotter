import '../css/workplace.css'
import { StartButtonsController } from './Front/StartButtons/StartButtonsController'
import { StartButtonsModel } from './Front/StartButtons/StartButtonsModel'
import { StartButtonsView } from './Front/StartButtons/StartButtonsView'
import { WorkplaceController } from './Front/Workplace/WorkplaceController'
import { WorkplaceModel } from './Front/Workplace/WorkplaceModel'
import { WorkplaceView } from './Front/Workplace/WorkplaceView'

const startButtonModel = new StartButtonsModel()
const workplaceModel = new WorkplaceModel(startButtonModel)

void new StartButtonsView(new StartButtonsController(startButtonModel))

startButtonModel.addObserver(workplaceModel)

void new WorkplaceView(new WorkplaceController(workplaceModel))
