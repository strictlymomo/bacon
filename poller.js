async function init() {
    // Prysm API
    const BASE_URL = "https://api.prylabs.net/eth/v1alpha1";
    const POLL_INVERTAL = 12000;

    const CHAINHEAD = {
        URL: "/beacon/chainhead",
        getChainhead: async function () {
            let chainhead = await fetch(`${BASE_URL}${this.URL}`)
                .then(response => response.json())
                .then(data => data);
            return chainhead;    
        },
        getHeadBlockRoot: async function () {
            return base64toHEX((await this.getChainhead()).headBlockRoot);
        },
        getHeadSlot: async function () {
            return (await this.getChainhead()).headSlot;
        }
    }

    const BLOCKS = {
        URL: "/beacon/blocks?slot=",
        getBlock: async function (param) {
            return await fetch(`${BASE_URL}${this.URL}${param}`)
                .then(response => response.json())
                .then(data => (data.blockContainers.length === 1) ? data.blockContainers[0] : data.blockContainers);
        }
    }

    let status = {
        headBlockRoot: "",
        headSlot: "",
        previous_headBlockRoot: "",
        previous_headSlot: "",
        currentBlock: {},
        currentBlocks: [],
        nodes: [],
        edges: []
    }

    // Start
    await getInitial();
    
    // TODO: render chainhead, epoch, block, etc.
    
    // Poll for updates
    setInterval(() => poll(), POLL_INVERTAL);

    async function getInitial() {
        
        console.log("GETTING INITIAL ==============================");
        
        // Get Blockroot from Chainhead 
        status.headSlot = await CHAINHEAD.getHeadSlot();
        status.headBlockRoot = await CHAINHEAD.getHeadBlockRoot();
        console.log("%cHead Slot:                 ", "font-weight: bold", status.headSlot);
        console.log("%cHead Block Root:           ", "font-weight: bold", status.headBlockRoot);
            
        // Get Block(s) ?
        status.currentBlock = await BLOCKS.getBlock(status.headSlot);
        
        // Push to nodes/edges
        status.nodes.push({"id": base64toHEX(status.currentBlock.blockRoot), "group": "Proposed"});
        // console.log("nodes:", status.nodes);
    }

    async function getLatest() {
        
        console.log("==============================");
        
        // Update previous
        status.previous_headBlockRoot = status.headBlockRoot;
        status.previous_headSlot = status.headSlot;
        
        // Get Blockroot from Chainhead 
        status.headSlot = await CHAINHEAD.getHeadSlot();
        console.log("%cprevious:                  ", "font-weight: bold", status.previous_headSlot);
        console.log("%cHead Slot:                 ", "font-weight: bold", status.headSlot);
        status.headBlockRoot = await CHAINHEAD.getHeadBlockRoot();
        console.log("%cprevious:                  ", "font-weight: bold", status.previous_headBlockRoot);
        console.log("%cHead Block Root:           ", "font-weight: bold", status.headBlockRoot);
        
        // Get Block(s) ?
        status.currentBlock = await BLOCKS.getBlock(status.headSlot);

        // CONDITIONALS
        /*
        Slot === consecutive
        
        Slot !== consecutive

        */
        if (status.previous_headBlockRoot === status.headBlockRoot) {
            console.log("%cCLIENT IS NOT UP TO DATE. SLEEP ANOTHER INVERVAL", "color: red");
            // console.log("%cSAME BLOCK AS BEFORE. PUT INTO MISSING", "color: red");
            // status.nodes.push({"id": base64toHEX(status.currentBlock.blockRoot), "group": "Missing"});
            // console.log("nodes:", status.nodes);
        } else {

        }
        // Conditionals
        // console.log("current block:", status.currentBlock);
        // console.log("current block:", status.currentBlock.block);
        // console.log("current blockRoot:", base64toHEX(status.currentBlock.blockRoot));
    }

    async function poll() {
        await getLatest();
        // TODO: render chainhead, epoch, block, etc.
    }

    function base64toHEX(base64) {
        let raw = atob(base64);
        let hex = "0x";
        for (i = 0; i < raw.length; i++) {
            let _hex = raw.charCodeAt(i).toString(16)
            hex += (_hex.length == 2 ? _hex : "0" + _hex);
        }
        return hex;
    }

}

init();