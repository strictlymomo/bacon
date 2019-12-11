'use strict';

// create the real time chart
let chart = realTimeChartMulti()
	.title("Beacon Chain")
	.yTitle("Categories")
	.xTitle("Time")
	.yDomain([
		"Epochs",
		"Blocks", 
		// "Slots", 
		"Attestations"
	]) // initial y domain (note array)
	.border(true)
	.width(900)
	.height(600);

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

// define color scale
let color = d3.scale.category10();

// in a normal use case, real time data would arrive through the network or some other mechanism
let d = -1;
let shapes = ["rect", "circle"];
let timeout = 0;

// define data generator
function dataGenerator() {

	setTimeout(function () {

		d++;

		// create timestamp for this category data item
		let now = new Date(new Date().getTime());

		// drive data into the chart at average interval of five seconds
		// here, set the timeout to roughly five seconds
		// timeout = Math.round(timeScale(normal()));
		timeout = 12000;

		// output a sample for each category, each interval (five seconds)
		chart.yDomain().forEach(function (cat, i) {

			// create new data item
			let obj;
			let doSimple = false;
			let status = (Math.random() < .75) ? "proposed" : "missing";

			if (doSimple) {
				obj = {
					// simple data item (simple black circle of constant size)
					time: now,
					color: "black",
					opacity: 1,
					category: cat,
					type: "circle",
					size: 5,
				};

			} else {
				switch (cat) {
					case "Blocks":
						obj = {
							// complex data item; four attributes (type, color, opacity and size) are changing dynamically with each iteration (as an example)
							time: now,
							color: "rgb(44, 160, 44)",
							opacity: (status === "proposed") ? 1 : .15,
							category: cat,
							//type: shapes[Math.round(Math.random() * (shapes.length - 1))], // the module currently doesn't support dynamically changed svg types (need to add key function to data, or method to dynamically replace svg object – tbd)
							type: "circle",
							size: (status === "proposed") ? 12 : 4,
						};
						break;

					case "Slots":
						obj = {
							time: now,
							color: "rgba(0,0,0,.25)",
							opacity: .15,
							category: cat,
							type: "rect",
							size: 20,
						};
						break;

					case "Epochs":

						if (d % 8 === 0) {
							obj = {
								time: now,
								color: color(d % 10),
								opacity: Math.max(Math.random(), 0.3),
								category: cat,
								type: "circle",
								size: Math.max(Math.round(Math.random() * 12), 4),
							};
						} else {
							obj = {
								time: now,
								color: "rgba(0,0,0,0)",
								// color: color(d % 10),
								opacity: 1,
								category: cat,
								type: "circle",
								size: Math.max(Math.round(Math.random() * 12), 4),
							};
						}
						break;

					case "Attestations":
						obj = {
							time: now,
							color: color(d % 10),
							opacity: Math.max(Math.random(), 0.3),
							category: cat,
							type: "circle",
							size: Math.max(Math.round(Math.random() * 12), 4),
						};
						break;
				}

			}

			// send the datum to the chart
			chart.datum(obj);
		});

		// do forever
		dataGenerator();

	}, timeout);
}

// start the data generator
dataGenerator();