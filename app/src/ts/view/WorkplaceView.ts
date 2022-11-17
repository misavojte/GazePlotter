import {AbstractView} from "./AbstractView";
import {WorkplaceController} from "../controller/WorkplaceController";
import { UpdateMessage } from "../common/UpdateMessage";

export class WorkplaceView extends AbstractView {
    constructor(controller: WorkplaceController) {
        super(controller, WorkplaceView.creatWorkplaceElement());
    }

    static creatWorkplaceElement() : HTMLElement {
        const el = document.createElement("section");
        el.style.display = "none";
        el.className = "anim";
        el.id = "analysis";
        el.innerHTML = WorkplaceView.createStartingInnerHtml();
        document.querySelector('main')
            ?.insertBefore(el, document.getElementById('about'));
        return el
    }

    update(msg: UpdateMessage) {
        switch (msg.type) {
            case 'reveal' : return this.reveal();
            case 'start' : return this.addLoader()
        }
        super.update(msg);
    }

    reveal() : void {
        this.element.style.display = '';
    }

    addLoader() : void {
        const el = document.getElementById('workplace');
        if (!(el instanceof HTMLElement)) throw ReferenceError('');
        el.innerHTML = WorkplaceView.createLoaderOuterHtml()
    }

    static createStartingInnerHtml() : string {
        return `
<h2 class='main-section ana-title'>Your analysis and visualization</h2>
<div class='btnholder left-align main-section'>
    <button id='save-workplace' class='btn4 js-click'>Save workplace</button>
</div>
<div id='workplace'>
${WorkplaceView.createLoaderOuterHtml()}
</div>`
    }

    static createLoaderOuterHtml() : string {
        return `
<div id='loader-wrap'>
    <div class='bars-7'></div>
    <div>Processing your precious data</div>
</div>
        `
    }
}