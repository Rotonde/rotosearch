"use strict";
let queue = [];
let knownPortals = {};
let loadedPortals = {};
let attempts = 0;
let portals = [];
let results = [];
let status = {};

function getID(id) { return document.getElementById(id); }

function countValue(o, v) {
	let count = 0;
	for(let k in o) {
		if(o[k]==v) { ++count; }
	}
	return count;
}

function userCount() {
	return countValue(status, "found");
}

function fetching() {
	return countValue(status, "fetching");
}

function missCount() {
	return countValue(status, "error");
}

function addPortal(portal) {
	if(loadedPortals[portal.dat]) { return; }
	loadedPortals[portal.dat] = portal;
	portals.push(portal);
	getID("portal-count").innerHTML = userCount();
}

async function cleanURL(url) {
	url = url.trim();
	while(url[url.length-1] == '/') {
		url = url.slice(0, -1);
	}
	return 'dat://'+(await DatArchive.resolveName(url)) + '/';
}

async function loadSite(url) {
	if(loadedPortals[url]) return;
	status[url] = "fetching";
	++attempts;
	try {
		getID("fetch-count").innerHTML = fetching();
		let archive = new DatArchive(url);
		let data = await archive.readFile('/portal.json');
		status[url] = "found";
		let portal = JSON.parse(data);
		addPortal(portal);
		for(let i=0; i<portal.port.length; ++i) {
			let p = await cleanURL(portal.port[i]);
			if(!knownPortals[p]) {
				knownPortals[p] = true;
				queue.push(p);
			}
		}
	} catch(err) {
		getID("fetch-count").innerHTML = fetching();
		status[url] = "error";
	}
}

function escapeHTML(m)
{
	return m
	.replace(/&/g, "&amp;")
	.replace(/</g, "&lt;")
	.replace(/>/g, "&gt;")
	.replace(/"/g, "&quot;")
	.replace(/'/g, "&#039;");
}

function addResult(portal, message) {
	let li = document.createElement('li');
	li.innerHTML = `<a href="${portal.dat}">@${portal.name}</a>: ${escapeHTML(message)}`;
	getID("results").appendChild(li);
}

function tick() {
	while(queue.length > 0) {
		let url = queue.shift();
		loadSite(url).catch((e)=> {
			console.log(e);
		});
	}
	requestAnimationFrame(tick);
}

async function loadSites() {
	let sitesList = new DatArchive(window.location.toString());
	let data = await sitesList.readFile("/sites");
	let lines = data.split('\n');
	
	for(let l of lines) {
		l = l.trim();
		if(l == '' || l[0] != '@') {
			continue;
		}
		let c = 0;
		while(c < l.length && l[c] != ' ') {
			++c;
		}
		while(c < l.length && l[c] == ' ') {
			++c;
		}
		let url = await cleanURL(l.substring(c));
		queue.push(url);
	}
}

async function main() {
	await loadSites();
	tick();
	
	getID("search-form").onsubmit = (e)=>{
		e.preventDefault();
		let time = Date.now();
		getID("results").innerHTML = '';
		results = [];
		let pattern = getID("search").value;
		for(let i=0; i<portals.length; ++i) {
			let p = portals[i];
			try {
				for(let post of p.feed) {
					if(!post.whisper && post.message.match(new RegExp(pattern, 'i')) && post.timestamp < time) {
						results.push({portal:p, post:post});
					}
				}
			} catch(e) { console.log(e); }
		}
		results.sort((l, r)=>{ return r.post.timestamp - l.post.timestamp; });
		for(let r of results) {
			addResult(r.portal, r.post.message);
		}
	};
}

main()
