async function init() {
    // Prysm API
    const BASE_URL = "https://api.prylabs.net/eth/v1alpha1";
    const NORMAL_INTERVAL = 12000;
    const SLEEP_INTERVAL = 1000;
    let pollInterval = NORMAL_INTERVAL;

    const CHAINHEAD = {
        URL: "/beacon/chainhead",
        getChainhead: async function () {
            let chainhead = await fetch(`${BASE_URL}${this.URL}`)
                .then(response => response.json())
                .then(data => data);
            return chainhead;
        },
        getHeadSlot: async function () {
            return parseInt((await this.getChainhead()).headSlot);
        }
    }

    const BLOCKS = {
        URL: "/beacon/blocks?slot=",
        getBlock: async function (param) {
            return await fetch(`${BASE_URL}${this.URL}${param}`)
                .then(response => response.json())
                .then(data => (data.blockContainers.length === 1) ? data.blockContainers[0] : null);
        },
    }

    let status = {
        headBlockRoot: "",
        headSlot: "",
        previousBlockRoot: "",
        previousSlot: "",
        currentBlock: {},
        gapBlock: {},
        nodes: [],
        edges: []
    }

    // Start
    await getInitial();

    // TODO: render chainhead, epoch, block, etc.

    // Poll for updates
    let poller = setInterval(() => poll(), pollInterval);

    async function getInitial() {

        console.log("=========================== GETTING INITIAL");

        // Get Current Slot
        status.headSlot = await CHAINHEAD.getHeadSlot();
        console.log("%cHead Slot:                 ", "font-weight: bold", status.headSlot);

        // Get Block
        status.currentBlock = await BLOCKS.getBlock(status.headSlot);
        
        if (status.currentBlock) {
            console.log("%cBlock Root:                ", "font-weight: bold", base64toHEX(status.currentBlock.blockRoot));
        } else {
            console.log("No block");
            do {
                let keepGetting = setInterval(() => getInitial(), pollInterval);
                console.log("getting...");
            } while (status.currentBlock === null);
            clearInterval(keepGetting);
            console.log("%cBlock Root:                ", "font-weight: bold", base64toHEX(status.currentBlock.blockRoot));
        }

        // TODO: Push to nodes/edges
    }

    async function getLatest() {

        console.log("===========================");

        // Update previous
        status.previousSlot = status.headSlot;
        status.previousBlockRoot = status.headBlockRoot;

        // Get Current Slot
        status.headSlot = await CHAINHEAD.getHeadSlot();

        console.log("%cPrev Slot:                 ", "font-weight: bold", status.previousSlot);
        console.log("%cHead Slot:                 ", "font-weight: bold", status.headSlot);
        
        // Compare
        let difference = status.headSlot - status.previousSlot;
        console.log("%cDifference:                ", "font-weight: bold", difference);
        
        if (difference === 0) {
            console.log("%c                            CLIENT IS NOT UP TO DATE. SLEEP ANOTHER INTERVAL", "color: orange");
            
            // TODO: SPEED UP THE POLLER TO CHECK FOR NEW SLOT FASTER SO WE DON'T LAG

        } else if (difference > 1) {
            console.log("%c                            GAP - COULD BE MISSING SLOTS... LET'S CHECK.", "color: red");
            
            let prev = status.previousSlot;

            do {
                console.log("GET:                       ", (prev + 1));
                status.gapBlock = await BLOCKS.getBlock(prev + 1);

                if (status.gapBlock) {
                    console.log("block ?                    ", status.gapBlock);
                    console.log("%cBlock Root:                ", "font-weight: bold", base64toHEX(status.gapBlock.blockRoot));
                    // TO DO: push gapBlock to nodes
                } else {
                    console.log("block ?                    ", status.gapBlock);
                    // block is missing
                    // TO DO: missing block object to nodes
                }
                difference--;
                prev++;
            } while (difference > 1);

            console.log("%c                            CAUGHT UP - GETTING NEXT BLOCK...", "color: green");
            
            status.previousBlockRoot = base64toHEX(status.currentBlock.blockRoot);
            console.log("%cPrev  Root:                ", "font-weight: bold", status.previousBlockRoot);
            
            // Get Block
            status.currentBlock = await BLOCKS.getBlock(status.headSlot);
            if (status.currentBlock) {
                console.log("%cBlock Root:                ", "font-weight: bold", base64toHEX(status.currentBlock.blockRoot));
            } else if (status.currentBlock === null) {
                console.log("No block");
            }

        } else if (difference === 1) {
            console.log("%c                            GOOD - GETTING NEXT BLOCK...", "color: green");
            
            status.previousBlockRoot = base64toHEX(status.currentBlock.blockRoot);
            console.log("%cPrev  Root:                ", "font-weight: bold", status.previousBlockRoot);
            
            // Get Block
            status.currentBlock = await BLOCKS.getBlock(status.headSlot);
            if (status.currentBlock) {
                console.log("%cBlock Root:                ", "font-weight: bold", base64toHEX(status.currentBlock.blockRoot));
                // TO DO: push block to nodes
            } else if (status.currentBlock === null) {
                console.log("No block");
                // TO DO: push missing to nodes
            }
        } 
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