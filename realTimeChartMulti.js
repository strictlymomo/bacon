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
		headSlotTimeOffset,
		showRoots = false,
		showProposers = false,
		showAttestations = false;

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
		backgroundColor = backgroundColor || "#0f1927";

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
				if (border) return "1px solid #e2e8f0";
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

		/* 	------------------------------------------------------------------------------------
			scales
			------------------------------------------------------------------------------------ */

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
			.style("fill", "#0f1927")
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
		let nowG = main.append("g")
			.attr("class", "nowGroup")
			.attr("transform", "translate(0, 0)")
			.attr("clip-path", "url(#myClip")
			.append("g");

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
			.style("fill", "#FFF");

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

		svg.append('defs')
			.append('style')
			.attr('type', 'text/css')
			.text("@import url('https://fonts.googleapis.com/css?family=Barlow:400,300,600,700,800);");

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
		// yAxis.scale(y)(yAxisG);
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
				NOW
				------------------------------------------------------------------------------------ */

			let now = [{ time: new Date(new Date().getTime()) }];

			// create update selection
			let updateNowSel = nowG.selectAll(".now")
				.data(now);

			// remove items
			updateNowSel.exit().remove();

			// add items
			updateNowSel.enter()
				.append("g")
				.attr("class", "now")
				.attr("transform", d => translateNow(d))
				.html(d => nowTemplate());

			updateNowSel
				.attr("transform", d => translateNow(d))
				.html(d => nowTemplate());

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

			let epochsData = data.filter(d => d.category === "Epochs");

			// update epoch status
			for (let epoch in epochsData) {
				epochsData[epoch].status = checkEpochStatus(epochsData[epoch].time);
			}

			let updateEpochsSel = epochsG.selectAll(".bar")
				.data(epochsData);

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
				.attr("transform", d => translateDataGroup(d))
				.html(d => blockTemplate(d));

			// update items; added items are now part of the update selection
			updateBlocksSel
				.attr("transform", d => translateDataGroup(d))
				.html(d => blockTemplate(d));

			/* 	------------------------------------------------------------------------------------
				ROOTS
				------------------------------------------------------------------------------------ */

			if (!showRoots) {
				d3.selectAll(".roots").remove();
			}

			if (showRoots) {
				let updateRootsSel = rootsG.selectAll(".roots")
					.data(data.filter(d => d.category === "Blocks"));

				// remove items
				updateRootsSel.exit().remove();

				// add items
				updateRootsSel.enter()
					.append("path")
					.attr("class", "roots")
					.attr("id", d => `root-${d.slot}`);

				// update items; added items are now part of the update selection
				updateRootsSel
					.attr("d", (d, i) => {
						const x0 = Math.round(x(d.time)) + (slotWidth / 2),
							y0 = y(d.category) * 1.75,
							x1 = getPreviousRootPosition(updateRootsSel, i) + (slotWidth * (3 / 4)),
							y1 = y0,
							cpx = x1 + ((x0 - x1) * .5),
							cpy = y(d.category) * 1.75 + (1 * y(d.category) / 8) + offset + 1,
							path = d3.path();
						path.moveTo(x0, y0);
						path.quadraticCurveTo(cpx, cpy, x1, y1);
						return path;
					})
					.attr("stroke", d => {
						switch (d.status) {
							case "proposed":
								return "white";
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
			}

			/* 	------------------------------------------------------------------------------------
				PROPOSERS
				------------------------------------------------------------------------------------ */

			if (!showProposers) {
				d3.selectAll(".proposers").remove();
			}

			if (showProposers) {
				let updateProposersSel = proposersG.selectAll(".proposers")
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
					.attr("class", "proposers")
					.attr("id", d => `bar-${d.proposedBy}`)
					.attr("transform", d => translateDataGroup(d))
					.html(d => proposerTemplate(d));

				// update items; added items are now part of the update selection
				updateProposersSel
					.attr("transform", d => translateDataGroup(d))
					.html(d => proposerTemplate(d));
			}

			/* 	------------------------------------------------------------------------------------
				ATTESTATIONS
				------------------------------------------------------------------------------------ */

			if (!showAttestations) {
				d3.selectAll(".attestations").remove();
			}

			if (showAttestations) {
				let updateAttestationsSel = attestationsG.selectAll(".attestations")
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
					.attr("class", "attestations")
					.attr("id", d => `attestations-${d.attestations}`)
					.attr("transform", d => translateDataGroup(d))
					.html(d => attestationsTemplate(d));

				// update items; added items are now part of the update selection
				updateAttestationsSel
					.attr("transform", d => translateDataGroup(d))
					.html(d => attestationsTemplate(d));
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
				.attr("fill", "white")

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
			templates and translations
			------------------------------------------------------------------------------------ */

		function translateNow(d) {
			let retValX = Math.round(x(d.time));
			let retValY = 0;
			return `translate(${retValX},${retValY})`;
		}

		function translateDataGroup(d) {
			let retValX = Math.round(x(d.time));
			let retValY = y(d.category);
			return `translate(${retValX},${retValY})`;
		}

		/* 	--------------------------------------
			NOW
			-------------------------------------- */

		function nowTemplate() {
			const radius = 4;
			return `
				<circle 
					cx="0" 
					cy="${height - radius}" 
					r="${radius}" 
					fill="red"
				></circle>
				<line
					x1="0" 
					x2="0" 
					y1="0"
					y2="${height}"
					stroke="red"
					stroke-width="2"
				></line>`;
		}

		/* 	--------------------------------------
			EPOCH
			-------------------------------------- */

		function translateEpoch(d) {
			let retValX = Math.round(x(d.time));
			let retValY = 0;
			return `translate(${retValX},${retValY})`;
		}

		function epochTemplate(d) {
			return `
				<line
					x1="0" 
					x2="0" 
					y1="${0}"
					y2="${height}"
					stroke="white"
					stroke-opacity=".37"
				>
				${justificationAnimationTemplate(d.status)}
				</line>
				<text 
					x="${offset}" 
					y="${8}" 
					font-size=".71em" 
					fill="white"
				>EPOCH ${d.label}
					<tspan x="${offset}" dy="1.2em">${(d.status).toUpperCase()}</tspan>
				${justificationAnimationTemplate(d.status)}
				</text>
			`;
		}

		function justificationAnimationTemplate(status) {
			if ("pending" || "justified") {
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

		/* 	--------------------------------------
			BLOCK
			-------------------------------------- */

		function blockTemplate(d) {
			let text = ``;
			let line = ``;
			let content = ``;
			let votes_arr = [];

			if (getSlotWidth(d) > 10) {
				line = `
					<line
						class="slot_line" 
						x1="0" 
						x2="0" 
						y1="${-(y(d.category))}"
						y2="${y(d.category) * 3}"
						stroke="white"
						stroke-opacity=".07"
					></line>`
			}

			if (getSlotWidth(d) > 25) {
				text = `
					<text 
						x="${offset}"
						y="${-(y(d.category) / 4) - 6}"
						font-size=".75em" 
						fill="white"
						opacity=".73"
						${/* TODO: transform="rotate(-90, ${-offset}, 0)" */""}
					>${d.slot}</text>`
			}

			if (getSlotWidth(d) > 100) {
				const w = 2;
				const h = 2;
				let votes = d.votes;
				for (votes; votes > 0; votes--) {
					let vote = `<rect
						x="${getSlotWidth(d) / 2}"
						y="${((y(d.category) / 4)) - (2 * h * votes)}"
						width=${w}
						height=${h}
						fill="white"
						></rect>`;
					votes_arr.push(vote);
				};

				if (d.status === "missing") {
					content = `
					<text 
						x="${getSlotWidth(d) / 2}"
						y="${((y(d.category) / 4))}"
						font-size="1.5em" 
						text-anchor="middle"
						dominant-baseline="middle"
						fill="white"
						opacity=".37"
					>Missed</text>`;
				}

				if (d.status === "proposed") {
					content = `
					<text 
						x="${offset}"
						y="0"
						font-size="1em" 
						fill="white"
						opacity="1"
						dy="0"
						>
						<tspan x="${offset}" dy="2.4em">0x.......${d.slot}</tspan>
						<tspan x="${offset}" dy="1.2em">Proposed by:		${d.proposedBy}</tspan>
						<tspan x="${offset}" dy="1.2em">Attestations:		${d.votes}</tspan>
					</text>
					`;
				}

			}

			return `
			${text}
			${line}
			<rect 
				class="block"
				x="${0}"
				y="${-(y(d.category) / 4)}" 
				width="${getSlotWidth(d)}"
				height="${y(d.category)}"
				rx="${roundedCorner(d)}" 
				ry="${roundedCorner(d)}"
				fill="${mapBlockStatusToColor(d)}"
				stroke="none"
			></rect>
			${content}
			${/* TODO: ${votes_arr} */""}
			`;
		}

		function getSlotWidth(d) {
			let t1 = x(d.time);
			let t2 = x(new Date(d.time.getTime() + 12000));
			return t2 - t1;
		}

		function roundedCorner(d) {
			if (getSlotWidth(d) > 20) {
				return 4;
			}
			return 0;
		}

		function mapBlockStatusToColor(d) {
			let retVal = "none";
			switch (d.status) {
				case "proposed":
					retVal = "rgb(54, 149, 141)";
					break;
				case "orphaned":
					retVal = "rgba(54, 149, 141, .67)";
					break;
				case "missing":
					retVal = "transparent"
					break;
				default:
			}
			return retVal;
		}

		/* 	--------------------------------------
			ROOTS
			-------------------------------------- */

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
				// ... and it is a missing or orphaned block. recursively find parent block.
				parentIndex = getPreviousRootPosition(selection, prevBlockIndex);
				return parentIndex;
			}
			// no block
			return parentIndex;
		}

		/* 	--------------------------------------
			PROPOSERS
			-------------------------------------- */

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
					fill="white"
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

		/* 	--------------------------------------
			ATTESTATIONS
			-------------------------------------- */

		function attestationsTemplate(d) {
			const w = 2;
			const h = 2;
			let votes = d.votes;
			let votes_arr = [];
			for (votes; votes > 0; votes--) {
				let vote = `<rect
					x="${offset * 2}"
					y="${y(d.category) - (2 * h * votes)}"
					width=${w}
					height=${h}
					fill="white"
					></rect>`;
				votes_arr.push(vote);
			};
			return `
			${votes_arr}
			<text 
				x="${offset}"
				y="${y(d.category) * 1.5 - 10}"
				font-size=".5em" 
				fill="white"
				opacity="1"
				>${d.votes}</text>
			`;
		}


		/* 	------------------------------------------------------------------------------------
			function to keep the chart "moving" through time (right to left) 
			------------------------------------------------------------------------------------ */

		setInterval(function () {

			if (halted) return;

			// get current viewport extent
			let interval = extent[1].getTime() - extent[0].getTime();
			let offset = extent[0].getTime() - xNav.domain()[0].getTime();

			// compute new nav extents
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

		}, 1000)

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

	// show roots
	chart.showRoots = function (_) {
		if (arguments.length == 0) return showRoots;
		showRoots = _;
		return chart;
	}

	// show proposers
	chart.showProposers = function (_) {
		if (arguments.length == 0) return showProposers;
		showProposers = _;
		return chart;
	}

	// show proposers
	chart.showAttestations = function (_) {
		if (arguments.length == 0) return showAttestations;
		showAttestations = _;
		return chart;
	}

	return chart;

} // end realTimeChart function