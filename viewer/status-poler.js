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
            init:0,
            preparing:1,
            processing:2,
            converted:3,
            rendering:4,
            ready:5,
            failed:6,
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

        this.updateSteps(data.status);

        if(data.status==="ready" || data.status==="failed") {
            if (data.status==="ready")
            UltraLoader.finish("Model ready");
            else
            UltraLoader.finish("Model failed");
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
