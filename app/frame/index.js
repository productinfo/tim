const electron = require('electron');
const shell = electron.shell;
const session = electron.remote.session;
const readFile = require('fs').readFileSync;
const $ = require('../util');
const realnames = require('../realnames');
const search = require('../search');
const Config = require('electron-config');
const config = new Config();
const swiping = require('./swiping');
const args = electron.remote.getGlobal('appArgs');
const EVENT = require('../db/events');


const wpjs = `file://${__dirname}/webview.js`;
const wpcss = `${__dirname}/webview.css`;

const ses = session.fromPartition('persist:github');

let webview, isReady = false, lastUrl = '';

const webviewHandlers = {
	documentClicked: () => $.trigger(EVENT.document.clicked),
	externalLinkClicked: url => shell.openExternal(url),
	showLinkMenu: url => $.trigger('show-link-menu', url),
	showImgMenu: url => $.trigger('show-img-menu', url),
	isLogged: itIs => {
		if (itIs) return;
		$.trigger(EVENT.notifications.toggle, false);
		if (!config.get('baseUrl')) $.trigger(EVENT.settings.show);
	},
	linkClicked: loadingStart,
	docReady: injectCss,
	domChanged: onRendered,
};

const menuClickHandlers = {
	'toggle-main-frame-devtools' () {
		if (webview[0].isDevToolsOpened()) webview[0].closeDevTools();
		else webview[0].openDevTools();
	},
	'clear-cookies' () {
		config.clear();
		webview[0].clearHistory();
		ses.clearStorageData(webviewHandlers.isLogged);
	},
	'find-in-page' () { search.start(webview[0]); }
};

const gotoActions = {
	prev: () => {
		if (webview[0].canGoBack()) {
			loadingStart();
			setTimeout(() => { webview[0].goBack(); }, 400);
		}
	},
	next: () => {
		if (webview[0].canGoForward()) {
			loadingStart();
			setTimeout(() => { webview[0].goForward(); }, 400);
		}
	},
	refresh: () => { loadingStart(); setTimeout(() => { webview[0].reload(); }, 400); },
	stop: () => { webview[0].stop(); loadingStop(); }
};


function isValidUrl (url) {
	let urlt;
	try { urlt = new URL(url); }
	catch (e) { urlt = null; }
	return urlt;
}



function initialURL (initial) {
	if (initial && args) {
		const url = isValidUrl(args.pop());
		if (url) return url;
	}
	if (initial && config.get('state.url')) return config.get('state.url');
	return `${config.get('baseUrl')}login`;
}


function injectCss () {
	let css;
	try { css = readFile(wpcss, 'utf8'); } catch (e) { css = ''; }
	webview[0].send('injectCss', css);
}


function onMenuClick (target) {
	if (menuClickHandlers[target]) menuClickHandlers[target]();
}

function gotoUrl (url) {
	search.stop();
	if (typeof url !== 'string' || !url.length || !webview.length) return;
	if (url in gotoActions) gotoActions[url]();
	else if (webview[0].loadURL) {
		loadingStart();
		webview[0].loadURL(url);
	}
}


function onNavigationStart () {
	config.set('state.url', webview[0].getURL());
	$.trigger(EVENT.url.change.done, webview[0]);
}

function onNavigationEnd () {}

function onNavigationError (er) {
	if (er.errorDescription === 'ERR_NAME_NOT_RESOLVED') $.trigger(EVENT.connection.error.show);
	else console.log(er);
}

function onRendered (url, issue) {
	if (issue.url.indexOf('#') > -1) issue.url = issue.url.substr(0, issue.url.indexOf('#'));

	config.set('state.url', url);
	config.set('state.issue', issue);
	$.trigger(EVENT.url.change.done, webview[0], issue);
	realnames.replace(webview[0]);
	setTimeout(loadingStop, 100);
}

function loadingStart () {
	webview.addClass('loading');
	$.trigger(EVENT.url.change.start);
}

function loadingStop () {
	const newUrl = webview[0].getURL();
	webview.removeClass('loading');
	$.trigger(EVENT.url.change.end);
	if (lastUrl !== newUrl) webview[0].focus();
	lastUrl = newUrl;
}


function init () {
	if (isReady) return;

	const frame = $('#frame');
	const html = `<webview id="webview" class="loading" preload="${wpjs}"
		src="${initialURL(true)}" partition="persist:github"></webview>`;

	frame.html(html);
	webview = frame.find('#webview');


	webview.on('focus', () => $.trigger(EVENT.frame.focused));
	webview.on('will-navigate', gotoUrl);
	webview.on('did-navigate-in-page', onNavigationStart);
	webview.on('dom-ready', onNavigationEnd);
	webview.on('did-fail-load', onNavigationError);
	webview.on('ipc-message', function (ev) {
		const fn = webviewHandlers[ev.channel];
		if (typeof fn === 'function') fn.apply(fn, ev.args);
	});


	// DEBUG
	// webview.on('console-message', e => { console.log('WV:', e.message); });


	$.on(EVENT.frame.goto, gotoUrl);
	$.on(EVENT.menu.click, onMenuClick);
	$.on(EVENT.settings.changed, () => gotoUrl(initialURL()));

	swiping(frame, webview);

	isReady = true;
}


module.exports = {
	init
};
