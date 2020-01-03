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
        },
        getHeadEpoch: async function () {
            return parseInt((await this.getChainhead()).headEpoch);
        },
    }

    const BLOCKS = {
        SLOT_URL: "/beacon/blocks?slot=",
        EPOCH_URL: "/beacon/blocks?epoch=",
        getBlock: async function (param) {
            return await fetch(`${BASE_URL}${this.SLOT_URL}${param}`)
                .then(response => response.json())
                .then(data => (data.blockContainers.length === 1) ? data.blockContainers[0] : null);
        },
        getBlocksByEpoch: async function(param) {
            return await fetch(`${BASE_URL}${this.EPOCH_URL}${param}`)
                .then(response => response.json())
                .then(data => data.blockContainers);
        },
        getBlocksForPreviousEpochs: async function (headEpoch) {
            const pe1 = headEpoch - 1;
            const pe2 = headEpoch - 2;
            // let prevEpochs = [pe2, pe1, headEpoch];
            let prevEpochs = consecutive(0,15)
            console.log("prevEpochs:                ", prevEpochs);
            
            let blockContainersInPrevEpochs = [];
            console.log("%c                            GETTING BLOCKS FOR PREVIOUS EPOCHS", "color: gray");
            for (const epoch of prevEpochs) {
                // console.log("epoch                  ", epoch);
                let blockContainersInEpoch = await this.getBlocksByEpoch(epoch);
                // console.log("                           ", blockContainersInEpoch);
                blockContainersInEpoch.forEach(blockContainer => {
                    // console.log("                           ", blockContainer.block.slot, "   |   ", base64toHEX(blockContainer.block.parentRoot).substr(2,4), " / ", base64toHEX(blockContainer.blockRoot).substr(2,4), "   |   ", parseInt(blockContainer.block.slot) % 8);
                    // PUSH BLOCK
                    blockContainersInPrevEpochs.push(blockContainer);
                });
            } 
            blockContainersInPrevEpochs.forEach((blockContainer,i) => {
                let currSlot = blockContainersInPrevEpochs[i].block.slot;

                if (currSlot > 0) {
                    // measure different with previous
                    let prevSlot = blockContainersInPrevEpochs[i - 1].block.slot;
                    let difference = currSlot - prevSlot;
                    if (difference > 1) {
                        let counter = parseInt(prevSlot) + 1;
                        do {
                            difference--;
                            console.log(`%c                            ${counter}`, "color: orange");
                            counter++;
                        } while (difference > 1);
                    };
                } 
                console.log("                           ", blockContainer.block.slot, "   |   ", base64toHEX(blockContainer.block.parentRoot).substr(2,4), " / ", base64toHEX(blockContainer.blockRoot).substr(2,4), "   |   ", parseInt(blockContainer.block.slot) % 8);
            })
            
        },
    }

    let status = {
        headBlockRoot: "",
        headSlot: "",
        headEpoch: "",
        previousBlockRoot: "",
        previousSlot: "",
        currentBlock: {},
        gapBlock: {},
        nodes: [],
        edges: []
    }

    // Start
    await getInitial();
    await BLOCKS.getBlocksForPreviousEpochs(status.headEpoch);

    // TODO: render chainhead, epoch, block, etc.

    // Poll for updates
    let poller = setInterval(() => poll(), pollInterval);

    async function getInitial() {

        console.log("=========================== GETTING INITIAL");

        // Get Current Slot
        status.headSlot = await CHAINHEAD.getHeadSlot();
        console.log("%cHead Slot:                 ", "font-weight: bold", status.headSlot);
        
        // Get Current Epoch
        status.headEpoch = await CHAINHEAD.getHeadEpoch();
        console.log("%cHead Epoch:                ", "font-weight: bold", status.headEpoch);

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

    // test functions
    function consecutive(a,b) {
        let arr = [];
        for (b; b >= a; b--) {
            arr.push(b);
        }
        return arr.reverse();
    }
}

init();