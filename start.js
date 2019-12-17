'use strict';

async function initialize() {

	// create the real time chart
	let chart = realTimeChartMulti()
		.title("Beacon Chain")
		.yTitle("Categories")
		.xTitle("Time")
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

	// configure the data generator

	// mean and deviation for generation of time intervals
	let tX = 12; // time constant, multiple of one second
	let meanMs = 1000 * tX, // milliseconds
		dev = 200 * tX; // std dev

	// define time scale
	let timeScale = d3.scale.linear()
		.domain([300 * tX, 1700 * tX])
		.range([300 * tX, 1700 * tX])
		.clamp(true);

	// define function that returns normally distributed random numbers
	let normal = d3.random.normal(meanMs, dev);

	// beaconchain data
	let nodes = [];
	let edges = [];

	let sampleBlock;
	await getSampleBlock();

	// in a normal use case, real time data would arrive through the network or some other mechanism
	let d = -1;
	let timeout = 0;

	// define data generator
	function dataGenerator() {

		setTimeout(function () {

			d++;

			// create timestamp for this category data item
			let now = new Date(new Date().getTime());

			// drive data into the chart at average interval of five seconds
			// here, set the timeout to roughly five seconds
			timeout = 12000;


			/* 	====================================================================================
				EPOCHS
				==================================================================================== */

			// HACK: epoch countdown
			/* TODO: get slots in epoch correctly. 
				populate two epochs' worth of slots and prepend to the current head slot 
				get the head slot
				get the current epoch
				get the last justified
				get the last finalized
			*/
			if (d % 8 === 0) {
				
				let epoch = {
					time: now,
					color: "black",
					opacity: Math.max(Math.random(), 0.3),
					category: "Epochs",
					type: "g",
					size: Math.max(Math.round(Math.random() * 12), 4),
					label: (d / 8).toString()
				};

				// send the datum to the chart
				chart.datum(epoch);

			}


			/* 	====================================================================================
				BLOCKS
				==================================================================================== */

			/*
				Block at Slot 226282
					
				Epoch: 			28285
				Slot: 			226282
				Status:			Proposed
				Time: 			12/12/2019 9:44:26 PM (a few seconds ago)
				Proposed by:	371
				Votes:			[...]
			*/

			let block;

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

			block = {
				time: now,
				category: "Blocks",
				type: "g",
				size: (status === "proposed") ? 24 : 24,
				status: status
			};

			// send the datum to the chart
			chart.datum(block);

			
			/* 	====================================================================================
				ATTESTATIONS
				==================================================================================== */

			// TODO: circle packing

			// do forever
			dataGenerator();

			/* 	====================================================================================
				TODO: JUSTIFICATION & FINALITY UPDATES
				==================================================================================== */

		}, timeout);
	}

	// start the data generator
	dataGenerator();

	async function getSampleBlock() {
		sampleBlock = await fetch(`block.json`)
			.then(response => response.json())
			.then(data => (data.blockContainers.length === 1) ? data.blockContainers[0] : null);
	}
}

initialize();