/*
MIT License

Copyright (c) 2019 hotNipi

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/


/**
 * Performs binary search on a sorted array of numbers.
 * @param {number} x - The element to search for.
 * @param {number[]} xi - The sorted array of numbers to search.
 * @returns {number} - The index of the largest element in xi where x is greater or equal to.
 */
function binarySearch(x, xi) {
	let i_left = 0;
	let i_right = xi.length - 1;
	let i = Math.trunc((i_right-i_left)/2)
	
	
	while (i_right - i_left > 1) {
		if ( x < xi[i] ) {
			i_right = i;
		} else {
			i_left = i;
		}

		// Find central element in index interval [i_left, i_right] by shifting
		// right (integer division by 2)
		i = Math.trunc((i_left + i_right) / 2);
	}

	return i_left;
}

function saturate(lb, x, ub) {
	return Math.min(ub, Math.max(lb, x));
}

function nearest_index(x, xi) {
	return binarySearch( x, xi );
}

function nearest_index_ed(x, xi) {

	let step = xi[1] - xi[0];

	return Math.trunc( saturate(0, (x - xi[0]) / step, xi.length-2) );
}
  
    
const INTERP_EXTRAP_CLAMP = 0;
const INTERP_EXTRAP_LINEAR = 1;
const INTERP_TYPE_LINEAR = 0;
const INTERP_TYPE_STEP_AFTER = 1;
const INTERP_TYPE_STEP_BEFORE = 2;
const INTERP_TYPE_NEAREST_NEIGHBOR = 3;

/**
 * Finds the index i in a sorted array of elements xi where xi[i] is the largest element that is
 * smaller or equal than x.
 * It uses binary search if equidistant is false, a faster method otherwise.
 * @param {number} x - The element to search for.
 * @param {number[]} xi - The sorted array of numbers to search.
 * @param {boolean} equidistant - Set to true if x_i is equidistant, i.e. the step between all elements is the same.
 * @returns {number} - The index of the largest element in xi where x is greater or equal to.
 */
function prelookup1( x, xi, equidistant )
{
	let	id;
	let step;

	if( equidistant === undefined ) equidistant = false;

	if( xi.length == 1 )
	{
		id = 0;
		step = Math.sign(x - xi[0])/2;
	}
	else if( x < xi[0] )
	{
		id		= 0;
		step	= ( x - xi[0] ) / ( xi[1] - xi[0] );
	}
	else if( x < xi[xi.length - 2] )
	{
		// Find interval
		if( equidistant )
			id = nearest_index_ed( x, xi );
		else
			id = nearest_index( x, xi );

		// Calculate normalized linear interpolation step
		step = ( x - xi[id] ) / ( xi[id + 1] - xi[id] );
	} 
	else
	{
		id		= xi.length - 2;
		step = ( x - xi[id] ) / ( xi[id + 1] - xi[id] );
	}

	return [ id, step ];
}

function linterp1( id, yi, step ) {
	return yi[id] + step * (yi[id+1] - yi[id]);
}

function interp1(x,xi,yi,type,extrap,equidistant) {
	if( type === undefined ) type = INTERP_TYPE_LINEAR;
	if( extrap === undefined ) extrap = INTERP_EXTRAP_CLAMP;
	if( equidistant === undefined ) equidistant = false;

	if( xi.length == 1 ) return xi[0];

	let [id, r] = prelookup1(x,xi,equidistant);

	switch( type ) {
		case INTERP_TYPE_LINEAR:
			
			// Check what extrapolation type was chosen
			switch(extrap) {
				case INTERP_EXTRAP_CLAMP:
					r = saturate(0,r,1);
					break;
				case INTERP_EXTRAP_LINEAR:
				default:
					break;
			}

			return linterp1( id, yi, r );
		case INTERP_TYPE_STEP_AFTER:
			return yi[id];
		case INTERP_TYPE_STEP_BEFORE:
			return yi[Math.min(yi.length-1, id+1)];
		case INTERP_TYPE_NEAREST_NEIGHBOR:
			let idr = saturate( 0, Math.round(id + r), xi.length-1);
			return yi[idr];
	}
}

// Function to calculate the extension after the last data timestamp to fill the bar
function configGetTimeExtension(config) {
	switch( config.extendLastStateType ) {
		case "percent":

			break;
		case "milliseconds":
		default:
			break;
	}
}

function insertIntoTimeRange(newPoint, dataPoints, currentTime, config) {
	let leastAcceptableTime;
	
	// Get least acceptable time
	if(config.useCurrentTimeRef) leastAcceptableTime = currentTime - config.period;
	else {
		if( dataPoints.length > 0 ) 
			leastAcceptableTime = dataPoints.at(-1).timestamp - config.period;
		else 
			leastAcceptableTime = newPoint.timestamp;
	}

	if( dataPoints.length == 0 ) {
		// Insert initial point
		dataPoints.push( newPoint );
	} else {
		// Insert concurrent point

		// Delete existing point
		dataPoints = dataPoints.filter( x => x.timestamp != newPoint.timestamp);

		// Find where to place it
		let [ id, r ] = prelookup1(newPoint.timestamp, dataPoints.map( x => x.timestamp), false );
		let insert_id = Math.min(0, Math.max(dataPoints.length), id + Math.ceil(r));

		//if( dataPoints.timestamp < leastAcceptableTime && )

		if( newPoint.timestamp < leastAcceptableTime && dataPoints[0].timestamp > leastAcceptableTime && newPoint.state != dataPoints[0].state ) {
			newPoint.timestamp = Math.max(leastAcceptableTime, newPoint.timestamp);
			dataPoints.splice(0,0,newPoint);
		}
	}
	
	
	return dataPoints;
}

module.exports = function (RED) {
	function HTML(config) {
		var data = JSON.stringify(config.initial);
		var sizes = JSON.stringify(config.stripe);
		var styles = String.raw`
		
		<style>
			.txt-{{unique}} {	
				font-size:1em;			
				fill: currentColor;											
			}	
			.txt-{{unique}}.small{
				font-size:0.7em;
			}
			.statra-{{unique}}.legend{
				cursor:pointer;
			}
			.statra-gradi-{{unique}}{
				width:${config.exactwidth}px;
				height:${config.stripe.height}px;
				position:absolute;
				top:${config.stripe.y}%;
			}								
		</style>`

		var layout = String.raw`		
			<svg preserveAspectRatio="xMidYMid meet" id="statra_svg_{{unique}}" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" ng-init='init(` + data + `,` + sizes + `)'>				
				<text ng-if="${config.height > 1}">
					<tspan  ng-if="${config.legend > 0}" id="statra_label_{{unique}}" class="txt-{{unique}}" text-anchor="middle" dominant-baseline="hanging" x=` + config.exactwidth / 2 + ` y="1%">
						` + config.label + `
					</tspan>
					<tspan  ng-if="${config.legend == 0}" id="statra_label_{{unique}}" class="txt-{{unique}}" text-anchor="middle" dominant-baseline="middle" x=` + config.exactwidth / 2 + ` y="25%">
						` + config.label + `
					</tspan>
				</text>	
				<g class="statra-{{unique}} legend" id="statra_legend_{{unique}}" ng-if="${(config.height > 1 && config.legend > 0)}" 
					style="outline: none; border: 0;" ng-click='toggle()'></g>	
				<text ng-if="${config.blanklabel != ""}" font-style="italic">
					<tspan id="statra_blank_{{unique}}" class="txt-{{unique}}" text-anchor="middle" dominant-baseline="hanging" 
						x=` + config.exactwidth / 2 + ` y="` + config.stripe.y + `%">` + config.blanklabel + `</tspan>
				</text>				
				<g class="statra-{{unique}} ticks" id="statra_ticks_{{unique}}" 
					style="outline: none; border: 0;"></g>								
			</svg>

			<div class="statra-gradi-{{unique}}" id=statra_gradi_{{unique}} ng-click='onClick($event)'></div>`
		
		return String.raw`${styles}${layout}`;
	}


	function checkConfig(node, conf) {
		if (!conf || !conf.hasOwnProperty("group")) {
			node.error(RED._("ui_statetrail.error.no-group"));
			return false;
		}
		return true;
	}

	var ui = undefined;

	function StateTrailNode(config) {
		try {
			var node = this;
			if (ui === undefined) {
				ui = RED.require("node-red-dashboard")(RED);
			}
			RED.nodes.createNode(this, config);
			var done = null;
			var range = null;
			var site = null;
			var getSiteProperties = null;
			var getPosition = null;
			var getTimeFromPos = null;
			var checkPayload = null;
			var validReferenceInArray = null
			var checkReference = null;
			var store = null;
			var generateGradient = null;
			var generateTicks = null;
			var getColor = null;
			var formatTime = null;
			var validType = null;
			var validObject = null;
			var storage = null;
			var references = null
			var storeInContext = null;
			var prepareStorage = null;
			var stroageSpace = null;
			var showInfo = null;
			var collectSummary = null;
			var getStateFromCoordinates = null;
			var generateOutMessage = null;
			var addToStore = null;
			var addToRef = null;
			var findDots = null;
			var isValidStateConf = null;
			var dots = [];
			var ctx = node.context()
			var currentTime = Date.now();

			if (checkConfig(node, config)) {
				checkPayload = function (input) {
					var ret = null
					if (Array.isArray(input)) {
						if (input.length == 0) {
							return []
						}
						if (input.every(ob => validObject(ob))) {
							return input
						} else {
							return []
						}
					}
					if (typeof input === 'object' && input !== null) {
						if (validObject(input)) {
							if (validType(input.state)) {
								ret = {
									state: input.state,
									timestamp: input.timestamp
								}
							}
						}
					} else {
						if (validType(input)) {
							ret = {
								state: input,
								timestamp: new Date().getTime()
							}
						}
					}
					return ret
				}

				checkReference = function (input,validPayload){
					if(!input){
						return null
					}
					//console.log("checkReference",input,validPayload)
					if (Array.isArray(validPayload)){
						if (input.every(ob => validReferenceInArray(ob))) {
							return input
						}
						else{
							return []
						}
					}else{
						if (Array.isArray(input)){
							// cant be array if payload isn't
							return null
						}
						else{
							if(input.hasOwnProperty("timestamp")){
								return input
							}
							else{
								return {
									data:input,
									timestamp:validPayload.timestamp
								}
							}
						}
					}
				}
				validReferenceInArray = function (input) {
					if (input == undefined) {
						return false
					}
					if (input.hasOwnProperty("timestamp")) {
						return true
					}
					return false
				}



				validObject = function (input) {
					if (input == undefined) {
						return false
					}
					if (input.hasOwnProperty('state') && input.hasOwnProperty("timestamp")) {
						return true
					}
					return false
				}
				validType = function (input) {
					for (var i = 0; i < config.states.length; i++) {
						if (config.states[i].state === input) {
							return true
						}
					}
					return false
				}
				isValidStateConf = function (input) {
					var hasAllProps = function (el) {
						return (
							typeof el === 'object' &&
							el !== null &&
							el.hasOwnProperty('state') &&
							el.hasOwnProperty('col') &&
							el.hasOwnProperty('t') &&
							el.hasOwnProperty('label'))
					}
					var e = 3
					if (Array.isArray(input)) {
						e--
						if (input.length > 1) {
							e--
							if (input.every(hasAllProps)) {
								e--
								var unique = [...new Set(input.map(s => s.state))]
								if (unique.length == input.length) {
									return true
								}
							}
						}
					}
					var err = ['States must be unique.',
						'State object must have all required properties.',
						'At least 2 states must be configured.',
						'Expected an array of objects.'
					]
					node.warn('Configuration for states is not valid! ' + err[e])
					return false
				}

				findDots = function () {
					dots = []
					if (storage.length < 2) {
						return
					}
					var total = storage[storage.length - 1].timestamp - storage[0].timestamp
					var safe = total / config.exactwidth / 2

					function checkDot(el, idx, arr) {
						if (idx > 0) {
							if (el.timestamp - arr[idx - 1].timestamp < safe) {
								dots.push({
									x: getPosition(arr[idx - 1].timestamp, config.insidemin, config.max),
									col: getColor(arr[idx - 1].state)
								})
							}
						}
					}
					storage.forEach(checkDot)
				}


				addToStore = function (s) {
					if( config.useCurrentTimeRef && s.timestamp > currentTime )
						return;

					s.timeStr = new Date(s.timestamp).toLocaleString("de-DE");
					if (storage.length > 0) {

						let [id, r] = prelookup1(s.timestamp, storage.map( x => x.timestamp), false );
						
						// Calculate preceding element index
						idp = Math.trunc(id + saturate(0,r,1));

						// Drop state if it does not change the view (i.e. state stays the same)
						if( r > 0 && s.state === storage[idp].state ) return;

						// Insert element in the right position, overwriting element with same timestamp
						r = saturate(0,r,2);
						let idxi = Math.min(storage.length, Math.ceil(r+id));
						let temp = [...storage];
						temp.splice(idxi,r==0 ? 1 : 0,s);

						//var temp = [...storage]
						//temp = temp.filter(el => el.timestamp != s.timestamp)
						//temp.push(s)
						//temp = temp.sort((a, b) => a.timestamp - b.timestamp)
						
						// Get index of inserted element
						//let idxi = temp.findIndex( x => x.timestamp == s.timestamp );

						// Drop state if it did not change. otherwise check following state if it can be dropped
						if( idxi > 0 && temp[idxi-1].state === s.state) {
							temp.splice(idxi,1);
						}
						else if( idxi < temp.length - 1 && temp[idxi+1].state == s.state ) {
							temp.splice(idxi+1,1);
						}

						
						let leastAcceptableTime = (config.useCurrentTimeRef ? currentTime : temp[temp.length - 1].timestamp) - config.period;
						//temp = temp.filter(el => el.timestamp > time);
						// Find first element that is within range of time domain
						let idxs = temp.findIndex( el => el.timestamp > leastAcceptableTime);

						// If feasible, set the element before that to start of domain to keep track of its value
						if( idxs > 1 ) {
							temp[idxs-1].timestamp = leastAcceptableTime;
							temp[idxs-1].timeStr = new Date(leastAcceptableTime).toLocaleString("de-DE");
						
							// Throw everyting else away
							temp = temp.slice(idxs-1);
						}

						storage = temp
					} else {
						storage.push(s);
					}

					config.min = storage[0].timestamp
					config.insidemin = config.min
					if (storage.length > 2) {
						config.insidemin = storage[1].timestamp
					}
					config.max = storage[storage.length - 1].timestamp
				}

				addToRef = function(r){
					references.push(r)
					var temp = [...references]					
					//console.log('ref before:',references,storage)
					function matchedTimestamp(r){
						var m = storage.find(e => e.timestamp == r.timestamp)
						if(m){
							return true
						}
						return false
					}
					temp = temp.filter(r => matchedTimestamp(r))
					//console.log('ref after filter:',temp)

					references = temp										
				}

				store = function (val,ref) {
					if (Array.isArray(val)) {
						if (val.length == 0) {
							storage = []
							references = []
							config.max = new Date().getTime()
							config.min = config.max - config.period
							storeInContext()
							return
						} else {
							storage = []
							val = val.sort((a, b) => a.timestamp - b.timestamp)
							val.forEach(s => addToStore(s))
							references = []
							if(ref){
								ref.forEach(r => addToRef(r))
							}							
						}
					} else {
						addToStore(val)
						if(ref){
							addToRef(ref)
						}						
					}

					showInfo()
					storeInContext()
				}

				collectSummary = function () {
					var ret = []
					if(storage.length == 0){
						return ret
					}
					var sum = {}
					var i
					var total = 0
					var z = 0
					var p = 0					
					var len = storage.length

					for (i = 0; i < len -1; i++) {										
						if(storage[i].end){
							z = storage[i].end - storage[i].timestamp
						}
						else{
							z = storage[i+1].timestamp - storage[i].timestamp
						}
						
						if(!sum[storage[i].state]){
							sum[storage[i].state] = 0
						}					
						sum[storage[i].state] += z						
					}
					total = storage[len - 1].timestamp - storage[0].timestamp
					for (i = 0; i < config.states.length; i++) {
						if(!sum[config.states[i].state]){
							sum[config.states[i].state] = 0
						}
						p = (100 * sum[config.states[i].state] / total)
						if (isNaN(p)) {
							p = 0
						}
						if (config.legend == 2 && p <= 0) {
							continue
						}
						if (config.legend == 3) {
							if (len < 1) {
								continue
							}
							if (config.states[i].state != storage[storage.length - 1].state) {
								continue
							}
						}
						p = p.toFixed(2) + "%"
						var n = config.states[i].label == "" ? config.states[i].state.toString() : config.states[i].label
						ret.push({
							name: n,
							col: config.states[i].col,
							val: formatTime(sum[config.states[i].state], true,'HH:mm:ss'),
							per: p
						})
					}
					return ret
				}

				getSiteProperties = function () {					
					var opts = {}
					opts.sizes = {sx: 48,sy: 48,gx: 4,gy: 4,cx: 4,cy: 4,px: 4,py: 4}
					opts.theme = {
						'widget-borderColor': {
							value: "#097479"
						}
					}
					if (typeof ui.getSizes === "function") {
						if(ui.getSizes()){
							opts.sizes = ui.getSizes();
						}
						if(ui.getTheme()){
							opts.theme = ui.getTheme();
						}
					}					
					return opts
				}
				range = function (n, p, a, r) {
					if (a == "clamp") {
						if (n < p.minin) {
							n = p.minin;
						}
						if (n > p.maxin) {
							n = p.maxin;
						}
					}
					if (a == "roll") {
						var d = p.maxin - p.minin;
						n = ((n - p.minin) % d + d) % d + p.minin;
					}
					var v = ((n - p.minin) / (p.maxin - p.minin) * (p.maxout - p.minout)) + p.minout;
					if (r) {
						v = Math.round(v);
					}
					return v
				}



				getColor = function (type) {
					for (var i = 0; i < config.states.length; i++) {
						if (config.states[i].state === type) {
							return config.states[i].col
						}
					}
					return 'black'
				}

				generateGradient = function () {
					var ret = []
					if (storage.length < 2) {
						return ret
					}

					// StartTimestamp
					let lastTimeInStore = storage.at(-1).timestamp;
					let endTime = (config.useCurrentTimeRef ? currentTime : lastTimeInStore + config.extendLastStateValue );
					let startTime = endTime - config.period;

					// Get colors
					let dataPoints = storage.map( x => {
						x.color = getColor(x.state);
						return x;
					});

					let interpPosition = (timestamp) => {
						return interp1(timestamp, [startTime, endTime], [0, 100], INTERP_TYPE_LINEAR, INTERP_EXTRAP_CLAMP, false);
					}

					// Create blank rectangle from beginning of horizon to first data point
					if( dataPoints[0].timestamp > startTime ) {
						ret.push({
							p: 0,
							c: getColor("undefined")
						});

						ret.push({
							p: interpPosition(dataPoints[0].timestamp),
							c: getColor("undefined")
						})
					}

					// Handle all points excluding last one
					for( i = 0; i < dataPoints.length - 1; i++ ) {
						let curPoint = dataPoints[i];
						let nextPoint = dataPoints[i+1];

						if( curPoint.timestamp > endTime ) break;

						ret.push({
							p: interpPosition(curPoint.timestamp),
							c: curPoint.color
						});

						ret.push({
							p: interpPosition(nextPoint.timestamp),
							c: curPoint.color
						});
					}

					// Handle last point
					{
						let lastPoint = dataPoints.at(-1);

						if( lastPoint.timestamp <= endTime ) 
						{
							ret.push({
								p: interpPosition(dataPoints.at(-1).timestamp),
								c: dataPoints.at(-1).color
							});

							ret.push({
								p: 100,
								c: dataPoints.at(-1).color
							});
						}
					}

					findDots()
					return ret
				}
				formatTime = function (stamp, utc, format) {
					var d = new Date(stamp);
					var hours = utc ? d.getUTCHours() : d.getHours();
					var minutes = d.getMinutes();
					var seconds = d.getSeconds();
					var f = format ? format : config.timeformat;
					var t
					switch (f) {
						case 'HH:mm:ss':
							t = hours.toString().padStart(2, '0') + ':' +
								minutes.toString().padStart(2, '0') + ':' +
								seconds.toString().padStart(2, '0');
							break;
						case 'HH:mm':
							t = hours.toString().padStart(2, '0') + ':' +
								minutes.toString().padStart(2, '0');
							break;
						case 'HH':
							t = hours.toString().padStart(2, '0')
							break;
						case 'mm:ss':
							t = minutes.toString().padStart(2, '0') + ':' +
								seconds.toString().padStart(2, '0');
							break;
						case 'mm':
							t = minutes.toString().padStart(2, '0');
							break;
						case 'ss':
							t = seconds.toString().padStart(2, '0');
							break;
						default:
							break;
					}
					return t
				}

				generateTicks = function () {
					//console.log(storage[1].timestamp - storage[0].timestamp, config.period)
					var ret = []
					if (storage.length < 2) {
						return ret
					}
					let endTime = (config.useCurrentTimeRef ? currentTime : storage.at(-1).timestamp + config.extendLastStateValue );
					let startTime = endTime - config.period;

					let interpPosition = (timestamp) => {
						return interp1(timestamp, [startTime, endTime], [0, 100], INTERP_TYPE_LINEAR, INTERP_EXTRAP_CLAMP, false);
					}

					var o
					var po
					var t
					var vis
					if (config.exactticks){
						for (let i = 0; i < storage.length; i++) {
							// Check if it starts exactly from the beginning. If so drop from ticks
							//if( i == 0 && storage[i].timestamp == startTime ) continue;
							t = storage[i].timestamp;
							po = interpPosition(t);
							o = {
								x: po,
								v: formatTime(t),
								id: i
							}
							ret.push(o)
						}	
					} else {
						var total = config.max - config.insidemin
						var step = (total / (config.tickmarks - 1))	
						for (let i = 0; i < config.tickmarks; i++) {
							t = storage[1].timestamp + (step * i)						
							po = getPosition(t, config.insidemin, config.max)							
							o = {
								x: po,
								v: formatTime(t),
								id: i								
							}
							ret.push(o)
						}		
					}
					return ret
				}

				prepareStorage = function () {
					var contextStores = RED.settings.get('contextStorage')
					if (contextStores == undefined) {
						return
					}
					if (Object.keys(contextStores).length === 0 && contextStores.constructor === Object) {
						return
					}
					for (var key in contextStores) {
						if (contextStores[key].hasOwnProperty('module')) {
							if (contextStores[key].module == 'localfilesystem') {
								stroageSpace = key
								return
							}
						}
					}
				}

				storeInContext = function (force) {
					if (stroageSpace == null) {
						return
					}
					if (force == true || config.persist == true) {
						ctx.set('stateTrailStorage', storage, stroageSpace)
						ctx.set('stateTrailReferences', references, stroageSpace)
						ctx.set('stateTrailMax', config.max, stroageSpace)
						ctx.set('stateTrailMin', config.min, stroageSpace)
					}
				}

				showInfo = function () {
					if (config.persist == false) {
						node.status({});
						return
					}
					if (stroageSpace == null) {
						node.status({
							fill: 'grey',
							shape: "ring",
							text: "store: N/A"
						});
						return
					}
					var total = storage.length + 2
					var f = total > 1000 ? "red" : total > 700 ? "blue" : total > 400 ? "yellow" : "green"
					var s = total > 200 ? "dot" : "ring"
					node.status({
						fill: f,
						shape: s,
						text: "store: " + stroageSpace + " count: " + total
					});
				}

				getPosition = function (target, min, max) {
					var p = {
						minin: min,
						maxin: max,
						minout: config.stripe.left,
						maxout: config.stripe.right
					}
					return range(target, p, 'clamp', false)
				}

				getTimeFromPos = function (pos, min, max) {
					var p = {
						minin: min,
						maxin: max,
						minout: config.insidemin,
						maxout: config.max
					}
					return range(pos, p, 'clamp', true)
				}

				getStateFromCoordinates = function (c) {
					if (c > config.stripe.mousemax || c < config.stripe.mousemin) {
						return null
					}
					if (storage.length == 0) {
						return null
					}
					var time = getTimeFromPos(c, config.stripe.mousemin, config.stripe.mousemax)
					var idx = -1 + storage.findIndex(function (state) {
						return state.timestamp > time;
					})
					if (idx == -1) {
						return null
					}
					var current = storage[idx]					
					var next = storage[idx + 1]
					var dur = next.timestamp - current.timestamp
					if(current.end){
						dur = current.end - current.timestamp
					}
					var end = current.end || next.timestamp
					
					var stateRef = config.states.find(s => s.state == current.state)
					var lab = "" 
					if(stateRef){
						lab = stateRef.label
					}
					var ret = {
						state: current.state,
						timestamp: current.timestamp,
						end: end,
						duration: dur,
						label: lab
					}
					return ret
				}

				generateOutMessage = function (evt) {
					var pl = getStateFromCoordinates(evt.targetX)
					delete evt.targetX
					var ret = {
						payload: pl,
						event: evt
					}
					var ref = references.find(el => el.timestamp == pl.timestamp)
					if(ref){
						ret.reference = ref
					}
					return ret
				}

				var group = RED.nodes.getNode(config.group);
				var site = getSiteProperties();
				if (config.width == 0) {
					config.width = parseInt(group.config.width) || 1
				}
				if (config.height == 0) {
					config.height = parseInt(group.config.height) || 1
				}
				config.width = parseInt(config.width)
				config.height = parseInt(config.height)
				config.exactwidth = parseInt(site.sizes.sx * config.width + site.sizes.cx * (config.width - 1)) - 12;
				config.exactheight = parseInt(site.sizes.sy * config.height + site.sizes.cy * (config.height - 1)) - 12;
				
				//config.useCurrentTimeRef = false;
				config.extendLastStateValue = 30*60*1000;
				config.extendLastStateType = "milliseconds"; // "percent" or "milliseconds"

				var sh = (site.sizes.sy / 2) + (site.sizes.cy * (config.height - 1)) - 6
				 if (config.height > 2){
					sh += ((config.height - 2) * (site.sizes.sy)) - (config.height - 2) * 3
				} 
				var sy = config.height == 1 ? 0 : Math.floor(1/config.height*100)
				if(config.height > 2){
					sy += site.sizes.cx 
				} 
				var leg = sy - (100 * 18 / config.exactheight)
				var dot = sy - (100 * 6 / config.exactheight)				
				var tyb = config.exactheight - (site.sizes.sy/10) 
				var tyt = tyb - 5
				var tybt = 99.5
				var edge = Math.max(config.timeformat.length, 6) * 4 * 100 / config.exactwidth
				config.stripe = {
					height: sh,
					x: 0,
					y: sy,
					left: edge,
					right: (100 - edge),
					tyt: tyt,
					leg:leg,
					tyb: tyb,
					tybt: tybt,
					dot: dot,
					padding: {
						hor: '6px',
						vert: (site.sizes.sy / 16) + 'px'
					}
				}
				//console.log(config.stripe)
				config.stripe.mousemin = config.stripe.left * config.exactwidth / 100
				config.stripe.mousemax = config.stripe.right * config.exactwidth / 100

				config.period = (parseInt(config.periodLimit) * parseInt(config.periodLimitUnit) * 1000) + 1000
				config.tickmarks = config.tickmarks || 4
				config.legend = parseInt(config.legend)

				prepareStorage()

				storage = (config.persist && stroageSpace != null) ? ctx.get('stateTrailStorage', stroageSpace) || [] : []
				references = (config.persist && stroageSpace != null) ? ctx.get('stateTrailReferences', stroageSpace) || [] : []
				config.max = (config.persist && stroageSpace != null) ? ctx.get('stateTrailMax', stroageSpace) || new Date().getTime() : new Date().getTime()
				config.min = (config.persist && stroageSpace != null) ? ctx.get('stateTrailMin', stroageSpace) || (config.max - config.period) : (config.max - config.period)
				config.insidemin = storage.length < 3 ? config.min : storage[1].timestamp

				storeInContext(true)

				config.bgrColor = site.theme['widget-borderColor'].value
				config.initial = {
					stops: generateGradient(),
					ticks: generateTicks(),
					legend: collectSummary(),
					dots: dots
				}

				var html = HTML(config);

				done = ui.addWidget({
					node: node,
					order: config.order,
					group: config.group,
					width: config.width,
					height: config.height,
					format: html,
					templateScope: "local",
					emitOnlyNewValues: false,
					forwardInputMessages: false,
					storeFrontEndInputAsState: true,

					beforeEmit: function (msg) {
						
						if (msg.control && msg.control.period) {
							config.period = parseInt(msg.control.period)
						}
						if (msg.control && msg.control.label) {							
							config.label = msg.control.label
						}
						if (msg.control && msg.control.states) {
							if (isValidStateConf(msg.control.states)) {
								config.states = msg.control.states
							}
						}
						if (msg.payload === undefined) {
							return {}
						}
						var validated = checkPayload(msg.payload)
						if (validated === null) {
							return {}
						}
						var reference = checkReference(msg.reference,validated)
						
						currentTime = Date.now();

						store(validated,reference)
						
						msg.payload = {
							stops: generateGradient(),
							ticks: generateTicks(),
							legend: collectSummary(),
							dots: dots,
							label:config.label
						}
						
						return {
							msg
						};
					},
					beforeSend: function (msg, orig) {
						try {
							if (!orig || !orig.msg) {
								return;
							}
							return generateOutMessage(orig.msg.clickevent);
						} catch (error) {
							node.error(error);
						}
					},
					initController: function ($scope) {
						$scope.unique = $scope.$eval('$id')
						$scope.svgns = 'http://www.w3.org/2000/svg';
						$scope.timeout = null
						$scope.legendvalues = ['name', 'val', 'per']
						$scope.legendvalue = 'name'
						$scope.legend = null
						$scope.sizes = null
						$scope.mouselock = 0

						$scope.init = function (data, sizes) {
							$scope.sizes = sizes
							//console.log('initial data',data.stops.length,data.legend.length)
							if(data.stops.length == 0 && data.legend.length == 0){
								updateBlankLabel()
								return
							}
							update(data)
						}

						$scope.onClick = function (e) {
							if ($scope.mouselock < 2) {
								return
							}
							if (e.originalEvent.offsetX < $scope.sizes.mousemin || e.originalEvent.offsetX > $scope.sizes.mousemax) {
								return
							}
							
							var bbc = e.originalEvent.target.getBoundingClientRect()
							var box = [bbc.left, bbc.bottom, bbc.right, bbc.top]
							var coord = {
								pageX: e.originalEvent.screenX,
								pageY: e.originalEvent.screenY,
								screenX: e.originalEvent.screenX,
								screenY: e.originalEvent.screenY,
								clientX: e.originalEvent.clientX,
								clientY: e.originalEvent.clientY,
								targetX: e.originalEvent.offsetX,
								bbox: box
							}
							$scope.send({
								clickevent: coord
							});
						}

						$scope.toggle = function () {
							var idx = $scope.legendvalues.indexOf($scope.legendvalue) + 1
							if (idx == $scope.legendvalues.length) {
								idx = 0
							}
							$scope.legendvalue = $scope.legendvalues[idx]
							if ($scope.legend != null) {
								updateLegend($scope.legend)
							}
						}

						var update = function (data) {
							//console.log("update",$scope.unique,data)
							var main = document.getElementById("statra_svg_" + $scope.unique);
							if (!main) {
								//console.log('no main',$scope.unique)
								$scope.timeout = setTimeout(update.bind(null, data), 40);
								return
							}
							$scope.timeout = null
							updateContainerStyle(main, $scope.sizes.padding)
							updateGradient(data.stops)
							updateTicks(data.ticks)
							updateLegend(data.legend)
							updateDots(data.dots)
							updateLabel(data.label)
							updateBlankLabel()
						}
						
						var updateLabel = function(label){
							if(!label){
								return
							}
							var el = document.getElementById("statra_label_" + $scope.unique);
							if (el) {
								$(el).text(label)
							}
						}

						var updateBlankLabel = function () {
							var el = document.getElementById("statra_blank_" + $scope.unique);
							if (el) {
								$(el).attr('visibility', $scope.mouselock > 1 ? 'hidden' : 'visible')
							}
						}

						var updateContainerStyle = function (el, padding) {
							el = el.parentElement
							if (el && el.classList.contains('nr-dashboard-template')) {
								if ($(el).css('paddingLeft') == '0px') {
									el.style.paddingLeft = el.style.paddingRight = padding.hor
									el.style.paddingTop = el.style.paddingBottom = padding.vert
								}
							}
						}

						var updateDots = function (dots) {
							if (!dots) {
								return
							}
							var g = document.getElementById("statra_dots_" + $scope.unique);
							if (!g) {
								return
							}
							if (g.children.length > 0) {
								while (g.firstChild) {
									g.removeChild(g.firstChild);
								}
							}
							var dot
							for (var i = 0; i < dots.length; i++) {
								dot = document.createElementNS($scope.svgns, 'circle');
								dot.setAttribute('id', 'statra_dot_' + $scope.unique + "_" + i)
								dot.setAttribute('cx', dots[i].x + '%');
								dot.setAttribute('cy', $scope.sizes.dot + '%');
								dot.setAttribute('r', '3');
								dot.setAttributeNS(null, 'fill', dots[i].col);
								document.getElementById("statra_dots_" + $scope.unique).appendChild(dot);
							}
						}

						var updateLegend = function (legend) {
							if (!legend) {
								return
							}
							var g = document.getElementById("statra_legend_" + $scope.unique);
							if (!g) {
								return
							}
							$scope.legend = legend
							if (g.children.length * 2 != $scope.legend.length) {
								while (g.firstChild) {
									g.removeChild(g.firstChild);
								}
							}
							var xp = 0
							if (g.children.length == 0) {
								var rect
								var txt
								for (var i = 0; i < legend.length; i++) {

									rect = document.createElementNS($scope.svgns, 'rect');
									rect.setAttributeNS(null, 'x', xp);
									rect.setAttributeNS(null, 'y', $scope.sizes.leg+'%');
									rect.setAttributeNS(null, 'height', '11');
									rect.setAttributeNS(null, 'width', '8');
									rect.setAttributeNS(null, 'fill', legend[i].col);
									rect.setAttribute('id', 'statra_rect_legend_' + $scope.unique + "_" + i)
									document.getElementById("statra_legend_" + $scope.unique).appendChild(rect);
									xp += rect.getBoundingClientRect().width + 5

									txt = document.createElementNS($scope.svgns, 'text');
									txt.setAttributeNS(null, 'x', xp);
									txt.setAttributeNS(null, 'y', $scope.sizes.leg+'%');
									txt.setAttributeNS(null, 'dominant-baseline', 'hanging');
									txt.setAttributeNS(null, 'fill', legend[i].col)
									txt.setAttribute('class', 'txt-' + $scope.unique + ' small')
									txt.setAttribute('id', 'statra_txt_legend_' + $scope.unique + "_" + i)
									txt.textContent = legend[i][$scope.legendvalue]
									document.getElementById("statra_legend_" + $scope.unique).appendChild(txt);
									xp += txt.getBoundingClientRect().width + 5
								}
							} else {
								var xp = 0
								var el
								for (var i = 0; i < legend.length; i++) {
									el = document.getElementById("statra_rect_legend_" + $scope.unique + "_" + i)
									if (el) {
										$(el).attr("fill", legend[i].col)
										$(el).attr("x", xp)
										xp += el.getBoundingClientRect().width + 5
									}
									el = document.getElementById("statra_txt_legend_" + $scope.unique + "_" + i)
									if (el) {
										$(el).text(legend[i][$scope.legendvalue]);
										$(el).attr("x", xp)
										xp += el.getBoundingClientRect().width + 5
									}
								}
							}
						}

						var updateGradient = function (stops) {
							var gradient = document.getElementById("statra_gradi_" + $scope.unique);
							$scope.mouselock = stops.length
							if (gradient) {
								const perChunk = 9
      							const result = stops.reduce((resultArray, item, index) => {
										const chunkIndex = Math.floor(index/perChunk)									
										if(!resultArray[chunkIndex]) {
											resultArray[chunkIndex] = [] // start a new chunk
										}									
										resultArray[chunkIndex].push(item)									
										return resultArray
									}, []
								)

								function getBgr(inp){
									let bg = "linear-gradient(to right, "
									let last = 0									
									inp.forEach(e => {
										bg += e.c+" "+e.p+"%"+ ", "
										last = e.p
									})
									bg +="transparent "+last+"%"
									
									bg += "), ";
									return bg
								}

								let bgrstring = ""
								result.forEach(e => {
									bgrstring += getBgr(e)
								})

								bgrstring = bgrstring.slice(0, -2);
								gradient.style.background = bgrstring
							}
						}
						var updateTicks = function (times) {
							var len = times.length						
							var g = document.getElementById("statra_ticks_" + $scope.unique);
							if (!g) {
								return
							}
							if (g.children.length > 0) {
								while (g.firstChild) {
									g.removeChild(g.firstChild);
								}
							}
							var tick
							var txt

							for (let i = 0; i < len; i++) {

								tick = document.createElementNS($scope.svgns, 'line');
								tick.setAttribute('id', 'statra_tick_' + $scope.unique + "_" + i)
								tick.setAttributeNS(null, 'x1', times[i].x + "%");
								tick.setAttributeNS(null, 'x2', times[i].x + "%");
								tick.setAttributeNS(null, 'y1', $scope.sizes.tyt);
								tick.setAttributeNS(null, 'y2', $scope.sizes.tyb);
								tick.setAttributeNS(null, 'style', "stroke:currentColor;stroke-width:1");
								tick.setAttributeNS(null, 'visibility', times[i].x == 0 ? 'hidden':'visible');
								g.appendChild(tick);

								txt = document.createElementNS($scope.svgns, 'text');
								txt.setAttribute('id', 'statra_tickval_' + $scope.unique + "_" + i)
								txt.setAttributeNS(null, 'x', times[i].x + "%");
								txt.setAttributeNS(null, 'y', $scope.sizes.tybt + "%");
								txt.setAttributeNS(null, 'dominant-baseline', 'baseline');
								txt.setAttributeNS(null, 'text-anchor', 'middle');								
								txt.setAttribute('class', 'txt-' + $scope.unique + ' small statra_tickval_' + $scope.unique)
								txt.setAttributeNS(null, 'visibility', times[i].x == 0 ? 'hidden':'visible');
								
								txt.textContent = times[i].v
								g.appendChild(txt);
							}

							clearOverlap()							
						}

						var clearOverlap = function(){
							let values = document.querySelectorAll('.statra_tickval_'+ $scope.unique)
							let rectas = []
							Array.from(values).forEach((el,i) => {								
								rectas.push({idx:i,box:el.getBBox()})
							})
							//console.log(rectas)
							rectas.sort((a, b) => {
								return b.box.x - a.box.x;
							})
							let last = Number.MAX_SAFE_INTEGER;
							rectas.forEach((r,i) => {
								//console.log(r.idx, r.box.x + r.box.width, last)
								if(r.box.x + r.box.width >= last){
									//console.log("cut",r.idx)
									var tick = document.getElementById("statra_tick_" + $scope.unique + "_" + r.idx);								
									if (tick ) {
										$(tick).remove()
									}
									tick = document.getElementById("statra_tickval_" + $scope.unique + "_" + r.idx);
									if (tick) {
										$(tick).remove()
									}									
								}
								else{
									last = r.box.x - 2 ;
								}
							})	
						}

						$scope.$watch('msg', function (msg) {
							if (!msg) {
								return;
							}
							if (msg.payload) {
								//console.log('msg',$scope.unique,msg.payload)
								update(msg.payload)
							}
						});
						$scope.$on('$destroy', function () {
							if ($scope.timeout != null) {
								clearTimeout($scope.timeout)
								$scope.timeout = null
							}
						});
					}
				});
			}
		} catch (e) {
			console.log(e);
		}
		node.on("close", function () {
			if (done) {
				done();
			}
		});
	}
	RED.nodes.registerType("ui_statetrail", StateTrailNode);
};