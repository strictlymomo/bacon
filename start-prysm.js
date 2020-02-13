'use strict';

/* 	-----------------------------------
	Globals - Beacon Chain Config
	----------------------------------- */
const SLOTS_PER_EPOCH = 32;
const SECONDS_PER_SLOT = 12;
const SLOT_INTERVAL = SECONDS_PER_SLOT * 1000;
const ACTIVE_VALIDATOR_SET = 1000;

let epochsAgo = 4;
let maxSeconds = getMaxSeconds(epochsAgo);
const NETWORK_GENESIS_TIME = "2020-01-10T00:00:00Z";

async function init() {

	/* 	-----------------------------------
		create the real time chart
		----------------------------------- */

	let chart = realTimeChartMulti()
		.xTitle("Time")
		.yDomain([
			"-",
			// "Attestations",
			"Blocks",
			"Epochs",
		])
		.border(false)
		.width(1440)
		.height(450)
		.backgroundColor("transparent")
		.maxSeconds(maxSeconds)
		.headSlotTimeOffset(SLOTS_PER_EPOCH * SLOT_INTERVAL);	// for visualizing beyond the top boundary of an epoch

	// invoke the chart
	let chartDiv = d3.select("#viewDiv").append("div")
		.attr("id", "chartDiv")
		.call(chart);

	/* 	-----------------------------------
		Event Handlers
		----------------------------------- */
	d3.select("#debug").on("change", function () {
		let state = d3.select(this).property("checked");
		chart.debug(state);
	});

	d3.select("#halt").on("change", function () {
		let state = d3.select(this).property("checked");
		chart.halt(state);
	});

	document.body.onkeyup = function (e) {
		pause(e);
	}

	d3.select("#show-roots").on("change", function () {
		let state = d3.select(this).property("checked");
		chart.showRoots(state);
	});

	d3.select("#show-proposers").on("change", function () {
		let state = d3.select(this).property("checked");
		chart.showProposers(state);
	});

	d3.select("#show-attestations").on("change", function () {
		let state = d3.select(this).property("checked");
		chart.showAttestations(state);
	});	

	/* 	-----------------------------------
		Prysm Data
		----------------------------------- */

	// Node API    
	const BASE_URL = "https://api.prylabs.net/eth/v1alpha1";
	const NORMAL_INTERVAL = 12000;
	const SLEEP_INTERVAL = 1000;
	let pollInterval = NORMAL_INTERVAL;

	const CHAINHEAD = {
		URL: "/beacon/chainhead",
		getChainhead: async function () {
			let chainhead = await fetch(`${BASE_URL}${this.URL}`)
				.then(res => res.json())
				.then(d => d);
			return chainhead;
		}
	}

	const VALIDATORS = {
		PARTICIPATION_FOR_EPOCH_URL: "/validators/participation?epoch=",
		getParticipationForEpoch: async function(param) {
			return await fetch(`${BASE_URL}${this.PARTICIPATION_FOR_EPOCH_URL}${param}`)
			.then(res => {
				return (res.status === 200 && res.body) ? res.json() : null;
			});
		}
	}

	const BLOCKS = {
		SLOT_URL: "/beacon/blocks?slot=",
		EPOCH_URL: "/beacon/blocks?epoch=",
		getBlock: async function (param) {
			return await fetch(`${BASE_URL}${this.SLOT_URL}${param}`)
				.then(res => res.json())
				.then(d => (d.blockContainers.length === 1) ? d.blockContainers[0] : null);
		},
		getBlocksByEpoch: async function (param) {
			return await fetch(`${BASE_URL}${this.EPOCH_URL}${param}`)
				.then(res => {
					if (!res.ok) { 
						throw Error(res.statusText);
					}
					return res.json();
				})
				.then(d => d.blockContainers)
				.catch(err => {
					if (err.message.includes("Unexpected end of JSON input")) { 
						console.log("                            gRPC Error: Could not get blocks for epoch");
						return null;
				}
					if (!err.message.includes("Unexpected end of JSON input")) { throw err; }
				})
		},
		getBlocksForPreviousEpochs: async function (headEpoch, finalizedEpoch) {
			let blockContainersInPrevEpochs = [];
			let prevEpochs = enumeratePreviousEpochs(headEpoch, finalizedEpoch - 2);

			console.log("prevEpochs:                ", prevEpochs);
			console.log("%c                            GETTING BLOCKS FOR PREVIOUS EPOCHS", "color: gray");
			console.log("                           ", "Slot", "    | ", "Parent", " / ", "Root", "   |   ", "Mod", "  |  ", "Status", "   |   ", "Epoch");
			
			epochsAgo = prevEpochs.length;
			maxSeconds = getMaxSeconds(epochsAgo);
			// chart.maxSeconds(maxSeconds);

			for (const epoch of prevEpochs) {

				// get epoch participation data
				let pData = await VALIDATORS.getParticipationForEpoch(epoch);
				chart.datum(createEpoch(epoch, pData));
				
				// get blocks in epoch
				let blockContainersInEpoch = await this.getBlocksByEpoch(epoch);

				// got list of blocks
				if (blockContainersInEpoch) {
					
					for (const [i, blockContainer] of blockContainersInEpoch.entries()) {
						let currSlot = blockContainersInEpoch[i].block.block.slot;
	
						if (currSlot > 0 && blockContainersInEpoch[i - 1]) {
							// measure different with previous
							let prevSlot = blockContainersInEpoch[i - 1].block.block.slot;
							let difference = currSlot - prevSlot;
							if (difference > 1) {
								let counter = parseInt(prevSlot) + 1;
								do {
									difference--;
									console.log(`%c                            ${counter}`, "color: orange");
									chart.datum(createMissingBlock(counter));
									counter++;
								} while (difference > 1);
							};
						}
						console.log("                           ", blockContainer.block.block.slot, "   |   ", base64toHEX(blockContainer.block.block.parentRoot).substr(2, 4), " / ", base64toHEX(blockContainer.blockRoot).substr(2, 4), "   |   ", parseInt((blockContainer.block.block.slot) % SLOTS_PER_EPOCH), "   |   ", calculateStatus(blockContainer.block.block.slot), "   |   ", calculateEpoch(blockContainer.block.block.slot));
						chart.datum(createBlock(blockContainer.block.block.slot, blockContainer.blockRoot, blockContainer.block.block.parentRoot));
					}

				} 
				// fallback
				if (blockContainersInEpoch === null) {
					console.log(`%c                            EPOCH ${epoch}: Get blocks manually.`, "color: grey");
					let headSlot = epoch * SLOTS_PER_EPOCH;
					for (let i = headSlot; i < headSlot + SLOTS_PER_EPOCH; i++) {
						let blockContainer = await BLOCKS.getBlock(i);
						blockContainer ? chart.datum(createBlock(blockContainer.block.block.slot, blockContainer.blockRoot, blockContainer.block.block.parentRoot)) : chart.datum(createMissingBlock(i));
					}
				}
			}
		},
	}

	let chainhead = {};

	let store = {
		
		// current - counter used by the poller to track diff between scheduled and head slots
		currentSlot: null,
		currentEpoch: null,

		// scheduled
		scheduledSlot: null,
		scheduledEpoch: null,
		nextEpochTransition: null,

		// head (Node API)
		headBlockRoot: "",
		headSlot: "",
		headEpoch: "",

		// justified (Node API)
		justifiedSlot: "",
		justifiedEpoch: "",
		justifiedBlockRoot: "",

		// finalized (Node API)
		finalizedSlot: "",
		finalizedEpoch: "",
		finalizedBlockRoot: "",

		// stuff that gets mutated
		previousBlockRoot: "",
		previousSlot: "",
		currentBlock: {},
		gapBlock: {},
	}

	// Start
	await getInitial();

	// Poll for updates
	let poller = setInterval(() => poll(), pollInterval);
	let epochPoller = setInterval(() => epochPoll(), SLOTS_PER_EPOCH * SLOT_INTERVAL);

	async function epochPoll() {
		console.log("=========================== EPOCH POLL");
		console.log("%cScheduled Epoch:           ", "font-weight: bold", store.scheduledEpoch);
		console.log("%cNext Epoch:				   ", "font-weight: bold", store.scheduledEpoch);
		chart.datum(createScheduledEpoch(store.scheduledEpoch));
	}
	
	async function getInitial() {

		setStateFromGenesis();
		console.log("%cCurrent Slot | Epoch:      ", "font-weight: bold", store.currentSlot, "|", store.currentEpoch);

		await updateStatusFromChainhead();

		// TO DO: EXCEPTION: if chainhead is less than currentSlot, do something about it.

		// Get Block
		store.currentBlock = await BLOCKS.getBlock(store.headSlot)

		if (store.currentBlock) {
			console.log("%cBlock Root:                ", "font-weight: bold", base64toHEX(store.currentBlock.blockRoot));
		} else {
			console.log("No block");
		}

		await BLOCKS.getBlocksForPreviousEpochs(store.headEpoch, store.finalizedEpoch);
		chart.datum(createScheduledEpoch(store.scheduledEpoch));
		chart.store(store);
		chart.update(store);
		updateStatusTemplate();
	}

	async function getLatest() {

		console.log("===========================");

		let duplicates = checkDuplicateInObject("time", chart.getData().filter(d => d.category === "Blocks"));
		console.log("%cAny Duplicates?           ", "font-weight: bold", duplicates);

		setStateFromGenesis();

		// Update previous
		store.previousSlot = store.headSlot;
		store.previousBlockRoot = store.headBlockRoot;

		// Get Current Chainhead
		await updateStatusFromChainhead();

		console.log("%cPrev Slot:                 ", "font-weight: bold", store.previousSlot);
		console.log("%cHead Slot:                 ", "font-weight: bold", store.headSlot);

		// Compare
		let difference = store.headSlot - store.previousSlot;
		console.log("%cDifference:                ", "font-weight: bold", difference);

		if (difference === 0) {
			console.log("%c                            CLIENT IS NOT UP TO DATE. SLEEP ANOTHER INTERVAL", "color: orange");

			// TODO: SPEED UP THE POLLER TO CHECK FOR NEW SLOT FASTER SO WE DON'T LAG
			return;

		} else if (difference > 1) {
			console.log("%c                            GAP - COULD BE MISSING SLOTS... LET'S CHECK.", "color: red");

			let prev = store.previousSlot;

			do {
				console.log("GET:                       ", (prev + 1));
				store.gapBlock = await BLOCKS.getBlock(prev + 1);

				if (store.gapBlock) {
					console.log("block ?                    ", store.gapBlock);
					console.log("%cBlock Root:                ", "font-weight: bold", base64toHEX(store.gapBlock.blockRoot));
					chart.datum(createBlock(store.gapBlock.block.block.slot, store.currentBlock.blockRoot, store.currentBlock.block.block.parentRoot));
				} else if (store.gapBlock === null){
					// block is missing
					console.log("block ?                    ", store.gapBlock);
					chart.datum(createMissingBlock(prev + 1));
				}

				// Update Statuses
				if ((prev + 1) % SLOTS_PER_EPOCH === 0) {
					await updateStatusFromChainhead();
					console.log("let's update the statuses");
					chart.store(store);
					chart.update(store);
					updateStatusTemplate();
					chart.datum(createScheduledEpoch(store.scheduledEpoch));
				}
				
				difference--;
				prev++;
			} while (difference > 1);

			console.log("%c                            CAUGHT UP - GETTING NEXT BLOCK...", "color: green");

			store.previousBlockRoot = base64toHEX(store.currentBlock.blockRoot);
			console.log("%cPrev  Root:                ", "font-weight: bold", store.previousBlockRoot);

			// Get Block
			store.currentBlock = await BLOCKS.getBlock(store.headSlot);
			if (store.currentBlock) {
				console.log("%cBlock Root:                ", "font-weight: bold", base64toHEX(store.currentBlock.blockRoot));
				chart.datum(createBlock(store.currentBlock.block.block.slot, store.currentBlock.blockRoot, store.currentBlock.block.block.parentRoot));
			} else if (store.currentBlock === null) {
				console.log("No block");
				chart.datum(createMissingBlock(store.headSlot));
			}

			console.log("%cheadSlot:				   ", "font-weight: bold", store.headSlot);

		} else if (difference === 1) {
			console.log("%c                            GOOD - GETTING NEXT BLOCK...", "color: green");

			store.previousBlockRoot = base64toHEX(store.currentBlock.blockRoot);
			console.log("%cPrev  Root:                ", "font-weight: bold", store.previousBlockRoot);

			// Get Block
			store.currentBlock = await BLOCKS.getBlock(store.headSlot);
			if (store.currentBlock) {
				console.log("%cBlock Root:                ", "font-weight: bold", base64toHEX(store.currentBlock.blockRoot));
				chart.datum(createBlock(store.currentBlock.block.block.slot, store.currentBlock.blockRoot, store.currentBlock.block.block.parentRoot));
			} else if (store.currentBlock === null) {
				console.log("No block");
				chart.datum(createMissingBlock(store.headSlot));
			}

			// Update Statuses
			console.log("%cEpoch Transition in:   	   ", "font-weight: bold", store.nextEpochTransition * SLOTS_PER_EPOCH - store.headSlot, "slots ->", store.nextEpochTransition);
			if (store.headSlot % SLOTS_PER_EPOCH === 0) {
				await updateStatusFromChainhead();
				console.log("let's update the statuses");
				chart.store(store);
				chart.update(store);
				updateStatusTemplate();
				chart.datum(createScheduledEpoch(store.scheduledEpoch));
			}
		}

		updateStatusTemplate();
	}

	async function poll() {
		await getLatest();
	}

	async function updateStatusFromChainhead() {
		console.log("=========================== UPDATING STATUS FROM CHAINHEAD");
		
		chainhead = await CHAINHEAD.getChainhead();
		console.log("%cChainhead:                 ", "font-weight: bold", chainhead);

		store.finalizedSlot = parseInt(chainhead.finalizedSlot);
		store.finalizedEpoch = parseInt(chainhead.finalizedEpoch);
		console.log("%cFinalized Slot | Epoch:    ", "font-weight: bold", store.finalizedSlot, "|", store.finalizedEpoch);

		store.justifiedSlot = parseInt(chainhead.justifiedSlot);
		store.justifiedEpoch = parseInt(chainhead.justifiedEpoch);
		console.log("%cJustified Slot | Epoch:    ", "font-weight: bold", store.justifiedSlot, "|", store.justifiedEpoch);

		store.headSlot = parseInt(chainhead.headSlot);
		store.headEpoch = parseInt(chainhead.headEpoch);
		console.log("%cHead Slot | Epoch:         ", "font-weight: bold", store.headSlot, "|", store.headEpoch);

		store.nextEpochTransition = store.headEpoch + 1;
		console.log("%cEpoch Transition in:   	   ", "font-weight: bold", store.nextEpochTransition * SLOTS_PER_EPOCH - store.headSlot, "slots ->", store.nextEpochTransition);
	}

	function createBlock(slot, blockRoot, parentRoot) {
		return {
			category: "Blocks",
			epoch: calculateEpoch(slot),
			slot: parseInt(slot),
			status: calculateStatus(slot),
			time: calculateTime(slot),
			blockRoot: base64toHEX(blockRoot),
			parentRoot: base64toHEX(parentRoot)
		}
	}

	function createMissingBlock(slot) {
		return {
			category: "Blocks",
			epoch: calculateEpoch(slot),
			slot: slot,
			status: "missed",
			time: calculateTime(slot),
			blockRoot: null,
			parentRoot: null
		}
	}

	function createEpoch(epoch, pData) {
		let ep = {
			category: "Epochs",
			time: calculateTimeFromEpoch(epoch),
			label: epoch,
			status: "",
			participation: {
				globalParticipationRate: 0,
				votedEther: 0,
				eligibleEther: 1 // hack
			}
		}

		if (pData) {
			ep.participation.globalParticipationRate = pData.participation.globalParticipationRate;
			ep.participation.votedEther = parseInt(pData.participation.votedEther);
			ep.participation.eligibleEther = parseInt(pData.participation.eligibleEther);
		}

		return ep;
	}

	function createScheduledEpoch(epoch) {	
		return {
			category: "Epochs",
			time: calculateTimeFromEpoch(epoch),
			label: epoch,
			status: "scheduled",
			participation: {
				globalParticipationRate: 0,
				votedEther: 0,
				eligibleEther: 1 // hack
			}
		};
	}

	function setStateFromGenesis() {
		let now = Math.floor((new Date()).getTime() / 1000);
		let genesis = Math.floor(new Date(NETWORK_GENESIS_TIME).getTime() / 1000);

		store.currentSlot = Math.floor((now - genesis) / 12);
		store.currentEpoch = Math.floor(store.currentSlot / 32);

		store.scheduledSlot = Math.floor((now - genesis) / 12);
		store.scheduledEpoch = store.currentEpoch + 1;
	}

	function calculateEpoch(slot) {
		return Math.floor(slot / 32)
	}

	function calculateTimeFromEpoch(epoch) {
		return new Date(new Date(NETWORK_GENESIS_TIME).getTime() + (epoch * SLOTS_PER_EPOCH * SECONDS_PER_SLOT * 1000));
	}

	function calculateStatus(s) {
		let slot = parseInt(s);
		let slotStatus;
		if (slot <= store.finalizedSlot) {
			slotStatus = "finalized";
		}
		else if (slot > store.finalizedSlot && slot <= store.justifiedSlot) {
			slotStatus = "justified";
		}
		else {
			slotStatus = "proposed";
		}
		return slotStatus;
	}

	function formatTime(t) {
		if (t < 0) t = 0;
		if (t > 12) t = 12;

		t += "";

		if (t.indexOf(".") === -1) t += ".0";

		t += "s";

		return t
	}

	function consecutive(a, b) {
		let arr = [];
		for (b; b >= a; b--) {
			arr.push(b);
		}
		return arr.reverse();
	}

	function pause(e) {
		if (e.keyCode == 32) {
			let state = d3.select("#halt").property("checked");
			if (state === false) {
				d3.select("#halt").property("checked", true);
				state = true;
			} else {
				d3.select("#halt").property("checked", false);
				state = false;
			}
			chart.halt(state);
		}
	}

	function updateStatusTemplate() {
		let data = [store];
		d3.selectAll("#scheduled-slot").data(data).text(d => d.scheduledSlot);
		d3.selectAll("#scheduled-epoch").data(data).text(d => d.scheduledEpoch);
		d3.selectAll("#head-slot").data(data).text(d => d.headSlot);
		d3.selectAll("#head-epoch").data(data).text(d => d.headEpoch);
		d3.selectAll("#head-delta").data(data).text(d => calculateEpochDelta(d.currentEpoch, d.headEpoch, "head"));
		d3.selectAll("#justified-slot").data(data).text(d => d.justifiedSlot);
		d3.selectAll("#justified-epoch").data(data).text(d => d.justifiedEpoch);
		d3.selectAll("#justified-delta").data(data).text(d => calculateEpochDelta(d.currentEpoch, d.justifiedEpoch, "justified"));
		d3.selectAll("#finalized-slot").data(data).text(d => d.finalizedSlot);
		d3.selectAll("#finalized-epoch").data(data).text(d => d.finalizedEpoch);
		d3.selectAll("#finalized-delta").data(data).text(d => calculateEpochDelta(d.currentEpoch, d.finalizedEpoch, "finalized"));
		d3.selectAll("#transition-countdown-slot").data(data).text(d => d.scheduledEpoch * SLOTS_PER_EPOCH - d.scheduledSlot);
	}

	function calculateEpochDelta(cur, val, type) {
		let msg = "in sync";
		let delta = cur - val;
		switch (type) {
			case "head":
				if (delta > 1) msg = `${delta} epochs behind`;
				break;
			case "justified":
				if (delta > 2) msg = `${delta} checkpoints behind`;
				break;
			case "finalized":
				if (delta > 3) msg = `${delta} checkpoints behind`;
				break;
			default:
				break;	
		}
		return msg;
	}

	function enumeratePreviousEpochs(max, min) {
		return Array.apply(null, {length: max + 1}).map(Number.call, Number).slice(min);
	}

} // end init function

init();

/* 	-----------------------------------
	Global Methods
	----------------------------------- */

function base64toHEX(base64) {
	let raw = atob(base64);
	let hex = "0x";
	for (let i = 0; i < raw.length; i++) {
		let _hex = raw.charCodeAt(i).toString(16)
		hex += (_hex.length == 2 ? _hex : "0" + _hex);
	}
	return hex;
}

function getMaxSeconds(epochsAgo) {
	return (epochsAgo * SLOTS_PER_EPOCH * SECONDS_PER_SLOT) + (1 * SLOTS_PER_EPOCH * SECONDS_PER_SLOT);
}

function calculateTime(slot) {
	return new Date(new Date(NETWORK_GENESIS_TIME).getTime() + (slot * SECONDS_PER_SLOT * 1000))
}

function checkDuplicateInObject(propertyName, inputArray) {
	let seenDuplicate = false,
		testObject = {};
  
	inputArray.map(item => {
	  let itemPropertyName = item[propertyName];    
	  if (itemPropertyName in testObject) {
		testObject[itemPropertyName].duplicate = true;
		item.duplicate = true;
		seenDuplicate = true;
	  }
	  else {
		testObject[itemPropertyName] = item;
		delete item.duplicate;
	  }
	});
  
	return seenDuplicate;
}