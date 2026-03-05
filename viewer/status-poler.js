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
        await this.tick();
    }

    stop() {
        this.running=false;
        if(this.timer) clearTimeout(this.timer);
    }

    updateSteps(status) {
        const map={
            preparing:0,
            optimizing:1,
            compressing:2,
            lod:3,
            packaging:4
        }
        if(map[status]!==undefined) {
            UltraLoader.step(map[status]);
        }

    }

    async tick() {

        if(!this.running) return;

        try {
            const r=await fetch(`/api/model/status/${this.id}`,{
            cache:"no-store"
        })

        const data=await r.json();

        UltraLoader.set(data.progress);

        updateSteps(data.status);

        if(data.status==="ready") {
            UltraLoader.finish("Model ready");
            this.stop();
            localStorage.removeItem("processing_model_id");
            return;
        }

    }
    catch(e){
        console.warn("poll error",e);
    }

    this.timer=setTimeout(()=>this.tick(),this.interval);

    }

}