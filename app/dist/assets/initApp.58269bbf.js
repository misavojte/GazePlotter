var ee=Object.defineProperty;var ie=(d,s,t)=>s in d?ee(d,s,{enumerable:!0,configurable:!0,writable:!0,value:t}):d[s]=t;var o=(d,s,t)=>(ie(d,typeof s!="symbol"?s+"":s,t),t),se=(d,s,t)=>{if(!s.has(d))throw TypeError("Cannot "+t)};var m=(d,s,t)=>{if(s.has(d))throw TypeError("Cannot add the same private member more than once");s instanceof WeakSet?s.add(d):s.set(d,t)};var c=(d,s,t)=>(se(d,s,"access private method"),t);import{_ as ne}from"./index.ae009942.js";class ${}class oe extends ${constructor(t){super();o(this,"model");this.model=t}handleEvent(t){switch(t.stopPropagation(),t.type){case"click":return this.model.startDemo();case"change":this.handleChangeEvent(t)}}handleChangeEvent(t){if(!(t.target instanceof HTMLInputElement))return;const e=t.target.files;e!==null&&this.model.startNewFile(e)}}class bt{constructor(){o(this,"observerType","observer")}update(s){this.handleUpdate(s)}handleUpdate(s){console.warn("Msg type not recognized in observer",this,s)}}class ae extends bt{constructor(){super(...arguments);o(this,"observerType","publisher");o(this,"observers",[])}addObserver(t){this.observers.push(t)}removeObserver(t){const e=i=>i.findIndex(n=>t===n);e(this.observers)!==-1&&this.observers.splice(e(this.observers),1)}notify(t,e=[]){const i=n=>e.length===0?!0:e.includes(n);this.observers.length>0&&this.observers.forEach(n=>{i(n.observerType)&&n.update(t)})}}class b extends ae{}class re{async preprocessEyeTrackingFiles(s){const t=[],e=[],i=[];for(let l=0;l<s.length;l++){const h=s[l],u=await this.getSlice(h),g=this.getTypeFromSlice(u);g!=="unknown"&&(i.push(g),t.push(h.name),e.push(h))}const n=this.getTypeFromArray(i);return{workerSettings:{type:n,rowDelimiter:`\r
`,columnDelimiter:n==="gazepoint"?",":"	",fileNames:t,userInputSetting:null},files:e}}async getSlice(s){const t=s.slice(0,1e3),e=new FileReader;return e.readAsText(t),await new Promise(i=>{e.onload=()=>{const n=e.result;typeof n=="string"&&i(n)}})}getTypeFromArray(s){if(s.length===0)return"unknown";if(s.every(t=>t===s[0]))return s[0];throw new Error("Mixed file types")}getTypeFromSlice(s){return this.isTobii(s)?s.includes("Event")?"tobii-with-event":"tobii":this.isGazePoint(s)?"gazepoint":this.isBeGaze(s)?"begaze":this.isOgama(s)?"ogama":"unknown"}isTobii(s){return s.includes("Recording timestamp")}isGazePoint(s){return s.includes("FPOGS")&&s.includes("FPOGD")}isBeGaze(s){return s.includes("Event Start Trial Time [ms]")&&s.includes("Event End Trial Time [ms]")}isOgama(s){return s.includes("# Contents: Similarity Measurements of scanpaths.")}}class le extends b{constructor(){super(...arguments);o(this,"observerType","startModel");o(this,"eyeTrackingData",null);o(this,"worker",new Worker(new URL("/assets/DataUploadWorker.59913fd0.js",self.location),{type:"module"}));o(this,"service",new re);o(this,"parsingSettings",null);o(this,"failMessage",null)}fireUploadWithUserInput(t){const e=this.parsingSettings;if(e===null)throw new Error("parsingSettings is null");e.workerSettings.userInputSetting=t,this.startWorkerProcessing()}startDemo(){this.notify("start",["workplaceModel"]),ne(()=>import("./DemoData.6d170cdc.js"),[]).then(t=>{this.eyeTrackingData=t.demoData,this.notify("eyeTrackingData",["workplaceModel"])}).catch(t=>{console.log(t)})}startNewFile(t){if(!(t instanceof FileList))return;if(this.notify("start",["workplaceModel"]),t[0].name.endsWith(".json"))return this.loadJsonFile(t[0]);this.service.preprocessEyeTrackingFiles(t).then(i=>{this.parsingSettings=i;const n=i.workerSettings.type;n==="tobii-with-event"?this.notify("open-tobii-upload-modal",["workplaceModel"]):n==="unknown"?this.fail("Unknown file type"):this.startWorkerProcessing()}),this.worker.onmessage=i=>{this.eyeTrackingData=i.data,this.notify("eyeTrackingData",["workplaceModel"])}}startWorkerProcessing(){try{const t=this.parsingSettings;if(t===null)throw new Error("parsingSettings is null");this.worker.postMessage({type:"settings",data:t.workerSettings}),this.isStreamTransferable()?this.processDataAsStream(t.files):this.processDataAsArrayBuffer(t.files)}catch(t){console.error(t),this.fail("Error while transferring data to worker")}}processDataAsStream(t){for(let e=0;e<t.length;e++){const i=t[e].stream();this.worker.postMessage({type:"stream",data:i},[i])}}async processDataAsArrayBuffer(t){for(let e=0;e<t.length;e++){const i=await t[e].arrayBuffer();this.worker.postMessage({type:"buffer",data:i},[i])}}isStreamTransferable(){const t=new ReadableStream({start(e){e.enqueue(new Uint8Array([])),e.close()}});try{return this.worker.postMessage({type:"test-stream",stream:t},[t]),!0}catch{return!1}}fail(t){this.failMessage=t,this.notify("fail",["workplaceModel"])}loadJsonFile(t){const e=new FileReader;e.onload=i=>{i.target!==null&&(this.eyeTrackingData=JSON.parse(i.target.result).main,this.notify("eyeTrackingData",["workplaceModel"]))},e.readAsText(t)}}class M extends bt{registerEventListeners(s,t){for(let e=0;e<t.length;e++){const i=s.getElementsByClassName(`js-${t[e]}`);i.length===0&&console.warn(`No elements with class name js-${t[e]} found.`,s);for(let n=0;n<i.length;n++)i[n].addEventListener(t[e],this.controller)}}getElement(s){const t=this.el.querySelector(s);if(!(t instanceof Element))throw ReferenceError(`Element ${s} not found in view`);return t}}class de extends M{constructor(t){super();o(this,"el");o(this,"controller");const e=document.querySelector(".cont1");if(!(e instanceof HTMLElement))throw new TypeError("StartButtonsView element not found");this.el=e,this.controller=t,this.registerEventListeners(e,["click","change"])}}class he extends ${constructor(t){super();o(this,"model");this.model=t}handleEvent(t){if(t.stopPropagation(),!this.model.isCrashed)switch(t.type){case"click":return this.handleClick(t)}}handleClick(t){switch(t.target.id){case"save-workplace":return this.model.openWorkplaceModal();case"save-scan-graph":return this.model.initScanGraphDownloadModal()}}}class ce{constructor(s){o(this,"DEFAULT_COLORS",["#66c5cc","#f6cf71","#f89c74","#dcb0f2","#87c55f","#9eb9f3","#fe88b1","#c9db74","#8be0a4","#b497e7","#d3b484","#b3b3b3"]);o(this,"main");this.main=s}get noOfStimuli(){return this.main.stimuli.data.length}getStimulInfo(s){return{originalName:this.getStimulOriginalName(s),displayedName:this.getStimulDisplayedName(s),highestEndTime:this.getStimulHighestEndTime(s)}}getStimulDisplayedName(s){var e;const t=this.main.stimuli.data[s];if(t===void 0)throw new Error;return(e=t[1])!=null?e:t[0]}getStimulOriginalName(s){const t=this.main.stimuli.data[s];if(t===void 0)throw new Error;return t[0]}getStimulHighestEndTime(s){let t=0;for(let e=0;e<this.noOfParticipants;e++){const i=this.getParticEndTime(s,e);t=i>t?t=i:t}return t}getParticName(s){var e;const t=this.main.participants.data[s];return(e=t[1])!=null?e:t[0]}getParticOriginalName(s){return this.main.participants.data[s][0]}getParticEndTime(s,t){const e=this.main.segments[s][t];return e===void 0?0:e.length>0?e[e.length-1][1]:0}getParticInfo(s,t){return{displayedName:this.getParticName(t),orginalName:this.getParticOriginalName(t),endTime:this.getParticEndTime(s,t)}}getAoiInfo(s,t){var r,l;const e=this.main.aois.data[s][t],i=e[0],n=(r=e[1])!=null?r:i,a=(l=e[2])!=null?l:this.DEFAULT_COLORS[t];return{aoiId:t,originalName:i,displayedName:n,color:a}}getCatInfo(s){var n;const t=this.main.categories.data[s],e=t[0],i=(n=t[1])!=null?n:t[0];return{originalName:e,displayedName:i}}getSegmentInfo(s,t,e){var h;const i=(h=this.main.segments[s][t])==null?void 0:h[e];if(i===void 0)throw new Error;const n=i[0],a=i[1],r=i[2],l=this.orderAoisIdsByOrderVector(s,i.slice(3));return{start:n,end:a,category:r,aoi:l}}orderAoisIdsByOrderVector(s,t){var i;const e=(i=this.main.aois.orderVector)==null?void 0:i[s];return e==null?t:t.sort((n,a)=>e.indexOf(n)-e.indexOf(a))}getNoOfSegments(s,t){var e,i,n;return(n=(i=(e=this.main.segments[s])==null?void 0:e[t])==null?void 0:i.length)!=null?n:0}getAoiOrderArray(s){var e;const t=(e=this.main.aois.orderVector)==null?void 0:e[s];if(t==null){const i=this.main.aois.data[s].length;return[...Array(i).keys()]}return t}get noOfParticipants(){return this.main.participants.data.length}setAoiColor(s,t,e){this.getAoiInfo(s,t).color!==e&&(this.main.aois.data[s][t][2]=e)}setAoiName(s,t,e){this.getAoiInfo(s,t).displayedName!==e&&(this.main.aois.data[s][t][1]=e)}setAoiOrder(s,t){this.getAoiOrderArray(s)!==t&&(this.main.aois.orderVector[s]=t)}addAoiVis(s,t,e,i=null){const a=this.main.aois.data[s].findIndex(l=>l[0]===t);let r=`${s}_${a}`;return i!=null&&(r+=`_${i}`),a>-1?(this.main.aois.dynamicVisibility[r]=e,!0):!1}getAoiVis(s,t,e=null){var a,r;const i=`${s}_${t}`;let n=(a=this.main.aois.dynamicVisibility[i])!=null?a:null;if(e!=null){const l=`${i}_${e}`;n=(r=this.main.aois.dynamicVisibility[l])!=null?r:n}return n}}var D,Mt,I,mt,L,St,k,It,H,At,A,ut,F,Et,_,Tt,V,xt,E,gt,B,Ot,R,$t,W,Ct,P,Nt,U,Dt,j,Lt;class me extends M{constructor(t){super();m(this,D);m(this,I);m(this,L);m(this,k);m(this,H);m(this,A);m(this,F);m(this,_);m(this,V);m(this,E);m(this,B);m(this,R);m(this,W);m(this,P);m(this,U);m(this,j);o(this,"controller");o(this,"el");o(this,"observerType","scarf-view");this.controller=t,this.el=c(this,k,It).call(this),this.controller.model.addObserver(this),this.registerEventListeners(this.el,["click","change","dblclick","mouseover","mouseleave"]),this.getElement(".tooltip-area").append(this.controller.model.tooltipComponent.el)}handleUpdate(t){switch(t){case"zoom":return c(this,D,Mt).call(this);case"timeline":return c(this,I,mt).call(this);case"stimulus":return c(this,I,mt).call(this);case"highlight":return c(this,L,St).call(this)}super.handleUpdate(t)}}D=new WeakSet,Mt=function(){const t=this.controller.model,e=this.el.getElementsByTagName("animate")[0];e.setAttribute("from",`${t.zoomFrom}%`),e.setAttribute("to",`${t.zoomTo}%`),e.beginElement()},I=new WeakSet,mt=function(){this.getElement(".chartwrap").innerHTML=c(this,A,ut).call(this,this.controller.model.getData())},L=new WeakSet,St=function(){const t=this.controller.model;this.getElement("style").innerHTML=c(this,B,Ot).call(this,t.highlightedType)},k=new WeakSet,It=function(){const t=document.createElement("div");return t.className="anh anim scarf",t.innerHTML=c(this,H,At).call(this,this.controller.model.getData()),t},H=new WeakSet,At=function(t){return`
    <style></style>
    <h3 class="cardtitle">Sequence chart (Scarf plot)</h3>
    <div class="btnholder">
    <select class="js-change">
          ${t.stimuli.map(e=>`<option value="${e.id}">${e.name}</option>`).join("")}
    </select>
    ${c(this,R,$t).call(this)}
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="js-click svg-icon bi-zoom-in" viewBox="0 0 16 16">
      <path fill-rule="evenodd" d="M6.5 12a5.5 5.5 0 1 0 0-11 5.5 5.5 0 0 0 0 11zM13 6.5a6.5 6.5 0 1 1-13 0 6.5 6.5 0 0 1 13 0z"/>
      <path d="M10.344 11.742c.03.04.062.078.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1.007 1.007 0 0 0-.115-.1 6.538 6.538 0 0 1-1.398 1.4z"/>
      <path fill-rule="evenodd" d="M6.5 3a.5.5 0 0 1 .5.5V6h2.5a.5.5 0 0 1 0 1H7v2.5a.5.5 0 0 1-1 0V7H3.5a.5.5 0 0 1 0-1H6V3.5a.5.5 0 0 1 .5-.5z"/>
    </svg>
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="js-click svg-icon bi-zoom-out" viewBox="0 0 16 16">
      <path fill-rule="evenodd" d="M6.5 12a5.5 5.5 0 1 0 0-11 5.5 5.5 0 0 0 0 11zM13 6.5a6.5 6.5 0 1 1-13 0 6.5 6.5 0 0 1 13 0z"/>
      <path d="M10.344 11.742c.03.04.062.078.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1.007 1.007 0 0 0-.115-.1 6.538 6.538 0 0 1-1.398 1.4z"/>
      <path fill-rule="evenodd" d="M3 6.5a.5.5 0 0 1 .5-.5h6a.5.5 0 0 1 0 1h-6a.5.5 0 0 1-.5-.5z"/>
    </svg>
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="js-click svg-icon bi-download" viewBox="0 0 16 16">
      <path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5z"/>
      <path d="M7.646 11.854a.5.5 0 0 0 .708 0l3-3a.5.5 0 0 0-.708-.708L8.5 10.293V1.5a.5.5 0 0 0-1 0v8.793L5.354 8.146a.5.5 0 1 0-.708.708l3 3z"/>
    </svg>
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="js-click svg-icon bi-wrench" viewBox="0 0 16 16">
      <path d="M.102 2.223A3.004 3.004 0 0 0 3.78 5.897l6.341 6.252A3.003 3.003 0 0 0 13 16a3 3 0 1 0-.851-5.878L5.897 3.781A3.004 3.004 0 0 0 2.223.1l2.141 2.142L4 4l-1.757.364L.102 2.223zm13.37 9.019.528.026.287.445.445.287.026.529L15 13l-.242.471-.026.529-.445.287-.287.445-.529.026L13 15l-.471-.242-.529-.026-.287-.445-.445-.287-.026-.529L11 13l.242-.471.026-.529.445-.287.287-.445.529-.026L13 11l.471.242z"/>
    </svg>
    </div>
    <div class="tooltip-area js-mouseleave">
        <div class="js-mouseover chartwrap">
        ${c(this,A,ut).call(this,t)}
        </div>
    </div>`},A=new WeakSet,ut=function(t){const e=this.controller.model;return`
    <style>
        ${t.stylingAndLegend.aoi.map(i=>`rect.${i.identifier}{fill:${i.color}}`).join("")}
        ${t.stylingAndLegend.category.map(i=>`rect.${i.identifier}{fill:${i.color}}`).join("")}
        ${c(this,P,Nt).call(this,t)}
    </style>
    <div class='chylabs' style='grid-auto-rows:${t.heightOfBarWrap}px' data-gap='${t.heightOfBarWrap}'>
        ${t.participants.map(i=>`<div>${i.label}</div>`).join("")}
    </div>
    <div class='charea-holder'>
        <svg xmlns='http://www.w3.org/2000/svg' id='charea' width='100%' height='${t.chartHeight}'>
            <animate attributeName='width' from='100%' to='100%' dur='0.3s' fill='freeze'/>
            <defs>
                <pattern id='grid' width="${e.getPatternWidth()}"
                         height="${t.heightOfBarWrap}" patternUnits="userSpaceOnUse">
                    <rect fill='none' width='100%' height='100%' stroke='#cbcbcb' stroke-width='1'/>
                </pattern>
            </defs>
            <rect fill='url(#grid)' stroke='#cbcbcb' stroke-width='1' width='100%'
                  height='${t.chartHeight-20}'/>
            <svg y='${t.chartHeight-14}' class='chxlabs'>
                ${c(this,F,Et).call(this,t.timeline)}
            </svg>
            ${t.participants.map((i,n)=>c(this,_,Tt).call(this,i,n,t.heightOfBarWrap)).join("")}
        </svg>
    </div>
    <div class='chxlab'>
        ${e.getXAxisLabel()}
    </div>
    <div class="chlegendwrap">
        <div class="js-dblclick" data-event="open-modal" data-modal="edit-aoi">
            <div class='chlegendtitle'>
                Fixations
            </div>
            <div class='chlegend'>
                ${t.stylingAndLegend.aoi.map(i=>c(this,E,gt).call(this,i)).join("")}
            </div>
        </div>
        <div class="js-dblclick">
            <div class='chlegendtitle'>
                Other segment categories
            </div>
            <div class='chlegend'>
                ${t.stylingAndLegend.category.map(i=>c(this,E,gt).call(this,i)).join("")}
            </div>
        </div>
        ${c(this,U,Dt).call(this,t)}
    </div>`},F=new WeakSet,Et=function(t){let e="<text x='0' text-anchor='start'>0</text>";for(let i=1;i<t.length-1;i++){const n=t[i];e+=`<text x='${n/t.maxLabel*100}%' text-anchor='middle'>${n}</text>`}return e+=`<text x='100%' text-anchor='end'>${t.maxLabel}</text>`,e},_=new WeakSet,Tt=function(t,e,i){return`
    <svg class='barwrap' y='${e*i}' data-id='${t.id}' height='${i}' width='${t.width}'>
      <animate attributeName='width' from='0%' to='${t.width}' dur='0.4s' fill='freeze'/>
      ${t.segments.map((n,a)=>c(this,V,xt).call(this,n,a)).join("")}
      ${c(this,W,Ct).call(this,t)}
    </svg>`},V=new WeakSet,xt=function(t,e){return`
    <g data-id='${e}'>
    ${t.content.map(i=>`<rect class='${i.identifier}' height='${i.height}' x='${i.x}' width='${i.width}' y='${i.y}'></rect>`).join("")}
    </g>`},E=new WeakSet,gt=function(t){return`
    <div class="${t.identifier} legendItem">
        <svg width="12" height="${t.height}">
            <rect class="${t.identifier}" width="100%" height="100%" fill="${t.color}"/>
        </svg>
        <div>
            ${t.name}
        </div>
    </div>`},B=new WeakSet,Ot=function(t){return t===null?"":`rect[class^='a']{opacity:0.2}rect.${t}{opacity:1;stroke:#0000007d}line[class^='a']{opacity:0.2}line.${t}{opacity:1;stroke-width:100%}`},R=new WeakSet,$t=function(){return this.controller.model.data.main.isOrdinalOnly?"":`
    <select class="js-change timeline-switch">
        <option value="0" selected>Absolute timeline</option>
        <option value="1">Relative timeline</option>
        <option value="2">Ordinal timeline</option>
    </select>`},W=new WeakSet,Ct=function(t){let e="";const i=t.dynamicAoiVisibility;for(let n=0;n<i.length;n++){const a=i[n].content;for(let r=0;r<a.length;r++){const{identifier:l,x1:h,x2:u,y:g}=a[r];e+=`<line class="${l}" x1="${h}" y1="${g}" x2="${u}" y2="${g}"></line>`}}return e},P=new WeakSet,Nt=function(t){let e="";const i=t.stylingAndLegend.visibility;if(i.length===0)return e;for(let n=0;n<i.length;n++)e+=`line.${i[n].identifier}{stroke:${i[n].color};}`;return e+=`line{stroke-width:${i[0].height};stroke-dasharray:1}`,e},U=new WeakSet,Dt=function(t){const e=t.stylingAndLegend.visibility;return e.length===0?"":`
    <div class="js-dblclick">
        <div class='chlegendtitle'>
            Dynamic AOI visibility
        </div>
        <div class='chlegend'>
            ${e.map(i=>c(this,j,Lt).call(this,i)).join("")}
        </div>
    </div>`},j=new WeakSet,Lt=function(t){return`
    <div class="${t.identifier} legendItem">
        <svg width="12" height="12">
            <line class="${t.identifier}" x1="0" x2="100%" y1="50%" y2="50%"/>
        </svg>
        <div>
            ${t.name}
        </div>
    </div>`};var T,ft;class ue extends M{constructor(t){super();m(this,T);o(this,"controller");o(this,"el");this.controller=t,this.controller.model.addObserver(this),this.el=document.createElement("div"),this.el.className="scarf-tooltip",this.setVisibility()}handleUpdate(t){switch(t){case"changeVisibility":return this.setVisibility();case"move":return this.move();case"redraw":return this.redraw()}super.handleUpdate(t)}setVisibility(){this.el.style.display=this.controller.model.isVisible?"":"none"}move(){this.el.innerHTML=c(this,T,ft).call(this),this.el.style.left=`${this.controller.model.x}px`,this.el.style.top=`${this.controller.model.y}px`}redraw(){this.el.innerHTML=c(this,T,ft).call(this),this.move(),this.setVisibility()}}T=new WeakSet,ft=function(){const t=this.controller.model;let e=`
  <div>
    <div>Participant</div>
    <div>${t.participantName}</div>
  </div>
  <div>
    <div>Category</div>
    <div>${t.categoryName}</div>
  </div>
  <div>
    <div>AOI</div>
    <div>${t.aoiNames}</div>
  </div>
  <div>
    <div>Order index</div>
    <div>${t.index}</div>
  </div>`;return t.data.main.isOrdinalOnly||(e+=`
  <div>
    <div>Event start</div>
    <div>${t.start.toFixed(1)} ms</div>
  </div>
  <div>
    <div>Event end</div>
    <div>${t.end.toFixed(1)} ms</div>
  </div>
  <div>
    <div>Event duration</div>
    <div>${t.duration.toFixed(1)} ms</div>
  </div>`),e};class ge extends ${constructor(t){super();o(this,"model");this.model=t}handleEvent(t){console.warn("ScarfTooltipController.handleEvent() not implemented",t)}}class fe extends b{constructor(t){super();o(this,"stimulusId",0);o(this,"observerType","scarfTooltipModel");o(this,"isVisible",!1);o(this,"x",0);o(this,"y",0);o(this,"participantName","");o(this,"categoryName","");o(this,"aoiNames","");o(this,"start",0);o(this,"end",0);o(this,"index",0);o(this,"data");this.data=t}get duration(){return this.end-this.start}show(){this.isVisible=!0,this.notify("changeVisibility",[])}hide(){this.isVisible=!1,this.notify("changeVisibility",[])}redraw(t,e,i,n){this.changeContent(t,e),this.move(i,n),this.show()}move(t,e){this.x=t,this.y=e,this.notify("move",[])}changeContent(t,e){const i=this.data.getSegmentInfo(this.stimulusId,t,e);this.participantName=this.data.getParticName(t),this.categoryName=this.data.getCatInfo(i.category).displayedName,this.aoiNames=i.aoi.length>0?i.aoi.map(n=>this.data.getAoiInfo(this.stimulusId,n).displayedName).join(", "):"No AOI hit",this.start=i.start,this.end=i.end,this.index=e,this.notify("redraw",[])}}var z,kt,q,Ht,G,Ft,X,_t,K,Vt,Y,Bt,J,Rt,Z,Wt;class pe{constructor(s,t,e,i,n,a=10){m(this,z);m(this,q);m(this,G);m(this,X);m(this,K);m(this,Y);m(this,J);m(this,Z);o(this,"IDENTIFIER_IS_AOI","a");o(this,"IDENTIFIER_IS_OTHER_CATEGORY","ac");o(this,"IDENTIFIER_NOT_DEFINED","N");o(this,"HEIGHT_OF_X_AXIS",20);o(this,"showTheseSegmentCategories",[0,1]);o(this,"heightOfBar",20);o(this,"heightOfNonFixation",4);o(this,"stimulusId");o(this,"data");o(this,"spaceAboveRect");o(this,"spaceAboveLine",2);o(this,"aoiOrderedArr");o(this,"participants");o(this,"timeline");o(this,"stimuli");o(this,"stylingAndLegend");o(this,"chartHeight");o(this,"settings");this.stimulusId=s,this.settings=n,this.data=i,this.spaceAboveRect=a/2,this.aoiOrderedArr=i.getAoiOrderArray(s),this.timeline=e;const r=[];for(let l=0;l<t.length;l++){const h=c(this,X,_t).call(this,t[l]);h!==null&&r.push(h)}this.participants=r,this.chartHeight=r.length*this.heightOfBarWrap+this.HEIGHT_OF_X_AXIS,this.stimuli=c(this,z,kt).call(this),this.stylingAndLegend=c(this,q,Ht).call(this)}get rectWrappedHeight(){return this.heightOfBar+this.spaceAboveRect*2}get lineWrappedHeight(){return this.heightOfNonFixation+this.spaceAboveLine}get heightOfBarWrap(){const s=this.rectWrappedHeight;return this.showAoiVisibility?s+this.lineWrappedHeight*this.aoiOrderedArr.length:s}get showAoiVisibility(){return this.settings.aoiVisibility&&this.settings.timeline!=="ordinal"}getViewFilling(){return{barHeight:this.heightOfBar,stimulusId:this.stimulusId,heightOfBarWrap:this.heightOfBarWrap,chartHeight:this.chartHeight,stimuli:this.stimuli,participants:this.participants,timeline:this.timeline,stylingAndLegend:this.stylingAndLegend}}}z=new WeakSet,kt=function(){const s=this.data.main.stimuli.data.length,t=[];for(let e=0;e<s;e++){const i={id:e,name:this.data.getStimulDisplayedName(e)};t.push(i)}return t},q=new WeakSet,Ht=function(){const s=this.aoiOrderedArr.length,t=[];for(let r=0;r<s;r++){const l=this.aoiOrderedArr[r],h=this.data.getAoiInfo(this.stimulusId,l),u={identifier:`${this.IDENTIFIER_IS_AOI}${h.aoiId}`,name:h.displayedName,color:h.color,height:this.heightOfBar};t.push(u)}const e={identifier:`${this.IDENTIFIER_IS_AOI}${this.IDENTIFIER_NOT_DEFINED}`,name:"No AOI hit",color:"#a6a6a6",height:this.heightOfBar};t.push(e);const i={identifier:`${this.IDENTIFIER_IS_OTHER_CATEGORY}${1}`,name:"Saccade",color:"#555555",height:this.heightOfNonFixation},n={identifier:`${this.IDENTIFIER_IS_OTHER_CATEGORY}${this.IDENTIFIER_NOT_DEFINED}`,name:"Other",color:"#a6a6a6",height:this.heightOfNonFixation},a=[];return a.push(i),a.push(n),{visibility:c(this,G,Ft).call(this),aoi:t,category:a}},G=new WeakSet,Ft=function(){const s=this.aoiOrderedArr.length,t=[];if(!this.showAoiVisibility)return t;for(let e=0;e<s;e++){const i=this.aoiOrderedArr[e],n=this.data.getAoiInfo(this.stimulusId,i),a={identifier:`${this.IDENTIFIER_IS_AOI}${n.aoiId}`,name:n.displayedName,color:n.color,height:this.heightOfNonFixation};t.push(a)}return t},X=new WeakSet,_t=function(s){const t=this.data.getNoOfSegments(this.stimulusId,s),e=this.data.getParticEndTime(this.stimulusId,s),i=this.data.getParticName(s),n=this.settings.timeline==="relative"?"100%":`${e/this.timeline.maxLabel*100}%`,a=[];for(let r=0;r<t;r++)a.push(c(this,J,Rt).call(this,s,r,e));return{dynamicAoiVisibility:c(this,K,Vt).call(this,s,e),id:s,label:i,segments:a,width:n}},K=new WeakSet,Vt=function(s,t){const e=[];if(!this.showAoiVisibility)return e;for(let i=0;i<this.aoiOrderedArr.length;i++){const n=this.aoiOrderedArr[i],a=this.data.getAoiVis(this.stimulusId,n,s),r=[];if(a!==null)for(let h=0;h<a.length;h=h+2){const u=a[h],g=a[h+1],C=this.rectWrappedHeight+i*this.lineWrappedHeight;r.push(c(this,Y,Bt).call(this,u,g,C,t,n))}const l={content:r};e.push(l)}return e},Y=new WeakSet,Bt=function(s,t,e,i,n){const a=`${s/i*100}%`,r=`${t/i*100}%`,l=`${this.IDENTIFIER_IS_AOI}${n}`;return{x1:a,x2:r,y:e,identifier:l}},J=new WeakSet,Rt=function(s,t,e){const i=this.data.getSegmentInfo(this.stimulusId,s,t),n=this.settings.timeline==="ordinal",a=n?t:i.start,r=n?t+1:i.end,l=`${a/e*100}%`,h=`${(r-a)/e*100}%`;return{content:c(this,Z,Wt).call(this,i,l,h)}},Z=new WeakSet,Wt=function(s,t,e){let i=this.IDENTIFIER_IS_AOI,n=this.IDENTIFIER_NOT_DEFINED;const a=()=>i+n;if(s.category!==0){const u=this.heightOfNonFixation,g=this.spaceAboveRect+this.heightOfBar/2-u/2;return i=this.IDENTIFIER_IS_OTHER_CATEGORY,this.showTheseSegmentCategories.includes(s.category)&&(n=s.category.toString()),[{x:t,y:g,width:e,height:u,identifier:a()}]}if(s.aoi.length===0)return[{x:t,y:this.spaceAboveRect,width:e,height:this.heightOfBar,identifier:a()}];const r=this.heightOfBar/s.aoi.length;let l=this.spaceAboveRect;const h=[];for(const u of s.aoi){n=u.toString();const g={x:t,y:l,width:e,height:r,identifier:a()};h.push(g),l+=r}return h};class N extends b{constructor(t,e=0){super();o(this,"scarfId",0);o(this,"data");o(this,"stimulusId");o(this,"isDetached",!0);o(this,"zoomFrom",100);o(this,"zoomTo",100);o(this,"tooltipComponent");o(this,"absoluteTimeline");o(this,"highlightedType",null);o(this,"isRequestingModal",!1);o(this,"participantIds");o(this,"settings",{aoiVisibility:!1,timeline:"absolute",generalWidth:0,stimuliWidth:[]});o(this,"flashMessage",null);this.addObserver(t);const i=t.data;if(i===null)throw new Error("ScarfModel.constructor() - workplace.data is null");this.data=i,i.main.isOrdinalOnly&&(this.settings.timeline="ordinal"),this.tooltipComponent=new ue(new ge(new fe(i))),this.stimulusId=e,this.participantIds=this.getParticipantIdsToProcess(),this.absoluteTimeline=new f(this.getHighestEndTime(this.participantIds))}fireNewStimulus(t){this.stimulusId=t,this.participantIds=this.getParticipantIdsToProcess(),this.tooltipComponent.controller.model.stimulusId=t,this.redraw()}redraw(){if(this.absoluteTimeline=new f(this.getHighestEndTime(this.participantIds)),this.settings.timeline!=="ordinal"&&this.data.main.isOrdinalOnly)throw new Error("ScarfModel.redraw() - timeline is not ordinal but data is ordinal only");this.notify("stimulus",["scarf-view"])}getData(){return new pe(this.stimulusId,this.participantIds,this.getTimeline(),this.data,this.settings).getViewFilling()}getTimelineUnit(){return this.settings.timeline==="relative"?"%":"ms"}getXAxisLabel(){return this.settings.timeline==="ordinal"?"Order index":`Elapsed time [${this.getTimelineUnit()}]`}getPatternWidth(){return this.settings.timeline==="relative"?"10%":`${this.absoluteTimeline[1]/this.absoluteTimeline.maxLabel*100}%`}getTimeline(){return this.settings.timeline==="relative"?new f(100):this.absoluteTimeline}fireZoom(t){const e=this.zoomTo;e<=100&&!t||(this.zoomTo=t?e*2:e/2,this.zoomFrom=e,this.notify("zoom",[]))}fireTimelineChange(t){switch(t){case 0:this.settings.timeline="absolute";break;case 1:this.settings.timeline="relative";break;case 2:this.settings.timeline="ordinal";break}this.absoluteTimeline=new f(this.getHighestEndTime(this.participantIds)),this.notify("timeline",["scarf-view"])}fireHighlight(t){this.highlightedType=t,this.notify("highlight",["scarf-view"])}fireOpenSettings(){this.isRequestingModal=!0,this.notify("open-scarf-settings-modal",["workplaceModel"])}fireOpenAoiSettings(){this.isRequestingModal=!0,this.notify("open-aoi-settings-modal",["workplaceModel"])}fireDownload(){this.isRequestingModal=!0,this.notify("open-scarf-download-modal",["workplaceModel"])}getParticipantIdsToProcess(){const t=this.stimulusId,e=this.data,i=[];for(let n=0;n<e.noOfParticipants;n++)e.getNoOfSegments(t,n)>0&&i.push(n);return i}getHighestEndTime(t){var a;const e=this.settings;if(e.timeline==="relative")return 100;const i=(a=e.stimuliWidth[this.stimulusId])!=null?a:e.generalWidth;let n=e.timeline==="absolute"?i:0;for(let r=0;r<t.length;r++){const l=t[r],h=this.data.getNoOfSegments(this.stimulusId,l);if(h===0)continue;if(e.timeline==="ordinal"){h>n&&(n=h);continue}const u=this.data.getParticEndTime(this.stimulusId,l);if(u>n){if(i!==0)return this.addFlashMessage("warn","The set axis width is smaller than the highest end time of the participants."),n;n=u}}return n}addFlashMessage(t,e){this.flashMessage={type:t,message:e},this.notify("scarf-flash",["workplaceModel"])}}class f extends Array{constructor(s,t=10){const{step:e,length:i}=f.getSteps(s,t);super(i);for(let n=0;n<i;n++)this[n]=e*n}get maxLabel(){return this[this.length-1]}static getSteps(s,t){const e=f.getStep(s,t);for(;e===f.getStep(s,t-1);)t--;return{step:e,length:t+1}}static getStep(s,t){let e=s/t;const i=(Math.log(e)*Math.LOG10E+1|0)-1;return e=Math.ceil(e/10**i),e%2===1&&e%5>0&&e!==1&&e++,(e%6===0||e%8===0)&&(e=10),e*10**i}}var x,pt;class ve{constructor(s){m(this,x);o(this,"model");this.model=s}handleEvent(s){switch(s.stopPropagation(),s.type){case"click":return this.handleClick(s);case"mouseover":return this.handleMouseOver(s);case"mouseleave":return this.handleMouseLeave();case"change":return this.handleChange(s);case"dblclick":return this.handleDblClick(s)}}handleClick(s){const t=s.currentTarget,e=i=>t.classList.contains(i);if(e("bi-zoom-in"))return this.model.fireZoom(!0);if(e("bi-zoom-out"))return this.model.fireZoom(!1);if(e("bi-wrench"))return this.model.fireOpenSettings();if(e("bi-download"))return this.model.fireDownload()}handleMouseOver(s){const t=s.target;if(t.closest(".chart-tooltip")!==null)return;const e=t.closest("g");if(e instanceof Element)return this.handleMouseOverSegment(e,s);const i=t.closest(".legendItem");i instanceof HTMLElement?this.handleMouseOverLegendItem(i):this.model.fireHighlight(null),this.model.tooltipComponent.controller.model.hide()}handleMouseLeave(){this.model.tooltipComponent.controller.model.hide(),this.model.fireHighlight(null)}handleChange(s){const t=s.currentTarget;if(t.classList.contains("timeline-switch")){const i=Number(t.value);this.model.fireTimelineChange(i);return}const e=Number(t.value);this.model.fireNewStimulus(e)}handleMouseOverLegendItem(s){const t=s.classList[0];if(t==="")throw new Error("No segment identifier found in legend item");this.model.fireHighlight(t)}handleMouseOverSegment(s,t){const e=c(this,x,pt).call(this,s);if(e==null)return;const i=s.closest(".barwrap");if(!(i instanceof Element))return;const n=c(this,x,pt).call(this,i);if(n==null)return;const a=155,r=s.getBoundingClientRect().bottom+window.scrollY-1,l=window.scrollX+document.body.clientWidth,h=t.pageX+a>l?l-a:t.pageX;this.model.tooltipComponent.controller.model.redraw(n,e,h,r)}handleDblClick(s){s.currentTarget.dataset.modal==="edit-aoi"&&this.model.fireOpenAoiSettings()}}x=new WeakSet,pt=function(s){return Number(s.getAttribute("data-id"))};class v extends b{constructor(t,e){super();o(this,"_data",null);o(this,"title");o(this,"flashMessage",null);o(this,"isRequestingModal",!1);this._data=t.data,this.addObserver(t),this.title=e}get data(){const t=this._data;if(t===null)throw new Error("No workplace data available in modal");return t}fireClose(){this.notify("close-modal")}fireOpen(){this.notify("open-modal",["modal-view"])}addFlash(t,e){this.flashMessage={message:t,type:e},this.notify("modal-flash",["workplaceModel"])}}class wt{triggerDownload(s,t,e){const i=document.createElement("a");i.download=t+e,i.style.opacity="0",document.body.append(i),i.href=s,i.click(),i.remove()}}class we extends wt{download(s,t){const e=JSON.stringify(s),i=URL.createObjectURL(new Blob([e],{type:"application/json"}));super.triggerDownload(i,t,".json")}}class ye extends v{constructor(s){super(s,"Download workplace data")}fireDownload(s){this.addFlash("Preparing data for download","info");try{new we().download(this.data,s),this.addFlash("Download started","info"),this.fireClose()}catch(t){console.error(t),this.addFlash("Download failed","error")}}}class w extends ${handleEvent(s){if(s.type==="submit")return s.preventDefault(),this.handleSubmitEvent(s);if(s.type==="click")return s.target.classList.contains("modalClose")?this.model.fireClose():this.handleOtherClickEvent(s);this.handleOtherEvent(s)}handleOtherClickEvent(s){console.warn("AbstractModalController.handleOtherClickEvent() not implemented",s)}handleOtherEvent(s){console.warn("AbstractModalController.handleOtherEvent() not implemented",s)}handleSubmitEvent(s){console.warn("AbstractModalController.handleSubmitEvent() not implemented",s)}}class be extends w{constructor(t){super();o(this,"model");this.model=t}handleSubmitEvent(t){const e=t.target,n=new FormData(e).get("file_name");this.model.fireDownload(n)}}var Q,Pt,tt,Ut;class y extends M{constructor(t){super();m(this,Q);m(this,tt);o(this,"el");o(this,"observerType","modal-view");this.el=c(this,Q,Pt).call(this),t.model.addObserver(this)}handleUpdate(t){if(t==="close-modal")return this.close();if(t==="open-modal")return this.open();this.handleOtherUpdate(t)}handleOtherUpdate(t){console.warn("AbstractModalView.handleUpdate() - unhandled update: "+t)}close(){this.el.remove()}open(){this.el.innerHTML=c(this,tt,Ut).call(this),this.registerEventListeners(this.el,["click","submit"]),document.body.appendChild(this.el)}}Q=new WeakSet,Pt=function(){let t=document.getElementById("modal-container");return t===null&&(t=document.createElement("div"),t.id="modal-container",document.body.appendChild(t)),t},tt=new WeakSet,Ut=function(){return`
        <div class="interModal">
          <div class="modal-header">
            <h2>${this.controller.model.title}</h2>
            <div class="modalClose js-click">X</div>
          </div>
          <div class="modal-body">
            ${this.bodyHtml}
          </div>
        </div>`};var et,jt;class Me extends y{constructor(t){super(t);m(this,et);o(this,"bodyHtml");o(this,"controller");this.controller=t,this.bodyHtml=c(this,et,jt).call(this)}}et=new WeakSet,jt=function(){return`
    <form class="js-submit">
        <div>
            <label for="file_name">File name</label>
            <input type="text" name="file_name" value="scarf-export">
        </div>
        <input type="submit" value="Start Download">   
    </form>
    `};class Se extends M{constructor(t){super();o(this,"controller");o(this,"el");t.model.addObserver(this),this.controller=t,this.el=this.createManagerElement(),this.el.onclick=e=>{this.controller.handleEvent(e)},document.body.appendChild(this.el)}createManagerElement(){const t=document.createElement("div");return t.id=this.controller.model.elementId,t.classList.add("flash-manager"),t}handleUpdate(t){if(t==="add-flash")return this.addFlashMessage();if(t==="remove-flash")return this.removeFlashMessages(this.controller.model.messageIdsToRemove);super.handleUpdate(t)}addFlashMessage(){const t=this.controller.model.messageToAdd;if(t===null)throw new Error("FlashMessengerView.addFlashMessage() - flashMessage is null");const e=document.createElement("div");e.classList.add("flash-message-item"),e.classList.add(t.type),e.classList.add(`msg-${t.id}`),e.innerHTML=t.message,this.el.appendChild(e),requestAnimationFrame(()=>{this.growHeight(e).then(()=>{this.fadeIn(e)})})}removeFlashMessage(t){const e=this.getElement(`.msg-${t}`);e.style.opacity="0",e.addEventListener("transitionend",()=>{e.remove()})}removeFlashMessages(t){t.forEach(e=>{this.removeFlashMessage(e)})}async growHeight(t){return t.style.height=`${t.scrollHeight}px`,await new Promise(e=>{t.addEventListener("transitionend",()=>{e()},{once:!0})})}fadeIn(t){t.style.opacity="1"}}class Ie extends ${constructor(t){super();o(this,"model");this.model=t}handleEvent(t){const e=t.type;switch(e){case"click":return this.handleCloseClick(t);default:console.warn(`FlashMessengerController.handleEvent() - Unhandled event type: ${e}`)}}handleCloseClick(t){const e=t.target;if(e.classList.contains("flash-message-item")){const i=parseInt(e.classList[2].split("-")[1]);this.model.removeFlashMessage(i)}}}class Ae extends b{constructor(t="flash-message-manager"){super();o(this,"elementId");o(this,"lastMessageId",0);o(this,"messageToAdd",null);o(this,"messageIdsToRemove",[]);o(this,"activeMessages",[]);this.elementId=t,this.initViewController()}initViewController(){new Se(new Ie(this))}addFlashMessage(t,e){const i=this.lastMessageId;this.lastMessageId++,this.messageToAdd={id:i,message:t,type:e},this.notify("add-flash"),this.messageToAdd=null,this.activeMessages.push({id:i,timeout:this.getTimeout(i,e)})}removeFlashMessage(t){const e=this.activeMessages.find(i=>i.id===t);e!=null&&(clearTimeout(e.timeout),this.activeMessages=this.activeMessages.filter(i=>i.id!==t)),this.messageIdsToRemove.push(t),this.notify("remove-flash"),this.messageIdsToRemove=[]}getTimeout(t,e){return setTimeout(()=>{this.removeFlashMessage(t)},e==="error"||e==="warn"?1e4:2500)}}class ct extends v{constructor(t,e,i,n){super(t,"Scarf Chart Settings");o(this,"stimulusId");o(this,"scarfId");o(this,"scarfSettings");this.stimulusId=i,this.scarfId=n,this.scarfSettings=e}get width(){var t;return(t=this.scarfSettings.stimuliWidth[this.stimulusId])!=null?t:this.scarfSettings.generalWidth}openAoiSettingsModal(){this.isRequestingModal=!0,this.notify("open-aoi-settings-modal",["workplaceModel"])}openAoiVisibilityModal(){this.isRequestingModal=!0,this.notify("open-aoi-visibility-modal",["workplaceModel"])}fireWidthChange(t,e){e?(this.scarfSettings.generalWidth=t,this.scarfSettings.stimuliWidth=[]):this.scarfSettings.stimuliWidth[this.stimulusId]=t,this.notify("redraw",["workplaceModel"]),this.fireClose()}}class Ee extends y{constructor(t){super(t);o(this,"controller");o(this,"bodyHtml");this.controller=t,this.bodyHtml=this.printBodyHtml()}printBodyHtml(){return`
    <div class="button-group">
        <button class="btn4 js-click" data-modal="aoi-settings">AOIs Settings</button>
        <button class="btn4 js-click" data-modal="aoi-visibility">AOIs Visibility</button>
    </div>
    <form class="js-submit">
        <fieldset>
            <legend>X axis width [ms]</legend>
            <div style="margin-bottom:7px">
            <label>
                <input type="radio" name="x_axis_width_apply" value="this" checked>
                This stimulus
            </label>
            <label>
                <input type="radio" name="x_axis_width_apply" value="all">
                All stimuli
            </label>
            </div>
            <label class="flex-row">
                Value (0 = auto width)
                <input type="number" name="x_axis_width_value" value="${this.controller.model.width}" min="0" step="1">
            </label>
        </fieldset>
        <input type="submit" value="Confirm changes">  
    </form>
    `}}class Te extends w{constructor(t){super();o(this,"model");this.model=t}handleOtherClickEvent(t){switch(t.target.dataset.modal){case"aoi-settings":return this.model.openAoiSettingsModal();case"aoi-visibility":return this.model.openAoiVisibilityModal()}}handleSubmitEvent(t){const e=t.target,i=e.x_axis_width_apply.value==="all",n=Number(e.x_axis_width_value.value);if(n<0)throw new Error("Width cannot be negative");this.model.fireWidthChange(n,i)}}class xe{addVisInfo(s,t,e,i){var a;const n=e.getElementsByTagName("DynamicAOI");for(let r=0;r<n.length;r++){const l=(a=n[r].querySelector("Name"))==null?void 0:a.innerHTML;if(l===void 0)continue;const h=n[r].getElementsByTagName("KeyFrame"),u=this.processKeyFrames(h,s,i);i.addAoiVis(s,l,u,t)}}processKeyFrames(s,t,e){var a;const i=[];let n=!1;for(let r=0;r<s.length;r++){const l=s[r],h=(a=l.querySelector("Visible"))==null?void 0:a.innerHTML;if(h!==void 0){if(h==="true"&&!n){const u=l.querySelector("Timestamp");if(u===null)continue;const g=Number(u.innerHTML)/1e3;i.push(g),n=!0}if(h==="false"&&n){const u=l.querySelector("Timestamp");if(u===null)continue;const g=Number(u.innerHTML)/1e3;i.push(g),n=!1}if(h==="true"&&r===s.length-1){const u=e.getStimulHighestEndTime(t);i.push(u),n=!1}}}return i}}class Oe extends v{constructor(t,e,i){super(t,"Scarf Chart Settings");o(this,"settings");o(this,"stimulusId");this.stimulusId=e,this.settings=i}get participantOptions(){const t=[];t.push([-1,"All"]);for(let e=0;e<this.data.noOfParticipants;e++)t.push([e,this.data.getParticName(e)]);return t}fireAddInfo(t,e){if(t.name.split(".").pop()!=="xml"){this.addFlash("Not .xml file","error");return}t.text().then(n=>{const r=new DOMParser().parseFromString(n,"application/xml");new xe().addVisInfo(this.stimulusId,e,r,this.data),this.settings.aoiVisibility=!0,this.notify("redraw",["workplaceModel"]),this.addFlash("AOI visibility info added","success")}).catch(n=>{console.error(n),this.addFlash("Error while adding AOI visibility info","error")})}}class $e extends w{constructor(t){super();o(this,"model");this.model=t}handleSubmitEvent(t){const e=t.target,i=new FormData(e),n=i.get("file"),a=Number(i.get("participantId"));if(!(n instanceof File))throw new Error("AoiVisibilityModalController.handleSubmitEvent() - file not File");this.model.fireAddInfo(n,a===-1?null:a)}}class Ce extends y{constructor(t){super(t);o(this,"controller");o(this,"bodyHtml");this.controller=t,this.bodyHtml=this.printBodyHtml()}printBodyHtml(){return`
    <form class="js-submit">
        <div>
            Upload XML file containing AOIs visibility information. Only for SMI!
        </div>
        <fieldset>
            <legend>Dynamic AOI visibility for current stimulus</legend>
            <label class="flex-row">XML File
                <input type="file" name="file">
            </label>
            <label class="flex-row">
                Apply to participant
                <select name="participantId">
                    ${this.controller.model.participantOptions.map(([t,e])=>`<option value="${t}">${e}</option>`).join("")}
                </select>
            </label>
        </fieldset>
        <input type="submit" value="Start Parsing">  
    </form>
    `}}var it,zt,st,qt,nt,Gt,ot,Xt,at,Kt,rt,Yt,lt,Jt,dt,Zt;class Ne extends wt{constructor(t,e,i,n){super();m(this,it);m(this,st);m(this,nt);m(this,ot);m(this,at);m(this,rt);m(this,lt);m(this,dt);o(this,"minimalWidth",300);o(this,"width");o(this,"height");o(this,"fileType");o(this,"fileName");o(this,"staticSvg");if(Number(i)<this.minimalWidth)throw new Error(`Minimal width is ${this.minimalWidth}`);if(e!==".svg"&&e!==".png"&&e!==".jpg"&&e!==".webp")throw new Error("File type not supported");this.width=i,this.fileType=e,this.fileName=t,n.style.width=`${i}px`;const a=document.createElementNS("http://www.w3.org/2000/svg","svg");this.height=n.offsetHeight,a.setAttribute("width",n.offsetWidth.toString()),a.setAttribute("height",this.height.toString()),a.setAttribute("xmlns","http://www.w3.org/2000/svg"),a.innerHTML=c(this,nt,Gt).call(this,n),this.staticSvg=a,n.style.width=""}async download(){return await new Promise(t=>{this.buildContent().then(e=>{super.triggerDownload(e,this.fileName,this.fileType),t()})})}async buildContent(){return await new Promise(t=>{const e=c(this,it,zt).call(this,this.staticSvg);this.fileType!==".svg"?c(this,st,qt).call(this,e).then(i=>{t(i)}):t(e)})}}it=new WeakSet,zt=function(t){const e=new Blob([t.outerHTML],{type:"image/svg+xml;charset=utf-8"});return window.URL.createObjectURL(e)},st=new WeakSet,qt=async function(t){const e=this.width,i=this.height,n=document.createElement("canvas");n.style.width=`${e}px`,n.style.height=`${i}px`;const a=2;n.width=e*a,n.height=i*a;const r=n.getContext("2d");if(r==null)throw new Error("Canvas context is null");r.scale(a,a),r.fillStyle="white",r.fillRect(0,0,n.width,n.height);const l=new Image;return l.src=t,await new Promise(h=>{l.onload=()=>{r.imageSmoothingEnabled=!1,r.drawImage(l,0,0,e,i),h(n.toDataURL())}})},nt=new WeakSet,Gt=function(t){var i;const e=(i=t.querySelector("style"))==null?void 0:i.innerHTML;if(e==null)throw new Error("No style found");return`
        <style><![CDATA[${e}text{alignment-baseline:hanging;font-size:14px}.chxlabs text{font-size:11px}.chylabs text{alignment-baseline:middle}.chltitles text{text-anchor:middle;text-transform:uppercase;font-size:11px}.chlitems text{alignment-baseline:middle}]]></style>
        ${c(this,ot,Xt).call(this,t)}
        ${c(this,at,Kt).call(this,t)}
        ${c(this,rt,Yt).call(this,t)}
        ${c(this,lt,Jt).call(this,t)}
        ${c(this,dt,Zt).call(this,t)}`},ot=new WeakSet,Xt=function(t){var r,l;const e=(r=t.querySelector(".chylabs"))==null?void 0:r.children;if(e==null)throw new Error("No participant labels found");const i=Number((l=t.querySelector(".chylabs"))==null?void 0:l.getAttribute("data-gap"));let n=i/2,a="";for(let h=0;h<e.length;h++){const u=e[h].innerHTML;a+=`<text y="${n}">${u}</text>`,n+=i}return`<g class="chylabs">${a}</g>`},at=new WeakSet,Kt=function(t){const e=t.querySelector(".charea-holder"),i=e.offsetLeft-t.offsetLeft,n=e.cloneNode(!0),a=n.getElementsByTagName("animate");for(;a.length>0;)a[0].remove();return`<svg x="${i}" width="${t.offsetWidth-i}">${n.innerHTML}</svg>`},rt=new WeakSet,Yt=function(t){const e=t.querySelector(".chxlab");return`<text x="50%" y="${e.offsetTop-t.offsetTop}" text-anchor="middle">${e.innerText}</text>`},lt=new WeakSet,Jt=function(t){const e=t.getElementsByClassName("chlegendtitle");let i="";for(let n=0;n<e.length;n++){const a=e[n];i+=`<text x="50%" y="${a.offsetTop-t.offsetTop}">${a.innerHTML}</text>`}return`<g class="chltitles">${i}</g>`},dt=new WeakSet,Zt=function(t){const e=t.getElementsByClassName("legendItem");let i="";for(let n=0;n<e.length;n++){const a=e[n],r=a.children[0],l=a.children[1],h=a.offsetTop-t.offsetTop,u=a.offsetLeft-t.offsetLeft,g=r.getBoundingClientRect().left-a.getBoundingClientRect().left,C=r.getBoundingClientRect().top-a.getBoundingClientRect().top,te=l.getBoundingClientRect().left-a.getBoundingClientRect().left;i+=`
            <svg x="${u}" y="${h}" width="${a.offsetWidth}" height="${a.offsetHeight}">
            <svg x="${g}" y="${C-2}" width="${r.width.baseVal.valueInSpecifiedUnits}" height="${r.height.baseVal.valueInSpecifiedUnits}">${r.innerHTML}</svg>
            <text x="${te}" y="50%" alignment-baseline="middle">${l.innerHTML}</text>
            </svg>`}return`<g class="chlitems">${i}</g>`};class De extends v{constructor(t,e,i){super(t,"Scarf Chart Download");o(this,"stimulus");o(this,"scarfId");this.stimulus=e,this.scarfId=i}downloadScarf(t,e,i,n){this.addFlash("Rendering picture for export","info"),new Ne(t,e,Number(i),n).download().then(()=>{this.addFlash("Download started","success"),this.notify("close-modal")})}}class Le extends y{constructor(t){super(t);o(this,"controller");o(this,"bodyHtml");this.controller=t,this.bodyHtml=this.printBodyHtml()}printBodyHtml(){return`
    <form class="js-submit">
        <div>
            <label for="width">Width of the plot in px</label>
            <input type="number" name="width" value="800">
        </div>
         <div>
            <label for="file_name">File name</label>
            <input type="text" name="file_name" value="scarf-export">
        </div>
        <div>
            <label for="file_type">File extension</label>
            <select name="file_type">
              <option selected value=".svg">.svg</option>
              <option value=".png">.png</option>
              <option value=".jpg">.jpg</option>
              <option value=".webp">.webp</option>
            </select>
        </div>
        <input type="submit" value="Start Download">   
    </form>
    `}}class ke extends w{constructor(t){super();o(this,"model");this.model=t}handleSubmitEvent(t){const e=t.target,i=new FormData(e),n=i.get("file_name"),a=i.get("file_type"),r=i.get("width"),l=document.getElementsByClassName("chartwrap")[this.model.scarfId];if(!(l instanceof HTMLElement))throw new Error("ScanGraphDownloadModalController.handleSubmitEvent() - scarf not HTMLElement");this.model.downloadScarf(n,a,r,l)}}class He extends v{constructor(t,e){super(t,"AOIs Settings");o(this,"stimulusId");this.stimulusId=e}getAoisInfo(){return this.data.getAoiOrderArray(this.stimulusId).map(e=>this.data.getAoiInfo(this.stimulusId,e))}fireUpdateAoi(t,e,i,n){this.data.setAoiOrder(this.stimulusId,t);const a=t.length;for(let r=0;r<a;r++){const l=t[r],h=e[r],u=i[r];this.data.setAoiName(this.stimulusId,l,h),this.data.setAoiColor(this.stimulusId,l,u),n==="by_displayed_name"?this.modifyAllAoisColorByName(null,h,u):n==="by_original_name"&&this.modifyAllAoisColorByName(this.data.getAoiInfo(this.stimulusId,l).originalName,null,u)}this.addFlash("AOIs updated","info"),this.notify("redraw",["workplaceModel"]),this.fireClose()}modifyAllAoisColorByName(t,e,i){const n=this.data.noOfStimuli;for(let a=0;a<n;a++){const r=this.data.getAoiOrderArray(a);for(const l of r){const h=this.data.getAoiInfo(a,l);h.displayedName===e&&this.data.setAoiColor(a,l,i),h.originalName===t&&this.data.setAoiColor(a,l,i)}}}}class Fe extends y{constructor(t){super(t);o(this,"controller");o(this,"bodyHtml");this.controller=t,this.bodyHtml=this.printBodyHtml()}printBodyHtml(){return`
    <div class='gr-line'>
       <div>Original name</div>
       <div>Displayed name</div>
       <div>Color</div>
       <div>Order</div>
    </div>
    <form class="js-submit">
      <div>
      ${this.controller.model.getAoisInfo().map(e=>`
      <div class='gr-line'>
        <div>${e.originalName}</div>
        <input name='displayed_name' type='text' value='${e.displayedName}'>
        <input name='color' type='color' value='${e.color}'>
        <input name='aoi_id' type='hidden' value='${e.aoiId}'>
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="js-click svg-icon bi bi-arrow-up-short" viewBox="0 0 16 16">
          <path fill-rule="evenodd" d="M8 12a.5.5 0 0 0 .5-.5V5.707l2.146 2.147a.5.5 0 0 0 .708-.708l-3-3a.5.5 0 0 0-.708 0l-3 3a.5.5 0 1 0 .708.708L7.5 5.707V11.5a.5.5 0 0 0 .5.5z"/>
        </svg>
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="js-click svg-icon bi bi-arrow-down-short" viewBox="0 0 16 16">
          <path fill-rule="evenodd" d="M8 4a.5.5 0 0 1 .5.5v5.793l2.146-2.147a.5.5 0 0 1 .708.708l-3 3a.5.5 0 0 1-.708 0l-3-3a.5.5 0 1 1 .708-.708L7.5 10.293V4.5A.5.5 0 0 1 8 4z"/>
        </svg>
      </div>`).join("")}
      </div>
      <fieldset>
        <legend>Apply color to other stimuli</legend>
        <label>
            <input type="radio" name="apply_color" value="no" checked>
            No
        </label>
        <label>
            <input type="radio" name="apply_color" value="by_original_name">
            By original name
        </label>
        <label>
            <input type="radio" name="apply_color" value="by_displayed_name">
            By displayed name
        </label>
      </fieldset>
      <input type="submit" value="Apply changes">   
    </form>`}}var O,vt;class _e extends w{constructor(t){super();m(this,O);o(this,"model");this.model=t}handleSubmitEvent(t){const e=t.target,i=new FormData(e),n=i.getAll("displayed_name"),a=i.getAll("color"),r=i.getAll("aoi_id").map(h=>Number(h)),l=i.get("apply_color");this.model.fireUpdateAoi(r,n,a,l)}handleOtherClickEvent(t){const e=t.target;if(e.classList.contains("bi-arrow-up-short"))return this.moveViewRowUp(e);e.classList.contains("bi-arrow-down-short")&&this.moveViewRowDown(e)}moveViewRowUp(t){var i;const e=c(this,O,vt).call(this,t);e.previousElementSibling!=null?e.after(e.previousElementSibling):(i=e.parentElement)==null||i.append(e)}moveViewRowDown(t){var i;const e=c(this,O,vt).call(this,t);e.nextElementSibling!=null?e.before(e.nextElementSibling):(i=e.parentElement)==null||i.prepend(e)}}O=new WeakSet,vt=function(t){const e=t.closest(".gr-line");if(!(e instanceof HTMLElement))throw new Error("AoiSettingsModalController.#getRowToMove() - rowToMove not HTMLElement");return e};class Ve extends w{constructor(t){super();o(this,"model");this.model=t}handleSubmitEvent(t){const e=t.target,n=new FormData(e).get("stimuli_parsing");if(n!=="default"&&n!=="event")throw new Error("Invalid stimuli parsing type");this.model.fireUpload(n)}}var ht,Qt;class Be extends y{constructor(t){super(t);m(this,ht);o(this,"bodyHtml");o(this,"controller");this.controller=t,this.bodyHtml=c(this,ht,Qt).call(this)}}ht=new WeakSet,Qt=function(){return`
    <form class="js-submit">
        <div>
            <label for="stimuli_parsing_default">Default by media column</label>
            <input type="radio" name="stimuli_parsing" value="default" id="stimuli_parsing_default" checked>
        </div>
        <div>
            <label for="stimuli_parsing_event">By timeline events in event column</label>
            <input type="radio" name="stimuli_parsing" value="event" id="stimuli_parsing_event">
        </div>
        <input type="submit" value="Confirm parsing">   
    </form>
    `};class yt extends v{constructor(t){super(t,"Tobii Upload");o(this,"parsingType","default")}fireUpload(t){this.parsingType=t,this.addFlash("Tobii parsing settings accepted","info"),this.fireClose()}}class Re extends wt{download(s,t,e){const i=this.getStimulusScanGraphString(s,t),n=URL.createObjectURL(new Blob([i],{type:"text/plain"}));this.triggerDownload(n,e,".txt")}getStimulusScanGraphString(s,t){let e="";const i=[],n=[];for(let a=0;a<s.noOfParticipants;a++){e+=s.getParticOriginalName(a)+"	";for(let r=0;r<s.getNoOfSegments(t,a);r++){const l=s.getSegmentInfo(t,a,r).aoi;e+=this.getAoiString(l),!(n.includes(l[0])||l.length===0)&&(i.push(this.getAoiKeyPart(l,t,s)),l[0]!==void 0&&n.push(l[0]))}e+=`\r
`}return i.sort(),this.getHeaderString(i.join(", "))+e}getHeaderString(s){return`#
#
#
# Key:
# # = no fixation, ${s}
#
# The following part is the sequence similarity of the scanpaths
#
Sequence Similarity	Scanpath string
`}getAoiString(s){return s.length===0?"#":this.getAoiLetter(s[0])}getAoiLetter(s){return String.fromCharCode(65+s)}getAoiKeyPart(s,t,e){if(s.length===0)return"";const i=e.getAoiInfo(t,s[0]).displayedName;return`${this.getAoiLetter(s[0])} = ${i}`}}class We extends v{constructor(s){super(s,"ScanGraph Download")}fireDownload(s,t){this.addFlash("Preparing data for download","info");try{new Re().download(this.data,t,s),this.addFlash("Download started","info"),this.fireClose()}catch(e){console.error(e),this.addFlash("Download failed","error")}}}class Pe extends y{constructor(t){super(t);o(this,"controller");o(this,"bodyHtml");this.controller=t,this.bodyHtml=this.printBodyHtml()}printBodyHtml(){return`
    <form class="js-submit">
    <fieldset>
    <p>Warning! If multiple AOI hits are present in one segment, only the first by order will be exported.</p>
    <legend>For further visualizations in <a href="http://eyetracking.upol.cz/scangraph/">ScanGraph</a> tool</legend>
        <label class="flex-row">
            File name
            <input type="text" name="file_name" value="ScanGraph">
        </label>
        <label class="flex-row">
          Stimulus
          <select name="stimulus">
            ${this.printOptions()}
          </select>
        </label>
    </fieldset>
    <input type="submit" value="Start Download">   
    </form>
    `}printOptions(){const t=this.controller.model.data,e=t.noOfStimuli;let i="";for(let n=0;n<e;n++)i+=`<option value="${n}" ${n===0?"selected":""}>${t.getStimulDisplayedName(n)}</option>`;return i}}class Ue extends w{constructor(t){super();o(this,"model");this.model=t}handleSubmitEvent(t){const e=t.target,i=new FormData(e),n=i.get("file_name"),a=i.get("stimulus");this.model.fireDownload(n,Number(a))}}var p,S;class je extends b{constructor(t){super();m(this,p);o(this,"observerType","workplaceModel");o(this,"isVisible",!1);o(this,"isCrashed",!1);o(this,"data",null);o(this,"startButtonsModel");o(this,"scarfs",[]);o(this,"modal",null);o(this,"flashManager",new Ae);this.startButtonsModel=t}handleUpdate(t){switch(t){case"start":return this.startNewLoading();case"eyeTrackingData":return this.startPrintingFirstChart();case"close-modal":return this.fireCloseModal();case"modal-flash":return this.fireFlashFromModal();case"scarf-flash":return this.fireFlashFromScarf();case"fail":return this.resolveFail();case"redraw":return this.redraw();case"open-scarf-settings-modal":return this.initScarfSettingsModal();case"open-aoi-visibility-modal":return this.initAoiVisibilityModal();case"open-scarf-download-modal":return this.initScarfDownloadModal();case"open-aoi-settings-modal":return this.initAoiSettingsModal();case"open-tobii-upload-modal":return this.initTobiiUploadModal();default:super.handleUpdate(t)}}resolveFail(){this.isCrashed=!0;const t=this.startButtonsModel.failMessage;this.flashManager.addFlashMessage(t!=null?t:"Fatal error","error"),this.notify("fail")}openWorkplaceModal(){const t=new ye(this);new Me(new be(t)),this.modal=t,t.fireOpen()}initScanGraphDownloadModal(){const t=new We(this);new Pe(new Ue(t)),this.modal=t,t.fireOpen()}fireCloseModal(){this.modal instanceof yt&&this.startButtonsModel.fireUploadWithUserInput(this.modal.parsingType),this.modal=null}startNewLoading(){if(this.isCrashed=!1,this.flashManager.addFlashMessage("New workplace started","info"),this.isVisible)return this.notify("reload",[]);this.notify("reveal",[]),this.isVisible=!0}redraw(){this.scarfs.forEach(t=>t.controller.model.redraw())}startPrintingFirstChart(){const t=this.startButtonsModel.eyeTrackingData;t!==null&&(this.data=new ce(t),this.startButtonsModel.eyeTrackingData=null,this.scarfs=[],this.scarfs.push(new me(new ve(new N(this,0)))),this.notify("print",[]),this.scarfs[0].controller.model.isDetached=!1,this.flashManager.addFlashMessage("Scarf chart printed","info"))}fireFlashFromModal(){var e;const t=(e=this.modal)==null?void 0:e.flashMessage;t!=null&&this.flashManager.addFlashMessage(t.message,t.type)}fireFlashFromScarf(){const t=this.scarfs[0].controller.model.flashMessage;t!=null&&this.flashManager.addFlashMessage(t.message,t.type)}initScarfSettingsModal(){const t=c(this,p,S).call(this);if(!(t instanceof N))throw new Error("WorkplaceModel.initScarfSettingsModal() - modal initiator is not a scarf model");const e=new ct(this,t.settings,t.stimulusId,t.scarfId);new Ee(new Te(e)),this.modal=e,e.fireOpen()}initAoiVisibilityModal(){const t=c(this,p,S).call(this);if(!(t instanceof ct))throw new Error("WorkplaceModel.initAoiVisibilityModal() - modal initiator is not a scarf settings modal model");const e=new Oe(this,t.stimulusId,t.scarfSettings);new Ce(new $e(e)),this.modal=e,e.fireOpen()}initScarfDownloadModal(){const t=c(this,p,S).call(this);if(!(t instanceof N))throw new Error("WorkplaceModel.initDownloadScarfModal() - modal initiator is not a scarf model");const e=new De(this,t.stimulusId,t.scarfId);new Le(new ke(e)),this.modal=e,e.fireOpen()}initAoiSettingsModal(){const t=c(this,p,S).call(this);if(!(t instanceof ct)&&!(t instanceof N))throw new Error("WorkplaceModel.initAoiSettingsModal() - modal initiator is not a scarf settings model or scarf");const e=new He(this,t.stimulusId);new Fe(new _e(e)),this.modal=e,e.fireOpen()}initTobiiUploadModal(){const t=new yt(this);new Be(new Ve(t)),this.modal=t,t.fireOpen()}}p=new WeakSet,S=function(){var e,i;const t=((e=this.modal)==null?void 0:e.isRequestingModal)!=null?this.modal:(i=this.scarfs.find(n=>n.controller.model.isRequestingModal))==null?void 0:i.controller.model;if(t==null)throw new Error("WorkplaceModel.#getModalInitiator() - no modal initiator found");return t.isRequestingModal=!1,t};class ze extends M{constructor(t){super();o(this,"controller");o(this,"el");this.controller=t,this.el=this.creatWorkplaceElement(),this.registerEventListeners(this.el,["click"]),this.controller.model.addObserver(this)}creatWorkplaceElement(){var e;const t=document.createElement("section");return t.style.display="none",t.className="anim",t.id="analysis",t.innerHTML=this.createStartingInnerHtml(),(e=document.querySelector("main"))==null||e.insertBefore(t,document.getElementById("about")),t}handleUpdate(t){switch(t){case"reveal":return this.reveal();case"start":return this.addLoader();case"print":return this.print();case"fail":return this.crash()}}reveal(){this.el.style.display=""}addLoader(){const t=document.getElementById("workplace");if(!(t instanceof HTMLElement))throw ReferenceError("");t.innerHTML=this.createLoaderOuterHtml()}print(){const t=this.controller.model.scarfs[0].el,e=document.getElementById("workplace");if(!(e instanceof HTMLElement))throw ReferenceError("");e.innerHTML="",e.append(t)}crash(){const t=document.getElementById("workplace");if(!(t instanceof HTMLElement))throw ReferenceError("");t.innerHTML=this.createCrashOuterHtml()}createStartingInnerHtml(){return`
<h2 class='main-section ana-title'>Your analysis and visualization</h2>
<div class='btnholder left-align main-section'>
    <button id='save-workplace' class='btn4 js-click'>Save workplace</button>
    <button id='save-scan-graph' class='btn4 js-click'>Save ScanGraph file</button>
</div>
<div id='workplace'>
${this.createLoaderOuterHtml()}
</div>`}createLoaderOuterHtml(){return`
<div id='loader-wrap'>
    <div class='bars-7'></div>
    <div>Processing your precious data</div>
</div>
        `}createCrashOuterHtml(){return`
<div id='loader-wrap'>
    <div>Error! Upload different file or try demo</div>
</div>`}}function Xe(){const d=new le,s=new je(d);new de(new oe(d)),d.addObserver(s),new ze(new he(s))}export{Xe as initApp};
