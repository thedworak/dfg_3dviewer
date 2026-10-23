import { t } from "./i18n-utils.js";

export const UltraLoader = {

  progress:0,
  bar:null,
  panel:null,
  header:null,
  stepsContainer:null,
  // i18n keys (or plain text) of the steps, translated on every render so a
  // language change also applies to a run already in progress.
  steps:[],
  activeStep:0,
  // Added to the indexes passed to step(): an upload puts a step of its own
  // before the processing steps the status poller counts.
  stepOffset:0,
  // Where set()'s 0-100 starts on the bar (the upload fills what is before).
  progressFrom:0,
  // The active step's own progress, e.g. the bytes of an upload sent so far:
  // { fraction, label } - label is a function, so it is re-translated.
  detailInfo:null,
  hasError:false,
  isFinished:false,
  hideTimer:null,
  resetTimer:null,

  init() {
    if(this.bar) return;

    const loader=document.createElement("div");
    loader.id="ultra-loader";
    loader.innerHTML='<div id="ultra-loader-bar"></div>';

    const panel=document.createElement("div");
    panel.id="ultra-loader-panel";

    const header=document.createElement("div");
    header.id="ultra-loader-header";
    header.textContent=t("processingHeader");
    panel.appendChild(header);

    const stepsContainer=document.createElement("div");
    stepsContainer.id="ultra-loader-steps";
    panel.appendChild(stepsContainer);

    document.body.appendChild(loader);
    document.body.appendChild(panel);

    this.bar=document.getElementById("ultra-loader-bar");
    this.panel=panel;
    this.header=header;
    this.stepsContainer=stepsContainer;
  },

  start(steps, { stepOffset = 0, progressFrom = 0, initialProgress = 5 } = {}) {
    this.init();

    if (this.hideTimer) {
      window.clearTimeout(this.hideTimer);
      this.hideTimer = null;
    }
    if (this.resetTimer) {
      window.clearTimeout(this.resetTimer);
      this.resetTimer = null;
    }

    this.steps=steps;
    this.stepOffset=stepOffset;
    this.progressFrom=progressFrom;
    this.detailInfo=null;
    this.hasError=false;
    this.panel.querySelector("#ultra-loader-error")?.remove();
    this.updateHeader();
    this.progress=initialProgress;
    this.isFinished=false;

    this.bar.style.width = initialProgress+"%";
    this.bar.style.background = "";

    this.renderSteps(0);

    this.panel.classList.add("show");

    this.render();
    },

  set(progress,message) {
    const mapped=this.progressFrom+(Number(progress)||0)*(100-this.progressFrom)/100;
    this.progress=Math.max(this.progress,mapped);
    this.render();
  },

  step(index) {
    this.detailInfo=null;
    this.renderSteps(index+this.stepOffset);
  },

  // Moves on to the next part of a run: later step() and set() calls are
  // shifted by these (see stepOffset, progressFrom).
  phase({ stepOffset = this.stepOffset, progressFrom = this.progressFrom } = {}) {
    this.stepOffset=stepOffset;
    this.progressFrom=progressFrom;
    this.step(0);
  },

  // A small bar and a line under the active step; null removes them.
  detail(fraction, label) {
    this.detailInfo=fraction==null ? null : { fraction, label };
    const row=this.stepsContainer?.querySelector(".ultra-step.active");
    if (!row) return;
    let detail=row.querySelector(".ultra-step-detail");
    if (!this.detailInfo) {
      detail?.remove();
      return;
    }
    if (!detail) {
      detail=document.createElement("div");
      detail.className="ultra-step-detail";
      detail.innerHTML='<div class="ultra-step-detail-bar"><span></span></div><span class="ultra-step-detail-text"></span>';
      row.appendChild(detail);
    }
    const percent=Math.round(Math.min(1,Math.max(0,fraction))*100);
    detail.querySelector(".ultra-step-detail-bar span").style.width=percent+"%";
    const text=typeof label==="function" ? label() : (label || "");
    detail.querySelector(".ultra-step-detail-text").textContent=text;
  },

  // Hides it at once, e.g. when an upload is refused before any processing
  // (the upload panel then says why).
  hide() {
    if (!this.panel) return;
    window.clearTimeout(this.hideTimer);
    window.clearTimeout(this.resetTimer);
    this.hideTimer=null;
    this.resetTimer=null;
    this.isFinished=true;
    this.detailInfo=null;
    this.panel.classList.remove("show");
    this.bar.style.width="0%";
    this.progress=0;
  },

  finish() {
    this.progress=100;
    this.isFinished=true;
    this.detailInfo=null;
    this.render();
    this.renderSteps(this.steps.length);

    this.hideTimer = window.setTimeout(() => {
      if (!this.isFinished) {
        return;
      }

      this.panel.classList.remove("show");
      this.hideTimer = null;

      this.resetTimer = window.setTimeout(() => {
        this.bar.style.width = "0%";
        this.progress = 0;
        this.resetTimer = null;
      }, 1500);
    }, 2500);

  },

  render() {
    this.bar.style.width=this.progress+"%";
  },

  updateHeader() {
    if (this.header) {
      this.header.textContent=t("processingHeader");
    }
  },

  // Re-applies the current language to the header and steps.
  relocalize() {
    if (this.hasError) this.renderErrorSteps();
    else this.renderSteps(this.activeStep);
  },

  renderSteps(active) {
    this.activeStep=active;
    this.updateHeader();
    if (!this.stepsContainer) return;
    this.stepsContainer.replaceChildren();
    this.steps.forEach((s,i)=>{
      const row=document.createElement("div");
      row.className="ultra-step";
      if(i<active) {
        row.classList.add("done");
        row.textContent="✓ "+t(s);
      }
      else if(i===active) {
        row.classList.add("active");
        row.textContent="⏳ "+t(s);
      }
      else {
        row.classList.add("pending");
        row.textContent="□ "+t(s);
      }
      this.stepsContainer.appendChild(row);
    });
    if (this.detailInfo) this.detail(this.detailInfo.fraction, this.detailInfo.label);
  },

  error(message="Processing error") {
    this.isFinished = true;
    this.hasError = true;
    this.renderErrorSteps();
    const error=document.createElement("div");
    error.id="ultra-loader-error";
    error.textContent=`ERROR: ${message}`;
    this.panel.appendChild(error);
    this.bar.style.background="#d93025";
  },

  renderErrorSteps() {
    this.updateHeader();
    if (!this.stepsContainer) return;
    this.stepsContainer.replaceChildren();
    this.steps.forEach((s)=>{
      const row=document.createElement("div");
      row.className="ultra-step error";
      row.textContent="✖ "+t(s);
      this.stepsContainer.appendChild(row);
    });
  }

};

window.UltraLoader=UltraLoader;
