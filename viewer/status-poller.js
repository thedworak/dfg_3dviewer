import { core } from './core.js';

export class StatusPoller {

    constructor(id) {
        this.id=id;
        this.interval=2000;
        this.timer=null;
        this.running=false;
    }

    async start() {
        if(this.running) return;
        this.running=true;
        if (!core.isLocalPreview)
            await this.tick();
        else {
            this.map = core.isLocalPreview
                ? Object.fromEntries(
                    Object.entries(this.fullMap)
                        .slice(-3)      // Only keep the last 2 steps for local preview
                        .map(([k], i) => [k, i])
                    )
                : this.fullMap;
        }
    }

    stop() {
        this.running=false;
        if(this.timer) clearTimeout(this.timer);
    }
    fullMap = {
        init: 0,
        preparing: 1,
        processing: 2,
        converted: 3,
        rendering: 4,
        model_ready: 5,
        viewer_ready: 6,
        failed: 7,
    };

    map = this.fullMap;

    updateSteps(status) {
        if(this.map[status]!==undefined) {
            UltraLoader.step(this.map[status]);
        }

    }

    async tick() {
        if(!this.running || core.isLocalPreview) return;

        try {
            const r=await fetch(`/api/model/status/${this.id}`, {
                cache:"no-store"
            });

            if(!r.ok){
                throw new Error("API error");
            }

            const data=await r.json();

            if(data.status==="error") {
                UltraLoader.error(data.message || "Processing failed");
                this.stop();
                localStorage.removeItem("processing_model_id");
                return;
            }

            UltraLoader.set(data.progress);

            this.updateSteps(data.status);

            if(data.status==="ready" || data.status==="failed") {
                if (data.status==="ready")
                    UltraLoader.finish("3D Viewer is ready");
                else
                    UltraLoader.finish("Failed processing the model");
                this.stop();
                localStorage.removeItem("processing_model_id");
                return;
            }
        }
        catch(e){
            if (!core.isLocalPreview) {
                UltraLoader.error("Connection error");
                this.stop();
            }
        }
        this.timer=setTimeout(()=>this.tick(),this.interval);
    }

}
