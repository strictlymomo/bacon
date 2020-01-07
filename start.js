'use strict';

async function init() {

	/* 	-----------------------------------
		Beacon Chain Config
		----------------------------------- */

	const EPOCHS_AGO = 3; //TODO: scale the visualization extents to handle this number
	const KICKOFF = new Date(new Date().getTime());
	const SLOT_INTERVAL = 12000;
	const ACTIVE_VALIDATOR_SET = 1000;

	/* 	-----------------------------------
		Dummy Prysm Data
		----------------------------------- */
	
	let sampleBlock = await getSampleBlock(217540);

	/* 	-----------------------------------
		create the real time chart
		----------------------------------- */

	let chart = realTimeChartMulti()
		.title("Beacon Chain")
		.xTitle("Time")
		.yTitle("Elements")
		.yDomain([
			"Attestations",
			"Proposer",
			"Blocks",
			"Epochs"
		]) // initial y domain (note array)	
		.border(true)
		.width(900)
		.height(600)
		.backgroundColor("#FFFFFF")
		.maxSeconds(450)
		.headSlotTimeOffset(8 * SLOT_INTERVAL);	// for visualizing beyond the top boundary of an epoch

	// invoke the chart
	let chartDiv = d3.select("#viewDiv").append("div")
		.attr("id", "chartDiv")
		.call(chart);

	// event handler for debug checkbox
	d3.select("#debug").on("change", function () {
		let state = d3.select(this).property("checked")
		chart.debug(state);
	});

	// event handler for halt checkbox
	d3.select("#halt").on("change", function () {
		let state = d3.select(this).property("checked")
		chart.halt(state);
	});

	/* 	-----------------------------------
		Configure the data generator
		----------------------------------- */

	// in a normal use case, real time data would arrive through the network or some other mechanism
	let d = EPOCHS_AGO * -8;
	let timeout = 0;

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
			const SECONDS_AGO = Math.abs(d) * SLOT_INTERVAL;
			const TIMESTAMP = new Date(KICKOFF.getTime() - SECONDS_AGO);
			generateEpoch(d, TIMESTAMP, true);
			generateBlock(d, TIMESTAMP);
		}
	}

	function generateData() {

		setTimeout(function () {

			d++;

			// create timestamp for this category data item
			let now = new Date(new Date().getTime());

			// drive data into the chart at designated slot interval
			timeout = SLOT_INTERVAL;

			generateEpoch(d, now, false);
			generateBlock(d, now);

			// TODO: circle packing ATTESTATIONS

			// do forever
			generateData();

		}, timeout);
	}

	function generateEpoch(d, timestamp, status) {
		if (Math.abs(d) % 8 === 0) {
			let epoch = {
				category: "Epochs",
				time: timestamp,
				label: (Math.round(d / 8)).toString(),
				finalized: status
			};
			chart.datum(epoch);
		}
	}

	function generateBlock(d, timestamp) {
		// random block status
		let seed = Math.random();
		let status;

		if (seed < .1) {
			status = "orphaned";
		} else if (seed < .4) {
			status = "missing";
		} else {
			status = "proposed";
		}

		/*	Example Block
				
			Epoch: 			28285
			Slot: 			226282
			Status:			Proposed
			Time: 			12/12/2019 9:44:26 PM (a few seconds ago)
			Proposed by:	371
			Votes:			[...]
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
		return Math.round(Math.random(0,1) * activeValidatorSet);
	}

	function generateRandomAttestations(status, activeValidatorSet) {
		let committeeSize = 32;
		let maxAttestations = Math.round(activeValidatorSet / committeeSize);
		switch (status) {
			case "orphaned":
				return Math.round(Math.random() * maxAttestations);
			case "missing":
				return 0;
			case "proposed":
				return Math.round(Math.random() * maxAttestations);
		}
	}

} // end init function

init();