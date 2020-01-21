'use strict';

/* 	-----------------------------------
	Globals - Beacon Chain Config
	----------------------------------- */
const EPOCHS_AGO = 8;
const SLOTS_PER_EPOCH = 32;
const SECONDS_PER_SLOT = 12;
const SLOT_INTERVAL = SECONDS_PER_SLOT * 1000;
let maxSeconds = (EPOCHS_AGO * SLOTS_PER_EPOCH * SECONDS_PER_SLOT) + (1 * SLOTS_PER_EPOCH * SECONDS_PER_SLOT);
const ACTIVE_VALIDATOR_SET = 1000;

async function init() {

	/* 	-----------------------------------
		Dummy Prysm Data
		----------------------------------- */

	let sampleBlock = await getSampleBlock(217540);

	/* 	-----------------------------------
		create the real time chart
		----------------------------------- */

	const KICKOFF = new Date(new Date().getTime());

	let chart = realTimeChartMulti()
		.title("Beacon Chain")
		.xTitle("Time")
		// .yTitle("Elements")
		.yDomain([
			"_",
			// "Attestations",
			"Blocks",
			"Epochs",
		]) // initial y domain (note array)	
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
		Configure the data generator
		----------------------------------- */

	// in a normal use case, real time data would arrive through the network or some other mechanism
	let d = EPOCHS_AGO * -SLOTS_PER_EPOCH,
		timeout = 0;

	/* prepend recent chain data prior to the current head slot */
	generatePrevData(d);

	// start the data generator
	d = -1;	// reset d to kickoff poller
	generateData();


	/* 	------------------------------------------------------------------------------------
		HELPERS
		------------------------------------------------------------------------------------ */

	function generatePrevData(d) {
		for (d; d <= -1; d++) {
			const msAgo = Math.abs(d) * SLOT_INTERVAL,
				timestamp = new Date(KICKOFF.getTime() - msAgo);
			generateEpochPrev(d, timestamp, msAgo);
			generateBlock(d, timestamp);
		}
	}

	function generateData() {

		setTimeout(function () {

			d++;

			// create timestamp for this category data item
			let now = new Date(new Date().getTime());

			// drive data into the chart at designated slot interval
			timeout = SLOT_INTERVAL;

			generateEpoch(d, now);
			generateBlock(d, now);

			// do forever
			generateData();

		}, timeout);
	}

	function generateEpochPrev(d, timestamp, timeElapsed) {
		if (Math.abs(d) % SLOTS_PER_EPOCH === 0) {
			let epoch = {
				category: "Epochs",
				time: timestamp,
				label: (Math.round(d / SLOTS_PER_EPOCH)).toString(),
				status: checkEpochStatusPrev(timeElapsed)
			};
			chart.datum(epoch);
		}
	}

	function generateEpoch(d, timestamp) {

		if (Math.abs(d) % SLOTS_PER_EPOCH === 0) {
			let epoch = {
				category: "Epochs",
				time: timestamp,
				label: (Math.round(d / SLOTS_PER_EPOCH)).toString(),
				status: "pending"
			};
			chart.datum(epoch);
		}
	}

	function generateBlock(d, timestamp) {
		// random block status
		let seed = Math.random(),
			status;

		if (seed < .1) {
			status = "orphaned";
		} else if (seed < .4) {
			status = "missing";
		} else {
			status = "proposed";
		}

		/*	Example Block
				
			epoch: 			27191
			slot: 			271540
			status:			Proposed
			time: 			12/12/2019 9:44:26 PM (a few seconds ago)
			proposed by:	371
			votes:			[
								{
									...
									data: {
										slot: "217538",
										beaconBlockRoot: "T61j0FpyjexOfeClkmtQh8ZsiFCAQMlpKPpUkg2DMCc=",
										source: {
											epoch: "27191",
											root: "3uYV3BCjy+uVFTSrwN57Ew9i2DOeplhE5tbjYV4leTg="
										},
										target: {
											epoch: "27192",
											root: "+LWF76f3c8PF1xaMV/Zh9r1Q19Od/huAX3L6w7R07aY="
										}
										...
									},
									...
								},
								{
									...
									data: {
										slot: "217538",
										...
									}	
									...
								},
								{
									...
									data: {
										slot: "217539",
										...
									},
									...
								},
								{
									...
									data: {
										slot: "217539",
									},
									...
								},
                    		],
		*/

		let block = {
			category: "Blocks",
			size: 24,
			// epoch: getAssociatedEpoch();
			slot: d.toString(),
			time: timestamp,
			status: status,
			proposedBy: generateRandomValidator(ACTIVE_VALIDATOR_SET),
			votes: generateRandomAttestations(status, ACTIVE_VALIDATOR_SET),
		};

		chart.datum(block);
	}

	async function getSampleBlock(slot) {
		return await fetch(`data/block_${slot}.json`)
			.then(response => response.json())
			.then(data => (data.blockContainers.length === 1) ? data.blockContainers[0] : null);
	}

	function generateRandomValidator(activeValidatorSet) {
		return Math.round(Math.random(0, 1) * activeValidatorSet);
	}

	function generateRandomAttestations(status, activeValidatorSet) {
		let committeeSize = 32,
			maxAttestations = Math.round(activeValidatorSet / committeeSize);
		switch (status) {
			case "proposed": case "orphaned":
				return Math.round(Math.random() * maxAttestations);
			case "missing":
				return 0;
			default:
		}
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

function checkEpochStatusPrev(timeElapsed) {
	let status;

	// current epoch or 1 epoch ago
	if (timeElapsed <= SECONDS_PER_SLOT * SLOTS_PER_EPOCH * 1000 * 2) {
		status = "pending";
	}
	// 2 epochs ago
	else if (timeElapsed <= SECONDS_PER_SLOT * SLOTS_PER_EPOCH * 3 * 1000 &&
		timeElapsed >= SECONDS_PER_SLOT * SLOTS_PER_EPOCH * 2 * 1000) {
		status = "justified";
	}
	// 3+ epochs ago 
	else {
		status = "finalized";
	}

	return status;
}

function checkEpochStatus(time) {
	const timeElapsed = new Date().getTime() - time.getTime();

	let status;

	// current epoch or 1 epoch ago
	if (timeElapsed <= SECONDS_PER_SLOT * SLOTS_PER_EPOCH * 1000 * 2) {
		status = "pending";
	}
	// 2 epochs ago
	else if (timeElapsed <= SECONDS_PER_SLOT * SLOTS_PER_EPOCH * 3 * 1000 &&
		timeElapsed >= SECONDS_PER_SLOT * SLOTS_PER_EPOCH * 2 * 1000) {
		status = "justified";
	}
	// 3+ epochs ago 
	else {
		status = "finalized";
	}

	return status;
}