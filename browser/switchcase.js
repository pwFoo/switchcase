(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
(function() {
	"use strict"
	const matches = (value,pattern,functional,routing) => {
		const type = typeof(value);
		if(typeof(pattern)!=="object" && type!=="object") {
			if(value===pattern) return true;
			if(routing && type==="string" && typeof(pattern)==="string") {
				const pparts = pattern.split("/"),
					vparts = value.split("/");
				if(pparts[0]==="") pparts.shift();
				if(vparts[0]==="") vparts.shift();
				let part;
				if(pparts.length!==vparts.length) {
					return false;
				}
				while(pparts.length>0) {
					const ppart = pparts.shift(),
						vpart = vparts.shift();
					if(ppart[0]===":") {
						if(!routing.params) {
							routing.params = {};
						}
						let value = vpart;
						try {
							value = JSON.parse(value);
						} catch(e) {
							true;
						}
						routing.params[ppart.substring(1)] = value;
					} else if(vpart!==ppart) {
						return false;
					}
				}
				return true;
			}
		}
		if(pattern instanceof Date) {
			if(value instanceof Date) {
				return pattern.getTime()===value.getTime();
			}
			return false;
		}
		if(pattern instanceof RegExp) {
			if(["boolean","number","string"].includes(type)) {
				return pattern.test(value);
			}
			return false;
		}
		if(pattern instanceof Function) {
			return !!pattern(value);
		}
		return Object.keys(pattern).every(key => {
			let pvalue = pattern[key],
				ptype = typeof(pvalue),
				test = value => value===pvalue;
			if(ptype==="undefined" || (pvalue && ptype==="object" && Object.keys(pvalue).length===0)) {
				return true;
			}
			if(key.startsWith("/")) {
				const i = key.lastIndexOf("/");
				if(i>0) {
					try {
						const regexp = new RegExp(key.substring(1,i),key.substring(i+1));
						test = key => regexp.test(key);
					} catch(e) {
					true;
					}
				}
			} else if(key.includes("=>")) {
				try {
					test = Function("return " + key)();
				} catch(e) {
					true;
				}
			}
			return Object.keys(value).every(vkey => {
				let vtest = () => vkey===key;
				if(vkey.startsWith("/")) {
					const i = vkey.lastIndexOf("/");
					if(i>0) {
						try {
							const regexp = new RegExp(vkey.substring(1,i),vkey.substring(i+1));
							vtest = regexp.test(key);
						} catch(e) {
						true;
						}
					}
				} else if(vkey.includes("=>")) {
					try {
						vtest = Function("return " + vkey)();
					} catch(e) {
						true;
					}
				}
				if(test(vkey) || vtest()) {
					const vvalue = value[vkey],
						vtype = typeof(vvalue);
					if(functional && ptype==="function") {
						return pvalue(vvalue);
					}
					if(pvalue && ptype==="object" && vtype==="object") {
						return vvalue ? matches(vvalue,pvalue,functional) : false;
					}
					return pvalue===vvalue;
				}
				return true;
			});
		})
	},
	deepFreeze = (data) => {
		if(data && typeof(data)==="object") {
			Object.freeze(data);
			Object.keys(data).forEach(key => deepFreeze(data[key]));
		}
		return data;
	},
	getPath = (object) => {
		if(object.path) {
			return object.path;
		}
		if(object.location && object.location.pathname) {
			return object.path = object.location.pathname;
		}
		if(object.url || object.URL || object.newURL) {
			if(!object.location) {
				object.location = new URL(object.url || object.URL || object.newURL);
			}
			if(object.location.pathname) {
				return object.path = object.location.pathname;
			}
			return object.path = new URL(object.url || object.URL || object.newURL).pathname;
		}
	}
	function switchcase(cases={},defaults={}) {
		let switches = [];
		if(defaults && typeof(defaults)!=="object") {
			defaults = {strict:defaults};
		}
		if(Array.isArray(cases)) {
			switches = cases.map(([test,result]) => [deepFreeze(test),result]);
		} else {
			Object.keys(cases).forEach((key) => {
				let test = key;
				try {
					test = Function("return " + key)();
				} catch(e) { true; }
				switches.push([test,cases[key]]);
			});
		}
		const switcher = (value,options={}) => {
			delete options.pathRouter;
			delete options.continuable;
			options = Object.assign({},defaults,options);
			if(options.pathRouter) options.continuable = true;
			if(options.continuable) options.call = true;
			let target = value,
				setParams;
			if(options.pathRouter) {
				const type = typeof(options.pathRouter.route);
				if(type==="function") {
					target = options.pathRouter.route(value)
				} else if(type==="string") {
					target = value[options.pathRouter.route]
				} else if(value.req) {
					target = getPath(value.req);
				} else if(value.request) {
					target = getPath(value.request);
				} else {
					target = getPath(value);
				}
				setParams = options.pathRouter.setParams;
				if(!setParams) {
					setParams = (value,params) => {
						if(value.req) {
							value.req.params = Object.assign({},value.req.params,params);
						} else if(value.request) {
							value.request.params = Object.assign({},value.request.params,params);
						} else {
							value.params = Object.assign({},value.params,params);
						}
					}
				}
			}
			const routing = options.pathRouter ? {} : null;
			for(let item of switches) {
				const key = item[0],
					type = typeof(key);
				if((key && (type==="object" || routing) && matches(target,key,options.functionalMatch,routing))
					  || (type==="function" && key(target)) 
						|| (options.strict && key===target) 
						|| (!options.strict && key==target))	{
					let result = item[1];
					if(typeof(result)==="function" && options.call) {
						if(setParams && routing.params) {
							setParams(value,routing.params);
						}
						const resolved = result(value);
						if(resolved!==undefined || !options.continuable) return resolved;
						if(options.continuable) continue;
						result = resolved;
					}
					return result;
				}
			} 
			return options.call && typeof(switcher.otherwise)==="function" ? switcher.otherwise(value) : switcher.otherwise; 
		};
		switcher.otherwise = cases.default;
		switcher.case = (test,value) => {
			switches.push([test,value]);
			return switcher;
		};
		switcher.default = (value) => {
			switcher.otherwise = value;
			return switcher;
		};
		switcher.match = (value) => switcher(value);
		return switcher;
	}
	if(typeof(module)!=="undefined") {
		module.exports = switchcase;
	} 
	if(typeof(window)!=="undefined") {
		window.switchcase = switchcase;
	}
}());
},{}]},{},[1]);
