export const UltraLoader = {

  progress:0,
  bar:null,
  panel:null,
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

    document.body.appendChild(loader);
    document.body.appendChild(panel);

    this.bar=document.getElementById("ultra-loader-bar");
    this.panel=panel;
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

  renderSteps(active) {
    this.panel.innerHTML="";
    this.steps.forEach((s,i)=>{
      const row=document.createElement("div");
      row.className="ultra-step";
      if(i<active) {
        row.classList.add("done");
        row.innerHTML="✓ "+s;
      }
      else if(i===active) {
        row.classList.add("active");
        row.innerHTML="⏳ "+s;
      }
      else {
        row.classList.add("pending");
        row.innerHTML="□ "+s;
      }
      this.panel.appendChild(row);
    });
  },

  error(message="Processing error") {
    this.isFinished = true;
    this.renderErrorSteps();
    this.panel.innerHTML += `
      <div id="ultra-loader-error">
      ERROR: ${message}
      </div>`;
    this.bar.style.background="#d93025";
  },

  renderErrorSteps() {
    this.panel.innerHTML="";
    this.steps.forEach((s)=>{
      const row=document.createElement("div");
      row.className="ultra-step error";
      row.innerHTML="✖ "+s;
      this.panel.appendChild(row);
    });
  }

};

window.UltraLoader=UltraLoader;
