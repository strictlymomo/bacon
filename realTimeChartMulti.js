'use strict';

function realTimeChartMulti() {

	let datum, data,
		maxSeconds, pixelsPerSecond = 10,
		svgWidth = 700, svgHeight = 300,
		margin = { top: 20, bottom: 20, left: 100, right: 30, topNav: 10, bottomNav: 20 },
		dimension = { chartTitle: 20, xAxis: 20, yAxis: 20, xTitle: 20, yTitle: 20, navChart: 70 },
		chartTitle, yTitle, xTitle,
		drawXAxis = true, drawYAxis = true, drawNavChart = true,
		border,
		selection,
		yDomain = [],
		debug = false,
		halted = false,
		x, y,
		xNav, yNav,
		width, height,
		widthNav, heightNav,
		xAxisG, yAxisG,
		xAxis, yAxis,
		svg,
		backgroundColor,
		offset,
		headSlotTimeOffset;

	/* 	------------------------------------------------------------------------------------
		create the chart
		------------------------------------------------------------------------------------ */

	let chart = function (s) {
		selection = s;
		if (selection == undefined) {
			console.error("selection is undefined");
			return;
		};

		// process titles
		chartTitle = chartTitle || "";
		xTitle = xTitle || "";
		yTitle = yTitle || "";
		backgroundColor = backgroundColor || "#f5f5f5";

		// process time
		maxSeconds = maxSeconds || 300;
		headSlotTimeOffset = headSlotTimeOffset || 0;

		// compute component dimensions
		let chartTitleDim = chartTitle == "" ? 0 : dimension.chartTitle,
			xTitleDim = xTitle == "" ? 0 : dimension.xTitle,
			yTitleDim = yTitle == "" ? 0 : dimension.yTitle,
			xAxisDim = !drawXAxis ? 0 : dimension.xAxis,
			yAxisDim = !drawYAxis ? 0 : dimension.yAxis,
			navChartDim = !drawNavChart ? 0 : dimension.navChart;

		// compute dimension of main and nav charts, and offsets
		let marginTop = margin.top + chartTitleDim;
		height = svgHeight - marginTop - margin.bottom - chartTitleDim - xTitleDim - xAxisDim - navChartDim + 30;
		heightNav = navChartDim - margin.topNav - margin.bottomNav;
		let marginTopNav = svgHeight - margin.bottom - heightNav - margin.topNav;
		width = svgWidth - margin.left - margin.right;
		widthNav = width;
		offset = 4;

		// append the svg
		svg = selection.append("svg")
			.attr("width", svgWidth)
			.attr("height", svgHeight)
			.style("border", () => {
				if (border) return "1px solid lightgray";
				else return null;
			});

		/* 	------------------------------------------------------------------------------------
			create main chart
			------------------------------------------------------------------------------------ */

		// create main group and translate
		let main = svg.append("g")
			.attr("transform", "translate (" + margin.left + "," + marginTop + ")");

		// define clip-path
		main.append("defs").append("clipPath")
			.attr("id", "myClip")
			.append("rect")
			.attr("x", 0)
			.attr("y", 0)
			.attr("width", width)
			.attr("height", height);

		// create chart background
		main.append("rect")
			.attr("x", 0)
			.attr("y", 0)
			.attr("width", width)
			.attr("height", height)
			.style("fill", backgroundColor);

		/* 	----------------------------------------
			create axes & labels
			---------------------------------------- */

		// add group for x axis
		xAxisG = main.append("g")
			.attr("class", "x axis")
			.attr("transform", "translate(0," + height + ")");

		// add group for y axis
		yAxisG = main.append("g")
			.attr("class", "y axis");

		// in x axis group, add x axis title
		xAxisG.append("text")
			.attr("class", "title")
			.attr("x", width / 2)
			.attr("y", 25)
			.attr("dy", ".71em")
			.text(() => {
				let text = xTitle == undefined ? "" : xTitle;
				return text;
			});

		// in y axis group, add y axis title
		yAxisG.append("text")
			.attr("class", "title")
			.attr("transform", "rotate(-90)")
			.attr("x", - height / 2)
			.attr("y", -margin.left + 15) //-35
			.attr("dy", ".71em")
			.text(() => {
				let text = yTitle == undefined ? "" : yTitle;
				return text;
			});

		// in main group, add chart title
		main.append("text")
			.attr("class", "chartTitle")
			.attr("x", width / 2)
			.attr("y", -20)
			.attr("dy", ".71em")
			.text(() => {
				let text = chartTitle == undefined ? "" : chartTitle;
				return text;
			});

		// define main chart scales
		x = d3.scaleTime().range([0, width]);
		y = d3.scalePoint().domain(yDomain).rangeRound([height, 0]).padding(.5)

		// define main chart axis
		xAxis = d3.axisBottom(x);
		yAxis = d3.axisLeft(y);

		/* 	------------------------------------------------------------------------------------
			create nav
			------------------------------------------------------------------------------------ */

		// add nav chart
		let nav = svg.append("g")
			.attr("transform", "translate (" + margin.left + "," + marginTopNav + ")");

		// add nav background
		nav.append("rect")
			.attr("x", 0)
			.attr("y", 0)
			.attr("width", width)
			.attr("height", heightNav)
			.style("fill", "#F5F5F5")
			.style("shape-rendering", "crispEdges")
			.attr("transform", "translate(0, 0)");

		// add group to data items
		let navG = nav.append("g")
			.attr("class", "nav");

		// add group to hold nav x axis
		// please note that a clip path has yet to be added here (tbd)
		let xAxisGNav = nav.append("g")
			.attr("class", "x axis")
			.attr("transform", "translate(0," + heightNav + ")");

		// define nav chart scales
		xNav = d3.scaleTime().range([0, widthNav]);
		yNav = d3.scalePoint().domain(yDomain).rangeRound([heightNav, 0]).padding(.5)

		// define nav axis
		let xAxisNav = d3.axisBottom();

		/* 	----------------------------------------
			create groups for binding data
			---------------------------------------- */

		// note that two groups are created here, the latter assigned to blocksG;
		// the former will contain a clip path to constrain objects to the chart area; 
		// no equivalent clip path is created for the nav chart as the data itself
		// is clipped to the full time domain
		let epochsG = main.append("g")
			.attr("class", "epochsGroup")
			.attr("transform", "translate(0, 0)")
			.attr("clip-path", "url(#myClip")
			.append("g");

		let blocksG = main.append("g")
			.attr("class", "blocksGroup")
			.attr("transform", "translate(0, 0)")
			.attr("clip-path", "url(#myClip")
			.append("g");

		let rootsG = main.append("g")
			.attr("class", "rootsGroup")
			.attr("transform", "translate(0, 0)")
			.attr("clip-path", "url(#myClip")
			.append("g");

		let proposersG = main.append("g")
			.attr("class", "proposersGroup")
			.attr("transform", "translate(0, 0)")
			.attr("clip-path", "url(#myClip")
			.append("g");
		
		let attestationsG = main.append("g")
			.attr("class", "attestationsGroup")
			.attr("transform", "translate(0, 0)")
			.attr("clip-path", "url(#myClip")
			.append("g");

		/* 	----------------------------------------
			SVG defs, styles and icons
			---------------------------------------- */	

		// define root hash arrow
		svg.append("svg:defs").append("svg:marker")
			.attr("id", "proposed-triangle")
			.attr("refX", 3)
			.attr("refY", 3)
			.attr("markerWidth", 15)
			.attr("markerHeight", 15)
			.attr("markerUnits", "userSpaceOnUse")
			.attr("orient", "auto")
			.append("path")
			.attr("d", "M 0 0 6 3 0 6 1.5 3")
			.style("fill", "#555");

		svg.append("svg:defs").append("svg:marker")
			.attr("id", "orphaned-triangle")
			.attr("refX", 3)
			.attr("refY", 3)
			.attr("markerWidth", 15)
			.attr("markerHeight", 15)
			.attr("markerUnits", "userSpaceOnUse")
			.attr("orient", "auto")
			.append("path")
			.attr("d", "M 0 0 6 3 0 6 1.5 3")
			.style("fill", "#ccc");

		const logos = {
			star: "M14.615,4.928c0.487-0.986,1.284-0.986,1.771,0l2.249,4.554c0.486,0.986,1.775,1.923,2.864,2.081l5.024,0.73c1.089,0.158,1.335,0.916,0.547,1.684l-3.636,3.544c-0.788,0.769-1.28,2.283-1.095,3.368l0.859,5.004c0.186,1.085-0.459,1.553-1.433,1.041l-4.495-2.363c-0.974-0.512-2.567-0.512-3.541,0l-4.495,2.363c-0.974,0.512-1.618,0.044-1.432-1.041l0.858-5.004c0.186-1.085-0.307-2.6-1.094-3.368L3.93,13.977c-0.788-0.768-0.542-1.525,0.547-1.684l5.026-0.73c1.088-0.158,2.377-1.095,2.864-2.081L14.615,4.928z",
			apple: "M24.32,10.85c-1.743,1.233-2.615,2.719-2.615,4.455c0,2.079,1.078,3.673,3.232,4.786c-0.578,1.677-1.416,3.134-2.514,4.375c-1.097,1.241-2.098,1.862-3.004,1.862c-0.427,0-1.009-0.143-1.748-0.423l-0.354-0.138c-0.725-0.281-1.363-0.423-1.92-0.423c-0.525,0-1.1,0.11-1.725,0.331l-0.445,0.16l-0.56,0.229c-0.441,0.176-0.888,0.264-1.337,0.264c-1.059,0-2.228-0.872-3.507-2.616c-1.843-2.498-2.764-5.221-2.764-8.167c0-2.095,0.574-3.781,1.725-5.061c1.149-1.279,2.673-1.92,4.568-1.92c0.709,0,1.371,0.13,1.988,0.389l0.423,0.172l0.445,0.183c0.396,0.167,0.716,0.251,0.959,0.251c0.312,0,0.659-0.072,1.04-0.217l0.582-0.229l0.435-0.16c0.693-0.251,1.459-0.377,2.297-0.377C21.512,8.576,23.109,9.334,24.32,10.85zM19.615,3.287c0.021,0.267,0.033,0.473,0.033,0.617c0,1.317-0.479,2.473-1.438,3.467s-2.075,1.49-3.347,1.49c-0.038-0.297-0.058-0.51-0.058-0.639c0-1.12,0.445-2.171,1.337-3.153c0.891-0.982,1.922-1.558,3.096-1.725C19.32,3.329,19.447,3.311,19.615,3.287z",
			glasses: "M14.075,9.531c0,0-2.705-1.438-5.158-1.438c-2.453,0-4.862,0.593-4.862,0.593L3.971,9.869c0,0,0.19,0.19,0.528,0.53c0.338,0.336,0.486,3.741,1.838,5.094c1.353,1.354,4.82,1.396,5.963,0.676c1.14-0.718,2.241-3.466,2.241-4.693c0-0.38,0-0.676,0-0.676c0.274-0.275,1.615-0.303,1.917,0c0,0,0,0.296,0,0.676c0,1.227,1.101,3.975,2.241,4.693c1.144,0.72,4.611,0.678,5.963-0.676c1.355-1.353,1.501-4.757,1.839-5.094c0.338-0.34,0.528-0.53,0.528-0.53l-0.084-1.183c0,0-2.408-0.593-4.862-0.593c-2.453,0-5.158,1.438-5.158,1.438C16.319,9.292,14.737,9.32,14.075,9.531z"
		};

		/* 	----------------------------------------
			scales
			---------------------------------------- */

		// compute initial time domains...
		let ts = new Date(new Date().getTime() + headSlotTimeOffset);

		// first, the full time domain
		let endTime = new Date(ts);
		let startTime = new Date(endTime.getTime() - maxSeconds * 1000);
		let interval = endTime.getTime() - startTime.getTime();

		// then the viewport time domain (what's visible in the main chart and the viewport in the nav chart)
		let endTimeViewport = new Date(ts);
		let startTimeViewport = new Date(endTime.getTime() - width / pixelsPerSecond * 1000);
		let intervalViewport = endTimeViewport.getTime() - startTimeViewport.getTime();
		let offsetViewport = startTimeViewport.getTime() - startTime.getTime();

		// initialize extent
		let extent = [startTimeViewport, endTimeViewport];

		// set the scale domains for main and nav charts
		x.domain(extent);
		xNav.domain([startTime, endTime]);

		// update axis with modified scale
		xAxis.scale(x)(xAxisG);
		yAxis.scale(y)(yAxisG);
		xAxisNav.scale(xNav)(xAxisGNav);

		/* 	----------------------------------------
			focus + context via brushing
			---------------------------------------- */
		// create brush (moveable, changable rectangle that determines the time domain of main chart)
		let viewport = d3.brushX()
			.extent([[0, 0], [widthNav, heightNav]])
			.on("brush", brushed);

		function brushed() {

			const selection = d3.event.selection || xNav.range();

			// get the current time extent of viewport
			startTimeViewport = xNav.invert(selection[0]);
			endTimeViewport = xNav.invert(selection[1]);
			extent = [startTimeViewport, endTimeViewport];

			// compute viewport extent in milliseconds
			intervalViewport = endTimeViewport.getTime() - startTimeViewport.getTime();
			offsetViewport = startTimeViewport.getTime() - startTime.getTime();

			// handle invisible viewport
			if (intervalViewport == 0) {
				intervalViewport = maxSeconds * 1000;
				offsetViewport = 0;
			}

			// update the x domain of the main chart
			x.domain(extent);
			xNav.domain([startTime, endTime]);

			// update the x axis of the main chart
			xAxis.scale(x)(xAxisG);

			// update display
			refresh();
		}

		// initial invocation; update display
		data = [];
		refresh();

		// create group and assign to brush
		let viewportG = nav.append("g")
			.attr("class", "viewport")
			.call(viewport)
			.call(viewport.move, xNav.range());

		/* 	------------------------------------------------------------------------------------
			function to refresh the viz upon changes of the time domain 
			- happens constantly, or 
			- after arrival of new data, or
			- at init
			------------------------------------------------------------------------------------ */

		function refresh() {

			// process data to remove too late data items 
			data = data.filter(d => {
				if (d.time.getTime() > startTime.getTime()) return true;
			})

			// determine number of categories
			let categoryCount = yDomain.length;
			if (debug) console.log("yDomain", yDomain)

			/* 	------------------------------------------------------------------------------------
				EPOCHS
				------------------------------------------------------------------------------------ */

			/*
			here we bind the new data to the main chart
			
			note: no key function is used here; 
			- therefore the data binding is by index, which effectivly means that available DOM elements
			are associated with each item in the available data array, from 
			first to last index; if the new data array contains fewer elements
			than the existing DOM elements, the LAST DOM elements are removed;
			
			- basically, for each step, the data items "walks" leftward (each data 
			item occupying the next DOM element to the left);
			
			- This data binding is very different from one that is done with a key 
			function; in such a case, a data item stays "resident" in the DOM
			element, and such DOM element (with data) would be moved left, until
			the x position is to the left of the chart, where the item would be 
			exited
			*/

			let updateEpochsSel = epochsG.selectAll(".bar")
				.data(data.filter(d => d.category === "Epochs"));

			// remove items
			updateEpochsSel.exit().remove();

			// add items
			updateEpochsSel.enter()
				.append("g")
				.attr("class", "bar")
				.attr("id", d => `bar-${d.label}`)
				.attr("transform", d => translateEpoch(d))
				.html(d => epochTemplate(d));

			updateEpochsSel
				.attr("transform", d => translateEpoch(d))
				.html(d => epochTemplate(d));

			function translateEpoch(d) {
				let retValX = Math.round(x(d.time));
				let retValY = y(d.category);
				return `translate(${retValX},${retValY})`;
			}

			function justificationAnimationTemplate(finalized) {
				if (!finalized) {
					return `<animate id="animation1"
					attributeName="opacity"
					from="0" to="1" dur="3s"
					begin="0s;animation2.end" />
					<animate id="animation2"
					attributeName="opacity"
					from="1" to="0" dur="3s" 
					begin="animation1.end" />`;
				}
				return "";
			}

			// y1="${-(y(d.category) * 2)}"
			function epochTemplate(d) {
				return `
					<line
						x1="0" 
						x2="0" 
						y1="${-y(d.category)}"
						y2="${svgHeight}"
						stroke="black"
						stroke-opacity=".37"
					>
					${justificationAnimationTemplate(d.finalized)}	
					</line>
					<text 
						x="${offset}" 
						y="${-(y(d.category)) + 8}" 
						font-size=".71em" 
						fill="black"
					>Epoch ${d.label}
					${justificationAnimationTemplate(d.finalized)}
					</text>
				`;
			}

			/* 	------------------------------------------------------------------------------------
				SLOTS / BLOCKS
				------------------------------------------------------------------------------------ */

			let updateBlocksSel = blocksG.selectAll(".bar")
				.data(data.filter(d => d.category === "Blocks"));

			let slotWidth = 1;	
			if (updateBlocksSel.data().length > 0) {
				slotWidth = getSlotWidth(updateBlocksSel.data()[3]);
			}

			// remove items
			updateBlocksSel.exit().remove();

			// add items
			updateBlocksSel.enter()
				.append(d => {
					if (debug) { console.log("d", JSON.stringify(d)); }
					let type = "g";
					let node = document.createElementNS("http://www.w3.org/2000/svg", type);
					return node;
				})
				.attr("class", "bar")
				.attr("id", d => `bar-${d.slot}`)
				.attr("transform", d => translateBlock(d))
				.html(d => blockTemplate(d));

			// update items; added items are now part of the update selection
			updateBlocksSel
				.attr("transform", d => translateBlock(d))
				.html(d => blockTemplate(d));

			function translateBlock(d) {
				let retValX = Math.round(x(d.time));
				let retValY = y(d.category);
				return `translate(${retValX},${retValY})`;
			}

			function blockTemplate(d) {
				return `
				<line
					class="slot_line" 
					x1="0" 
					x2="0" 
					y1="${-(y(d.category))}"
					y2="${y(d.category) * 3}"
					stroke="${(d.color || "black")}"
					stroke-opacity=".07"
				>
				</line>
				<rect 
					class="block"
					x="${offset}"
					y="${-(y(d.category) / 4)}" 
					width="${getSlotWidth(d) - (offset * 2)}"
					height="${y(d.category) / 2}"
					fill="${mapBlockStatusToColor(d)}"
					stroke="none"
				></rect>
				<text 
					x="${offset}"
					y="${-(y(d.category) / 4) - 6}"
					font-size=".71em" 
					fill="black"
					opacity=".37"
					${/* TODO: transform="rotate(-90, ${-offset}, 0)" */""}
					>${d.slot}</text>
				`;
			}

			function getSlotWidth(d) {
				let t1 = x(d.time);
				let t2 = x(new Date(d.time.getTime() + 12000));
				return t2 - t1;
			}

			function mapBlockStatusToColor(d) {
				let retVal = "none";
				switch (d.status) {
					case "proposed":
						retVal = "#28a745";
						break;
					case "orphaned":
						retVal = "#aaa";
						break;
					case "missing":
						retVal = "white"
						break;
					default:
				}
				return retVal;
			}


			/* 	------------------------------------------------------------------------------------
				ROOTS
				------------------------------------------------------------------------------------ */

			let updateRootsSel = rootsG.selectAll(".bar")
				.data(data.filter(d => d.category === "Blocks"));

			// remove items
			updateRootsSel.exit().remove();

			// add items
			updateRootsSel.enter()
				.append("path")
				.attr("class", "bar")
				.attr("id", d => `bar-root-${d.slot}`); //TODO: block root

			// update items; added items are now part of the update selection
			updateRootsSel
				.attr("d", (d, i) => {
					const x0 = Math.round(x(d.time)) + (d.size / 4) + offset,
						y0 = y(d.category) + (y(d.category) / 4) + offset + 1,
						x1 = getPreviousRootPosition(updateRootsSel, i) + (d.size * 3 / 4) + offset,
						y1 = y0,
						cpx = x1 + ((x0 - x1) * .5),
						cpy = y(d.category) + (3 * y(d.category) / 8) + offset + 1,
						path = d3.path();
					path.moveTo(x0, y0);
					path.quadraticCurveTo(cpx, cpy, x1, y1);
					return path;
				})
				.attr("stroke", d => {
					switch (d.status) {
						case "proposed":
							return "#555";
						case "orphaned":
							return "#ccc"
						default:
							return "none"
					}
				})
				.attr("fill", "transparent")
				.attr("marker-end", d => {
					switch (d.status) {
						case "proposed":
							return "url(#proposed-triangle)";
						case "orphaned":
							return "url(#orphaned-triangle)"
						default:
							return ""
					}
				});

			// TODO: calling this function kills memory. store the root hashes or rely on the API
			function getPreviousRootPosition(selection, i) {
				let prevBlock = selection.data()[i - 1];
				let prevBlockIndex = i - 1;
				let parentIndex = 0;

				// there is a block
				if (prevBlock) {
					// ... and it is the parent block
					if (prevBlock.status === "proposed") {
						parentIndex = Math.round(x(prevBlock.time));
						return parentIndex;
					}
					// ... and it is a missing or orphaned block. let's recursively find parent...
					parentIndex = getPreviousRootPosition(selection, prevBlockIndex);
					return parentIndex;
				}
				// no block
				return parentIndex;
			}

			/* 	------------------------------------------------------------------------------------
				PROPOSERS
				------------------------------------------------------------------------------------ */

			let updateProposersSel = proposersG.selectAll(".bar")
				.data(data.filter(d => d.category === "Blocks"));

			// remove items
			updateProposersSel.exit().remove();

			// add items
			updateProposersSel.enter()
				.append(d => {
					if (debug) { console.log("d", JSON.stringify(d)); }
					let type = "g";
					let node = document.createElementNS("http://www.w3.org/2000/svg", type);
					return node;
				})
				.attr("class", "bar")
				.attr("id", d => `bar-${d.proposedBy}`)
				.attr("transform", d => translateProposer(d))
				.html(d => proposerTemplate(d));

			// update items; added items are now part of the update selection
			updateProposersSel
				.attr("transform", d => translateProposer(d))
				.html(d => proposerTemplate(d));

			function translateProposer(d) {
				let retValX = Math.round(x(d.time));
				let retValY = y(d.category);
				return `translate(${retValX},${retValY})`;
			}

			function proposerTemplate(d) {
				return `
				<circle
					cx="${getSlotWidth(d) / 2}" 
					cy="${y(d.category) * .75 - 20}" 
					r="${setRadius(d)}"
					fill="${mapBlockStatusToColor(d)}"
				></circle>
				<text 
					x="${offset}"
					y="${y(d.category) * .75 - 10}"
					font-size=".5em" 
					fill="black"
					opacity="1"
					>${d.proposedBy}</text>
				`;
			}

			function setRadius(d) {
				if (getSlotWidth(d) < 1) {
					return .25;
				} else {
					return 2;
				} 
			}
			/* 	------------------------------------------------------------------------------------
				ATTESTATIONS
				------------------------------------------------------------------------------------ */

			let updateAttestationsSel = attestationsG.selectAll(".bar")
				.data(data.filter(d => d.category === "Blocks"));

			// remove items
			updateAttestationsSel.exit().remove();

			// add items
			updateAttestationsSel.enter()
				.append(d => {
					if (debug) { console.log("d", JSON.stringify(d)); }
					let type = "g";
					let node = document.createElementNS("http://www.w3.org/2000/svg", type);
					return node;
				})
				.attr("class", "bar")
				.attr("id", d => `bar-${d.attestations}`)
				.attr("transform", d => translateAttestations(d))
				.html(d => attestationsTemplate(d));

			// update items; added items are now part of the update selection
			updateAttestationsSel
				.attr("transform", d => translateAttestations(d))
				.html(d => attestationsTemplate(d));

			function translateAttestations(d) {
				let retValX = Math.round(x(d.time));
				let retValY = y(d.category);
				return `translate(${retValX},${retValY})`;
			}

			function attestationsTemplate(d) {
				const w = 2;
				const h = 2;
				let votes = d.votes;
				let votes_arr = [];
				for (votes; votes > 0; votes--) {
					console.log(votes);
					let vote = `<rect
						x="${offset}"
						y="${(y(d.category) * 1.5) - (2 * h * votes) - 40 }"
						width=${w}
						height=${h}
						fill="black"
						></rect>`;
					votes_arr.push(vote);
				};
				// console.log(votes_arr.reverse());
				return `
				${votes_arr}
				<text 
					x="${offset}"
					y="${y(d.category) * 1.5 - 10}"
					font-size=".5em" 
					fill="black"
					opacity="1"
					>${d.votes}</text>
				`;
			}

			/* 	------------------------------------------------------------------------------------
				nav update
				------------------------------------------------------------------------------------ */

			// create update selection for the nav chart, by applying data
			let updateBlocksSelNav = navG.selectAll("circle")
				.data(data);

			// remove items
			updateBlocksSelNav.exit().remove();

			// add items
			updateBlocksSelNav.enter().append("circle")
				.attr("r", 1)
				.attr("fill", "black")

			// added items now part of update selection; set coordinates of points
			updateBlocksSelNav
				.attr("cx", d => {
					return Math.round(xNav(d.time));
				})
				.attr("cy", d => {
					return yNav(d.category);
				})

		} // end refreshChart function


		/* 	------------------------------------------------------------------------------------
			function to keep the chart "moving" through time (right to left) 
			------------------------------------------------------------------------------------ */

		setInterval(function () {

			if (halted) return;

			// get current viewport extent
			let interval = extent[1].getTime() - extent[0].getTime();
			let offset = extent[0].getTime() - xNav.domain()[0].getTime();

			// compute new nav extents
			// endTime = new Date();
			endTime = new Date(new Date().getTime() + headSlotTimeOffset);
			startTime = new Date(endTime.getTime() - maxSeconds * 1000);

			// compute new viewport extents 
			startTimeViewport = new Date(startTime.getTime() + offset);
			endTimeViewport = new Date(startTimeViewport.getTime() + interval);
			extent = [startTimeViewport, endTimeViewport];
			viewport.extent(extent);

			// update scales
			x.domain(extent);
			xNav.domain([startTime, endTime]);

			// update axis
			xAxis.scale(x)(xAxisG);
			xAxisNav.scale(xNav)(xAxisGNav);

			// refresh svg
			refresh();

		}, 200)

		return chart;

	} // end chart function


	/* 	------------------------------------------------------------------------------------
		chart getters/setters
		------------------------------------------------------------------------------------ */

	// new data item (this most recent item will appear 
	// on the right side of the chart, and begin moving left)
	chart.datum = function (_) {
		if (arguments.length == 0) return datum;
		datum = _;
		data.push(datum);
		return chart;
	}

	// svg width
	chart.width = function (_) {
		if (arguments.length == 0) return svgWidth;
		svgWidth = _;
		return chart;
	}

	// svg height
	chart.height = function (_) {
		if (arguments.length == 0) return svgHeight;
		svgHeight = _;
		return chart;
	}

	// svg border
	chart.border = function (_) {
		if (arguments.length == 0) return border;
		border = _;
		return chart;
	}

	// chart title
	chart.title = function (_) {
		if (arguments.length == 0) return chartTitle;
		chartTitle = _;
		return chart;
	}

	// x axis title
	chart.xTitle = function (_) {
		if (arguments.length == 0) return xTitle;
		xTitle = _;
		return chart;
	}

	// y axis title
	chart.yTitle = function (_) {
		if (arguments.length == 0) return yTitle;
		yTitle = _;
		return chart;
	}

	// yItems (can be dynamically added after chart construction)
	chart.yDomain = function (_) {
		if (arguments.length == 0) return yDomain;
		yDomain = _;
		if (svg) {
			// update the y ordinal scale
			y = d3.scalePoint().domain(yDomain).rangeRound([height, 0]).padding(.5);
			// update the y axis
			yAxis.scale(y)(yAxisG);
			// update the y ordinal scale for the nav chart
			yNav = d3.scalePoint().domain(yDomain).rangeRound([heightNav, 0]).padding(.5);
		}
		return chart;
	}

	// background color
	chart.backgroundColor = function (_) {
		if (arguments.length == 0) return backgroundColor;
		backgroundColor = _;
		return chart;
	}

	// timeframe
	chart.maxSeconds = function (_) {
		if (arguments.length == 0) return maxSeconds;
		maxSeconds = _;
		return chart;
	}

	// timeframe
	chart.headSlotTimeOffset = function (_) {
		if (arguments.length == 0) return headSlotTimeOffset;
		headSlotTimeOffset = _;
		return chart;
	}

	// debug
	chart.debug = function (_) {
		if (arguments.length == 0) return debug;
		debug = _;
		return chart;
	}

	// halt
	chart.halt = function (_) {
		if (arguments.length == 0) return halted;
		halted = _;
		return chart;
	}

	return chart;

} // end realTimeChart function
