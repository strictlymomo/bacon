'use strict';

/* 	-----------------------------------
	Globals - Beacon Chain Config
	----------------------------------- */
const EPOCHS_AGO = 6;
const SLOTS_PER_EPOCH = 32;
const SECONDS_PER_SLOT = 12;
const SLOT_INTERVAL = SECONDS_PER_SLOT * 1000;
let maxSeconds = (EPOCHS_AGO * SLOTS_PER_EPOCH * SECONDS_PER_SLOT) + (1 * SLOTS_PER_EPOCH * SECONDS_PER_SLOT);
const ACTIVE_VALIDATOR_SET = 1000;

async function init() {

	/* 	-----------------------------------
		create the real time chart
		----------------------------------- */

	let chart = realTimeChartMulti()
		.title("Beacon Chain")
		.xTitle("Time")
		.yDomain([
			"_",
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

	const NETWORK_GENESIS_TIME = "2020-01-10T00:00:00Z";
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
				.then(d => d);
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
				.then(d => (d.blockContainers.length === 1) ? d.blockContainers[0] : null);
		},
		getBlocksByEpoch: async function (param) {
			return await fetch(`${BASE_URL}${this.EPOCH_URL}${param}`)
				.then(response => response.json())
				.then(d => d.blockContainers);
		},
		getBlocksForPreviousEpochs: async function (headEpoch) {
			let blockContainersInPrevEpochs = [];
			const pe1 = headEpoch - 1;
			const pe2 = headEpoch - 2;
			const pe3 = headEpoch - 3;
			let prevEpochs = [pe3, pe2, pe1, headEpoch];

			for (const epoch of prevEpochs) {

				let blockContainersInEpoch = await this.getBlocksByEpoch(epoch);
				chart.datum(createEpoch(epoch));

				blockContainersInEpoch.forEach((blockContainer, i) => {
					let currSlot = blockContainersInEpoch[i].block.block.slot;

					if (currSlot > 0 && blockContainersInEpoch[i - 1]) {
						// measure different with previous
						let prevSlot = blockContainersInEpoch[i - 1].block.block.slot;
						let difference = currSlot - prevSlot;
						if (difference > 1) {
							let counter = parseInt(prevSlot) + 1;
							do {
								difference--;
								chart.datum(createMissingBlock(counter));
								counter++;
							} while (difference > 1);
						};
					}
					chart.datum(createBlock(blockContainer.block.block.slot));
				})
			}
		},
	}

	let chainhead = {};

	let store = {
		// scheduled
		scheduledSlot: null,
		scheduledEpoch: null,
		nextEpochTransition: null,

		// head (Prysm API)
		headBlockRoot: "",
		headSlot: "",
		headEpoch: "",

		// justified (Prysm API)
		justifiedSlot: "",
		justifiedEpoch: "",
		justifiedBlockRoot: "",

		// finalized (Prysm API)
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
		store.scheduledEpoch = store.scheduledEpoch + 1;
		chart.datum(createScheduledEpoch(store.scheduledEpoch));
	}
	
	async function updateStatusFromChainhead() {
		chainhead = await CHAINHEAD.getChainhead();

		store.finalizedSlot = parseInt(chainhead.finalizedSlot);
		store.finalizedEpoch = parseInt(chainhead.finalizedEpoch);

		store.justifiedSlot = parseInt(chainhead.justifiedSlot);
		store.justifiedEpoch = parseInt(chainhead.justifiedEpoch);

		store.headSlot = parseInt(chainhead.headSlot);
		store.headEpoch = parseInt(chainhead.headEpoch);

		store.nextEpochTransition = store.headEpoch + 1;
	}

	async function getInitial() {

		setScheduledState();

		await updateStatusFromChainhead();

		// TO DO: EXCEPTION: if chainhead is less than currentSlot, do something about it.

		// Get Block
		store.currentBlock = await BLOCKS.getBlock(store.headSlot)

		await BLOCKS.getBlocksForPreviousEpochs(store.headEpoch);

		store.scheduledEpoch = store.scheduledEpoch + 1;
		chart.datum(createScheduledEpoch(store.scheduledEpoch));

		chart.update(store);
	}

	async function getLatest() {

		// Update previous
		store.previousSlot = store.headSlot;
		store.previousBlockRoot = store.headBlockRoot;

		// Get Current Slot
		store.headSlot = await CHAINHEAD.getHeadSlot();

		// Compare
		let difference = store.headSlot - store.previousSlot;

		if (difference === 0) {
			// TODO: SPEED UP THE POLLER TO CHECK FOR NEW SLOT FASTER SO WE DON'T LAG
			return;

		} else if (difference > 1) {

			let prev = store.previousSlot;

			do {
				store.gapBlock = await BLOCKS.getBlock(prev + 1);

				if (store.gapBlock) {
					chart.datum(createBlock(store.gapBlock.block.block.slot));
				} else if (store.gapBlock === null){
					// block is missing
					chart.datum(createMissingBlock(prev + 1));
				}

				// Update Statuses
				if ((prev + 1) % SLOTS_PER_EPOCH === 0) {
					await updateStatusFromChainhead();
					chart.update(store);
					store.scheduledEpoch = store.scheduledEpoch + 1;
					chart.datum(createScheduledEpoch(store.scheduledEpoch));
				}
				
				difference--;
				prev++;
			} while (difference > 1);

			store.previousBlockRoot = base64toHEX(store.currentBlock.blockRoot);

			// Get Block
			store.currentBlock = await BLOCKS.getBlock(store.headSlot);
			if (store.currentBlock) {
				chart.datum(createBlock(store.currentBlock.block.block.slot));
			} else if (store.currentBlock === null) {
				chart.datum(createMissingBlock(store.headSlot));
			}

		} else if (difference === 1) {

			store.previousBlockRoot = base64toHEX(store.currentBlock.blockRoot);

			// Get Block
			store.currentBlock = await BLOCKS.getBlock(store.headSlot);
			if (store.currentBlock) {
				chart.datum(createBlock(store.currentBlock.block.block.slot));
			} else if (store.currentBlock === null) {
				chart.datum(createMissingBlock(store.headSlot));
			}

			// Update Statuses
			if (store.headSlot % SLOTS_PER_EPOCH === 0) {
				await updateStatusFromChainhead();
				chart.update(store);
				store.scheduledEpoch = store.scheduledEpoch + 1;
				chart.datum(createScheduledEpoch(store.scheduledEpoch));
			}
		}
	}

	async function poll() {
		await getLatest();
	}

	function createBlock(slot) {
		return {
			category: "Blocks",
			epoch: calculateEpoch(slot),
			slot: parseInt(slot),
			status: calculateStatus(slot),
			time: calculateTime(slot),
		}
	}

	function createMissingBlock(slot) {
		return {
			category: "Blocks",
			epoch: calculateEpoch(slot),
			slot: slot,
			status: "missed",
			time: calculateTime(slot),
		}
	}

	function createEpoch(epoch) {
		return {
			category: "Epochs",
			time: calculateTimeFromEpoch(epoch),
			label: epoch,
			status: ""
		};
	}

	function createScheduledEpoch(epoch) {
		return {
			category: "Epochs",
			time: calculateTimeFromEpoch(epoch),
			label: epoch,
			status: "scheduled"
		};
	}

	function setScheduledState() {
		let now = Math.floor((new Date()).getTime() / 1000);
		let genesis = Math.floor(new Date(NETWORK_GENESIS_TIME).getTime() / 1000);

		store.scheduledSlot = Math.floor((now - genesis) / 12);
		store.scheduledEpoch = Math.floor(store.scheduledSlot / 32);
	}

	function calculateTime(slot) {
		return new Date(new Date(NETWORK_GENESIS_TIME).getTime() + (slot * SECONDS_PER_SLOT * 1000))
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