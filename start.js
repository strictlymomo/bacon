'use strict';

async function initialize() {

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
		.yTitle("Categories")
		.yDomain([
			"Epochs",
			"Blocks",
			// "Attestations"
		]) // initial y domain (note array)
		.border(true)
		.width(900)
		.height(600)
		.backgroundColor("#FFFFFF");

	// invoke the chart
	let chartDiv = d3.select("#viewDiv").append("div")
		.attr("id", "chartDiv")
		.call(chart);

	// event handler for debug checkbox
	d3.select("#debug").on("change", function () {
		let state = d3.select(this).property("checked")
		chart.debug(state);
	})

	// event handler for halt checkbox
	d3.select("#halt").on("change", function () {
		let state = d3.select(this).property("checked")
		chart.halt(state);
	})

	/* 	-----------------------------------
		Configure the data generator
		----------------------------------- */

	// in a normal use case, real time data would arrive through the network or some other mechanism

	const EPOCHS_AGO = 3; //TODO: scale the visualization extents to handle this number
	const KICKOFF = new Date(new Date().getTime());
	const SLOT_INTERVAL = 12000;

	let d = EPOCHS_AGO * -8;
	let timeout = 0;

	/* prepend recent chain data prior to the current head slot */
	generatePrevData(d);

	// start the data generator
	d = -1;	//reset d to kickoff poller
	generateData();


	/* 	------------------------------------------------------------------------------------
		HELPERS
		------------------------------------------------------------------------------------ */

	function generatePrevData(d) {
		for (d; d <= -1; d++) {
			const SECONDS_AGO = Math.abs(d) * SLOT_INTERVAL;
			const TIMESTAMP = new Date(KICKOFF.getTime() - SECONDS_AGO);
			generatePrevEpoch(d, TIMESTAMP);
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

			generateEpoch(d, now)
			generateBlock(d, now);

			// TODO: circle packing ATTESTATIONS

			// do forever
			generateData();

		}, timeout);
	}

	function generatePrevEpoch(d, timestamp) {
		if (Math.abs(d) % 8 === 0) {
			chart.datum({
				time: timestamp,
				category: "Epochs",
				type: "g",
				size: Math.max(Math.round(Math.random() * 12), 4),
				label: (Math.round(d / 8)).toString(),
				finalized: true
			});
		}
	}

	function generateEpoch(d, timestamp) {
		if (d % 8 === 0) {
			chart.datum({
				time: timestamp,
				category: "Epochs",
				type: "g",
				size: Math.max(Math.round(Math.random() * 12), 4),
				label: Math.round(d / 8).toString(),
				finalized: false
			});
		}
	}

	function generateBlock(d, timestamp) {
		/*
			Block at Slot 226282
				
			Epoch: 			28285
			Slot: 			226282
			Status:			Proposed
			Time: 			12/12/2019 9:44:26 PM (a few seconds ago)
			Proposed by:	371
			Votes:			[...]
		*/

		// random block status
		let seed = Math.random();
		let status;
		let attestations = 0;

		if (seed < .1) {
			status = "orphaned";
		} else if (seed < .4) {
			status = "missing";
		} else {
			status = "proposed";
			attestations = Math.round(Math.random(0, 100));
		}

		chart.datum({
			time: timestamp,
			category: "Blocks",
			type: "g",
			size: 24,
			status: status,
			slot: d.toString(),
			votes: attestations
		});
	}

	async function getSampleBlock(slot) {
		return await fetch(`data/block_${slot}.json`)
			.then(response => response.json())
			.then(data => (data.blockContainers.length === 1) ? data.blockContainers[0] : null);
	}

} // end initialize function

initialize();