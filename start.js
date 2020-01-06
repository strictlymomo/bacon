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

	// mean and deviation for generation of time intervals
	let tX = 12; // time constant, multiple of one second
	
	// define time scale
	let timeScale = d3.scaleLinear()
		.domain([300 * tX, 1700 * tX])
		.range([300 * tX, 1700 * tX])
		.clamp(true);

	// in a normal use case, real time data would arrive through the network or some other mechanism
	let d = -1;
	let timeout = 0;

	// start the data generator
	dataGenerator();

	// define data generator
	function dataGenerator() {

		setTimeout(function () {

			d++;

			// create timestamp for this category data item
			let now = new Date(new Date().getTime());

			// drive data into the chart at designated slot interval
			timeout = 12000;


			/* 	------------------------------------------------------------------------------------
				EPOCHS
				------------------------------------------------------------------------------------ */

			// HACK: epoch countdown
			// TODO: JUSTIFICATION & FINALITY UPDATES
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
					category: "Epochs",
					type: "g",
					size: Math.max(Math.round(Math.random() * 12), 4),
					label: Math.round(d / 8).toString(),
				};

				// send the datum to the chart
				chart.datum(epoch);

			}


			/* 	------------------------------------------------------------------------------------
				BLOCKS
				------------------------------------------------------------------------------------ */

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
			let attestations = 0;

			if (seed < .1) {
				status = "orphaned";
			} else if (seed < .4) {
				status = "missing";
			} else {
				status = "proposed";
				attestations = Math.round(Math.random(0,100));
			}

			block = {
				time: now,
				category: "Blocks",
				type: "g",
				size: 24,
				status: status,
				slot: d.toString(),
				votes: attestations
			};

			// send the datum to the chart
			chart.datum(block);

			
			/* 	------------------------------------------------------------------------------------
				ATTESTATIONS
				------------------------------------------------------------------------------------ */

			// TODO: circle packing

			// do forever
			dataGenerator();

		}, timeout);
	}

	async function getSampleBlock(slot) {
		return await fetch(`data/block_${slot}.json`)
			.then(response => response.json())
			.then(data => (data.blockContainers.length === 1) ? data.blockContainers[0] : null);
	}
	
} // end initialize function

initialize();