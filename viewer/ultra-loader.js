import { t } from "./i18n-utils.js";

export const UltraLoader = {

  progress:0,
  bar:null,
  panel:null,
  header:null,
  stepsContainer:null,
  steps:[],
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

  start(steps) {
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
    this.updateHeader();
    this.progress=5;
    this.isFinished=false;

    this.bar.style.width = "5%";
    this.bar.style.background = "";

    this.renderSteps(0);

    this.panel.classList.add("show");

    this.render();
    },

  set(progress,message) {
    this.progress=Math.max(this.progress,progress);
    this.render();
  },

  step(index) {
    this.renderSteps(index);
  },

  finish() {
    this.progress=100;
    this.isFinished=true;
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

  renderSteps(active) {
    this.updateHeader();
    if (!this.stepsContainer) return;
    this.stepsContainer.replaceChildren();
    this.steps.forEach((s,i)=>{
      const row=document.createElement("div");
      row.className="ultra-step";
      if(i<active) {
        row.classList.add("done");
        row.textContent="✓ "+s;
      }
      else if(i===active) {
        row.classList.add("active");
        row.textContent="⏳ "+s;
      }
      else {
        row.classList.add("pending");
        row.textContent="□ "+s;
      }
      this.stepsContainer.appendChild(row);
    });
  },

  error(message="Processing error") {
    this.isFinished = true;
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
      row.textContent="✖ "+s;
      this.stepsContainer.appendChild(row);
    });
  }

};

window.UltraLoader=UltraLoader;
