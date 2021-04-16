const libSocketIO = require('socket.io-client');
const fs = require('fs');
const blake: (input: string) => string = require('blakejs').blake2sHex;
const pathslash = (process.platform === 'win32') ? '\\' : '/';
const mime = require('mime-types').contentType
const open_file_options = [
	'index.html',
	'index.htm',
	pathslash + 'index.html',
	pathslash + 'index.htm'
];
const BAD = 'Bad Gateway';
import fetch from "node-fetch";

let insSocketIO: any;
let sites: {
	[domain: string]: {
		[path: string]: {
			listener?: Listener;
			file?: string;
		}
	}
} = {};

type ListenerResponse = string | Buffer | {
	statusCode?: number;
	body?: string|Buffer;
	head?: {
		[header: string]: string;
	}
}

type Listener = (request: NodeSiteRequest) => ListenerResponse | Promise<ListenerResponse>

const deferred_challenges: Function[] = [];
let solving = false;

const solved: {
	[site: string]: string;
} = {};
const solve = async function solveChallenge(site: string, code: string) {
	if (solving) {
		deferred_challenges.push(() => solve(site, code));
		return;
	}
	if (solved[code]) {
		insSocketIO.emit('submit_challenge', site, solved[code]);
		return;
	}
	solving = true;
	let p = 0,
		o = (16 ** code.length) / 32,
		i = 0;
	let nonce = code + site;
	let nonceb: string;
	while ((nonceb = (blake(nonce))).substr(0, code.length) !== code.substr(0, code.length)) {
		for (let i = 0;
			(i < o) && ((nonceb = (blake(nonce))).substr(0, code.length) !== code.substr(0, code.length));
			++i
		) {
			nonce = code + nonceb;
		}
		process.stdout.write("\r" + site + " loading " + ++p + "%");
	}
	while (p < 100) {
		await new Promise(c => setTimeout(c, 30));
		process.stdout.write("\r" + site + " loading " + ++p + "%");
	}
	solved[code] = nonce;
	insSocketIO.emit('submit_challenge', site, nonce);
	if (deferred_challenges.length) {
		setTimeout(() => {
			solving = false;
			let fun = deferred_challenges.pop();
			if (typeof fun === 'function') fun();
		}, 300);
	} else solving = false;
}

let init = async function initializeSocket() {
	if (insSocketIO) insSocketIO.removeAllListeners();
	const port = await fetch('https://nodesite.eu/get_port', {}).then((r) => r.text());
	insSocketIO = libSocketIO('wss://nodesite.eu:' + port);
	insSocketIO.on('connect', redo);
	insSocketIO.on('error', redo);
	insSocketIO.on('death', redo);
	insSocketIO.on('disconnect', redo);
	insSocketIO.on('deauth', (site: string) => insSocketIO.emit('new_challenge_if_unauthed', site));
	insSocketIO.on('invalid_challenge', (site: string) => insSocketIO.emit('get_challenge', site));
	insSocketIO.on('challenge_failed', (site: string) => insSocketIO.emit('get_challenge', site));
	insSocketIO.on('set_challenge', solve);
	insSocketIO.on('challenge_success', (site: string) => process.stdout.write("\rListening on https://" + site + "\n"));
	insSocketIO.on('request', requestHandlerProxy);
	insSocketIO.on('io', IOListener.receive);
	insSocketIO.on('ctos-ping', (id: number) => insSocketIO.emit('stoc-ping', id));
}

let redo = async function reconnectAll() {
	for (const n in sites) {
		insSocketIO.emit('get_challenge', n);
	}
}

interface NodeSiteRequest {
	iid: number,
	host: string,
	method: string,
	uri: string,
	body: string | Buffer,
	head: NodeSiteRequestHeaders
}

interface NodeSiteRequestHeaders {
	host: string,
	connection?: string,
	'user-agent'?: string,
	accept?: string,
	'sec-fetch-site'?: string,
	'sec-fetch-mode'?: string,
	'sec-fetch-dest'?: string,
	referer?: string,
	'accept-encoding'?: string,
	'accept-language'?: string
}

const requestHandlerProxy = async (request: NodeSiteRequest) => {
	let response = await requestHandler(request);
	if (response == BAD) return;
	if ((typeof response !== 'object') || (response instanceof Uint8Array)) {
		response = ({
			body: response
		});
	}
	insSocketIO.emit('response', request.iid, response);
}

const requestHandler = async (request: NodeSiteRequest) => {
	let site = sites[request.host];
	if (!site) {
		if (!(site = sites['*'])) return BAD;
	}
	let path = ((request.uri.split('?').shift()) + '/').replace(/\.\.+/, '.').replace(/[\/\\]+/g, '/').split('/');
	let localpath = [];
	while (path.length) {
		localpath.unshift(path.pop());
		if (!localpath[localpath.length - 1]) localpath.pop();
		let tpath = path.join('/') || '/';
		let lpath = localpath.join(pathslash);
		let sf = site[tpath];
		if (sf) {
			if (sf.file) {
				if (fs.existsSync(sf.file)) {
					let f = sf.file;
					let stat = fs.statSync(f);
					if (stat.isDirectory()) {
						if (fs.existsSync(f + lpath) && !fs.statSync(f + lpath).isDirectory()) {
							return fileReadHandler(f + lpath);
						}
						if (fs.existsSync(f + pathslash + lpath) && !fs.statSync(f + pathslash + lpath).isDirectory()) {
							return fileReadHandler(f + pathslash + lpath);
						}
						for (const o in open_file_options) {
							if (fs.existsSync(f + open_file_options[o])) {
								return fileReadHandler(f + open_file_options[o]);
							}
						}
					} else {
						return fileReadHandler(f);
					}
				}
			}
			if (sf.listener) {
				return await sf.listener(request);
			}
		}
	}
	return {
		statusCode: 404
	}
}

const fileReadHandler = function readFileAndConvertIntoResponse(file: string) {
	let data = fs.readFileSync(file);
	let head = {
		'Content-Type': mime(file.split(/[\\\/]+/).pop()),
		'Content-Length': data.length
	}
	let body = data;
	return {
		head,
		body
	};
}

const IOListener: {
    (cb: Function): void;
    socketListeners: Function[];
    registerSocketListener(cb: Function): void;
    newsocket(id: any): NodeSiteClientSocket;
    sockets: {
		[iid: number]: NodeSiteClientSocket;
	};
    receive(id: number, site: string, e: string, args: Array<any>): Promise<void>;
} = function NodeSiteIOListener(cb: Function) {
	IOListener.registerSocketListener(cb);
}

IOListener.socketListeners = Array<Function>();
IOListener.registerSocketListener = (cb: Function) => {
	IOListener.socketListeners.push(cb);
}

interface NodeSiteClientSocket {
	(...args: Array<any>): void;
	id: any;
	send(...args: Array<any>): void;
	listeners: {
		[e: string]: {
			perm: Function[];
			once: Function[];
		}
	};
	listenersAny: Function[];
	onAny(f: Function): number;
	on(event: string, cb: Function, once: boolean): NodeSiteClientSocket;
	once(event: string, cb: Function): NodeSiteClientSocket;
	emit: (...args: Array<any>) => void;
	write: (...args: Array<any>) => void;
	receive(e: string, args?: any[]): Promise<void>;
}

IOListener.newsocket = function createSocket(id) {
	const socket: NodeSiteClientSocket = function (...args: Array<any>) {
		args.unshift('message');
		socket.send.apply(null, args);
	};
	socket.id = id;
	socket.send = function send(...args: Array<any>) {
		insSocketIO.emit('stoc', socket.id, args);
	};
	socket.listeners = {};
	socket.listenersAny = Array<Function>();
	socket.onAny = (f: Function) => socket.listenersAny.push(f);
	socket.on = (event: string, cb: Function, once: boolean) => {
		if (!socket.listeners[event]) {
			socket.listeners[event] = {
				perm: [],
				once: [],
			}
		}
		if (once) {
			socket.listeners[event].once.push(cb);
		} else {
			socket.listeners[event].perm.push(cb);
		}
		return socket;
	};
	socket.once = (event: string, cb: Function) => socket.on(event, cb, true);
	socket.emit = socket.write = socket.send;
	socket.receive = async (e: string, args = []) => {
		if (socket.listeners[e]) {
			if (socket.listeners[e].once.length) {
				for (const n in socket.listeners[e].once) {
					if (typeof socket.listeners[e].once[n] === 'function') {
						await socket.listeners[e].once[n].apply(null, args);
					}
				}
				socket.listeners[e].once = [];
			}
			if (socket.listeners[e].perm.length) {
				for (const n in socket.listeners[e].perm) {
					if (typeof socket.listeners[e].perm[n] === 'function') {
						await socket.listeners[e].perm[n].apply(null, args);
					}
				}
			}
		}

		if (socket.listenersAny.length) {
			args.unshift(e);
			for (const n in socket.listenersAny) {
				if (typeof socket.listenersAny[n] === 'function') {
					await socket.listenersAny[n].apply(null, args);
				}
			}
		}
	}
	return socket;
}
IOListener.sockets = {};
IOListener.receive = async (id: number, site: string, e: string, args: Array<any>) => {
	if (!IOListener.sockets[id]) {
		IOListener.sockets[id] = IOListener.newsocket(id);
		for (const n in IOListener.socketListeners) {
			await IOListener.socketListeners[n](IOListener.sockets[id], site);
		}
	}
	IOListener.sockets[id].receive(e, args || []);
}


const NodeSiteClient = function NodeSiteClient(domain: string, path: string = '/', listener?: Listener, file: string = '') {
	domain = domain.toLowerCase().replace(/[^a-z0-9\-\.]/g, '');
	domain = domain.match(/[^a-z0-9\-]/) ? domain : domain + '.nodesite.eu';
	if (!sites[domain]) {
		sites[domain] = {};
		if (insSocketIO) {
			insSocketIO.emit('get_challenge', domain);
		} else {
			init();
		}
	}
	let site = sites[domain];
	site[path] = {
		listener,
		file,
	}
}

export const proxy = NodeSiteClient.proxy = function createProxy(hostListen: string, hostPath = '/', urlPoint = 'localhost:8080', fetchOptions = {}) {
	return NodeSiteClient(hostListen, hostPath || '/', async (request: NodeSiteRequest) => {
		let uri = urlPoint + request.uri;
		uri = uri.replace('/\/+/', '/');
		const res = await fetch(uri, fetchOptions);
		let head: {
			[header: string]: string;
		} = {};
		for (const c in res.headers.keys()) {
			const h = res.headers.get(c);
			if (h) {
				head[c] = h;
			}
		}
		return {
			head,
			body: await res.buffer()
		};
	});
}

NodeSiteClient.create = NodeSiteClient;
NodeSiteClient.init = init;
NodeSiteClient.sites = sites;
NodeSiteClient.redo = redo;
NodeSiteClient.io = IOListener;

NodeSiteClient.IOListener = IOListener;
NodeSiteClient.NodeSiteClient = NodeSiteClient;
export const { create, io } = NodeSiteClient;

export {
	NodeSiteClient,
	init,
	sites,
	redo,
	IOListener
}

export function rawwrite (...args: any[]) {
	insSocketIO.emit(...args);
}
NodeSiteClient.rawwrite = rawwrite;

export {
	blake,
	deferred_challenges,
	open_file_options,
	requestHandlerProxy,
	solved,

	Listener,
	ListenerResponse,
	NodeSiteClientSocket,
	NodeSiteRequest,
	NodeSiteRequestHeaders,
}

Object.assign(NodeSiteClient, {
	blake,
	deferred_challenges,
	open_file_options,
	requestHandlerProxy,
	solved,
});

export default NodeSiteClient;
module.exports = NodeSiteClient;
