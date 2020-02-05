let sampleBlock;

async function getSampleBlock() {
    sampleBlock = await fetch(`block.json`)
        .then(response => response.json())
        .then(data => (data.blockContainers.length === 1) ? data.blockContainers[0] : null);

    console.log(sampleBlock)    
}

getSampleBlock();