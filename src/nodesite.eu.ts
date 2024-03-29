import { getRegistry } from '@prokopschield/registry';
import { blake2sHex as blake } from 'blakets';
import { getConfig } from 'doge-config';
import * as POW from 'doge-pow';
import fs from 'fs';
import { OutgoingHttpHeaders } from 'http';
import http from 'http';
import https from 'https';
import { contentType as mime } from 'mime-types';
import connect from 'nodesite.eu-core';
import { Source } from 'nsblob-stream';
import path from 'path';
import { cacheFn, delay, sanitizeHeaders } from 'ps-std';
import { Socket } from 'socket.io-client';

const pathslash = process.platform === 'win32' ? '\\' : '/';
const BAD = 'Bad Gateway';
const open_file_options = [
	'index.html',
	'index.htm',
	pathslash + 'index.html',
	pathslash + 'index.htm',
];

const config = getConfig('nodesite-eu-core');
const solved = config.__getField('solved-challenges');

const registry_root = config.str.registry || 'nodesite.eu';

let insSocketIO: Socket;
let sites: {
	[domain: string]: {
		[path: string]: {
			listener?: Listener;
			file?: string;
		};
	};
} = {};

type ListenerResponse =
	| Source<{ type: string }>
	| string
	| Buffer
	| {
			statusCode?: number;
			body?: string | Buffer;
			head?: OutgoingHttpHeaders;
	  }
	| {
			statusCode?: number;
			head?: OutgoingHttpHeaders;
			hash: string;
	  }
	| {
			statusCode?: number;
			head?: OutgoingHttpHeaders;
			stream: string;
	  };

type Listener = (
	request: NodeSiteRequest
) => ListenerResponse | Promise<ListenerResponse>;

const deferred_challenges: Function[] = [];
let solving = false;

const solve = async function solveChallenge(site: string, code: string) {
	if (solving) {
		deferred_challenges.push(() => solve(site, code));
		return;
	}
	if (solved.__has(code)) {
		insSocketIO.emit('submit_challenge', site, solved.__getString(code));
		return;
	}
	solving = true;
	let p = 0,
		o = 16 ** code.length / 32;
	let nonce = code + site;
	let nonceb: string;
	while (
		(nonceb = blake(nonce)).substr(0, code.length) !==
		code.substr(0, code.length)
	) {
		for (
			let i = 0;
			i < o &&
			(nonceb = blake(nonce)).substr(0, code.length) !==
				code.substr(0, code.length);
			++i
		) {
			nonce = code + nonceb;
		}
		process.stdout.write('\r' + site + ' loading ' + ++p + '%');
	}
	while (p < 100) {
		await new Promise((c) => setTimeout(c, 30));
		process.stdout.write('\r' + site + ' loading ' + ++p + '%');
	}
	solved.__set(code, nonce);
	insSocketIO.emit('submit_challenge', site, nonce);
	if (deferred_challenges.length) {
		setTimeout(() => {
			solving = false;
			let fun = deferred_challenges.pop();
			if (typeof fun === 'function') fun();
		}, 300);
	} else solving = false;
};

type proof_v2 = POW.Proven<{ site: string }>;

const solve_v2 = cacheFn(async (site: string): Promise<proof_v2> => {
	const reg = getRegistry<proof_v2>(`${registry_root}/sites/${site}`);
	const signature = await reg.get('signature');
	if (signature) {
		return signature;
	} else {
		const proven: proof_v2 = await POW.prove_async({ site }, 4);
		reg.set('signature', proven);
		return proven;
	}
});

function register_v2(site: string) {
	NodeSiteClient.ready.then(async (socket) =>
		socket.emit('site_register_v2', site, await solve_v2(site))
	);
}

let init = async function initializeSocket(
	backend_url: string = process?.env?.NODESITE_BACKEND ||
		'wss://nodesite.eu:20122'
) {
	if (insSocketIO) insSocketIO.listeners('ping').length = 0;
	// make sure old socket does not respond to pings

	insSocketIO = connect(backend_url);
	insSocketIO.on('connect', redo);
	insSocketIO.on('error', redo);
	insSocketIO.on('death', redo);
	insSocketIO.on('disconnect', redo);
	insSocketIO.on('deauth', (site: string) => register_v2(site));
	insSocketIO.on('invalid_challenge', (site: string) => register_v2(site));
	insSocketIO.on('challenge_failed', (site: string) => register_v2(site));
	insSocketIO.on('set_challenge', solve);
	insSocketIO.on('challenge_success', (site: string) =>
		process.stdout.write('\rListening on https://' + site + '\n')
	);
	insSocketIO.on('site_already_taken', (site: string) => {
		const retry_after = config.__forceNumber('retry_after') || 600000;
		console.log(`\r${site} is already taken!`);
		console.log(`\rScheduling re-try after ${retry_after / 1000} seconds.`);
		setTimeout(() => register_v2(site), retry_after);
	});
	insSocketIO.on('ping', (cb: (date: Date) => boolean) => {
		const date = new Date();
		insSocketIO.emit('pong', cb?.(date) || cb || date);
	});
	insSocketIO.on('request', requestHandlerProxy);
	insSocketIO.on('io', IOListener.receive);
	insSocketIO.on('ctos-ping', (id: number) =>
		insSocketIO.emit('stoc-ping', id)
	);
	insSocketIO.on('invalid_response', (...args: any[]) =>
		console.log('\rServer regected response!', args)
	);
	Object.assign(NodeSiteClient, { insSocketIO });
	return insSocketIO;
};

let redo = async function reconnectAll() {
	for (const site in sites) {
		register_v2(site);
	}
};

interface NodeSiteRequest {
	iid: number;
	host: string;
	method: string;
	uri: string;
	body: string | Buffer;
	head: NodeSiteRequestHeaders;
}

interface NodeSiteRequestHeaders {
	[key: string]: string | undefined;
	host: string;
	connection?: string;
	cookie?: string;
	'user-agent'?: string;
	accept?: string;
	'sec-fetch-site'?: string;
	'sec-fetch-mode'?: string;
	'sec-fetch-dest'?: string;
	referer?: string;
	'accept-encoding'?: string;
	'accept-language'?: string;
}

export const errorResponse: ListenerResponse = {
	statusCode: 500,
};

export type ErrorHandler = (err: unknown) => object | undefined;

let errHandler: ErrorHandler = () => errorResponse;

export const setErrorHandler = (newErrorHandler: ErrorHandler) => {
	errHandler = newErrorHandler;
};

const requestHandlerProxy = async (request: NodeSiteRequest) => {
	try {
		let response = await requestHandler(request);

		if (typeof response !== 'object' || response instanceof Uint8Array) {
			response = {
				body: response,
			};
		}

		if (response instanceof Source) {
			response = {
				head: {
					'Content-Length': response.length,
					'Content-Type': response.props.type,
				},
				stream: response.raw,
			};
		}

		insSocketIO.emit('response', request.iid, response);
	} catch (error) {
		insSocketIO.emit('response', request.iid, errHandler(error));
	}
};

const requestHandler = async (request: NodeSiteRequest) => {
	let site = sites[request.host];
	if (!site) {
		if (!(site = sites['*'])) return BAD;
	}
	let pathparts = (path.resolve(request.uri).split('?').shift() + '/')
		.replace(/\.\.+/, '.')
		.replace(/[\/\\]+/g, '/')
		.split('/');
	let localpath = [];
	while (pathparts.length) {
		localpath.unshift(pathparts.pop());
		if (!localpath[localpath.length - 1]) localpath.pop();
		let tpath = pathparts.join('/') || '/';
		let lpath = localpath.join(pathslash);
		let sf = site[tpath];
		if (sf) {
			if (sf.file) {
				if (fs.existsSync(sf.file)) {
					let f = sf.file;
					let stat = fs.statSync(f);
					if (stat.isDirectory()) {
						if (
							fs.existsSync(f + lpath) &&
							!fs.statSync(f + lpath).isDirectory()
						) {
							return fileReadHandler(f + lpath);
						}
						if (
							fs.existsSync(f + pathslash + lpath) &&
							!fs.statSync(f + pathslash + lpath).isDirectory()
						) {
							return fileReadHandler(f + pathslash + lpath);
						}
						for (const o in open_file_options) {
							if (fs.existsSync(f + open_file_options[o])) {
								return fileReadHandler(
									f + open_file_options[o]
								);
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
		statusCode: 404,
	};
};

const fileReadHandler = function readFileAndConvertIntoResponse(file: string) {
	return Source.fromStream(fs.createReadStream(file), {
		type: mime(path.basename(file)) || 'text/plain',
	});
};

type NodeSiteSocketListener = (
	socket: NodeSiteClientSocket,
	site: string
) => void | Promise<void>;

const IOListener: {
	(cb: NodeSiteSocketListener): void;
	socketListeners: Array<NodeSiteSocketListener>;
	registerSocketListener(cb: NodeSiteSocketListener): void;
	newsocket(id: any): NodeSiteClientSocket;
	sockets: {
		[iid: number]: NodeSiteClientSocket;
	};
	receive(
		id: number,
		site: string,
		e: string,
		args: Array<any>
	): Promise<void>;
} = function NodeSiteIOListener(cb: NodeSiteSocketListener) {
	IOListener.registerSocketListener(cb);
};

IOListener.socketListeners = Array<NodeSiteClientSocket>();
IOListener.registerSocketListener = (cb: NodeSiteSocketListener) => {
	IOListener.socketListeners.push(cb);
};

interface NodeSiteClientSocket {
	(...args: Array<any>): void;
	id: any;
	send(...args: Array<any>): void;
	listeners: {
		[e: string]: {
			perm: Function[];
			once: Function[];
		};
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
	socket.send = function send(e: string, ...args: Array<any>) {
		insSocketIO.emit('stoc', socket.id, e, args);
	};
	socket.listeners = {};
	socket.listenersAny = Array<Function>();
	socket.onAny = (f: Function) => socket.listenersAny.push(f);
	socket.on = (event: string, cb: Function, once: boolean) => {
		if (!socket.listeners[event]) {
			socket.listeners[event] = {
				perm: [],
				once: [],
			};
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
	};
	return socket;
};
IOListener.sockets = {};
IOListener.receive = async (
	id: number,
	site: string,
	e: string,
	args: Array<any>
) => {
	if (!IOListener.sockets[id]) {
		IOListener.sockets[id] = IOListener.newsocket(id);
		for (const n in IOListener.socketListeners) {
			await IOListener.socketListeners[n](IOListener.sockets[id], site);
		}
	}
	IOListener.sockets[id].receive(e, args || []);
};

const NodeSiteClient = function NodeSiteClient(
	domain: string,
	path: string = '/',
	listener?: Listener,
	file: string = ''
) {
	domain = domain.toLowerCase().replace(/[^a-z0-9\-\.]/g, '');
	domain = domain.match(/[^a-z0-9\-]/) ? domain : domain + '.nodesite.eu';
	if (!sites[domain]) {
		sites[domain] = {};
		register_v2(domain);
	}
	let site = sites[domain];
	path = `/${path}`.replace(/[\\\/]+/g, '/');
	site[path] = {
		listener,
		file,
	};
};

export function rewrite(
	request: NodeSiteRequest,
	uri: string
): Promise<ListenerResponse> {
	const url = new URL(uri, new URL(request.uri, 'a://b'));
	request.uri = url.pathname + url.search;
	return requestHandler(request);
}

export function direct(): Socket | undefined {
	return insSocketIO;
}

export function rawwrite(e: string, ...args: any[]) {
	insSocketIO.emit(e, ...args);
}

//////////////////////////////////////////////////////////////////////
export const ready_promise = delay(7).then(() => {
	if (insSocketIO) {
		return insSocketIO;
	} else {
		return init();
	}
});
NodeSiteClient.ready_promise = ready_promise;

Object.defineProperty(NodeSiteClient, 'ready', {
	get(): Promise<Socket> {
		return ready_promise;
	},
	set(cb: Promise<any> | ((socket: Socket) => any)) {
		typeof cb === 'function'
			? ready_promise.then(cb)
			: ready_promise.then((socket) =>
					cb.then((cb) => typeof cb === 'function' && cb(socket))
			  );
	},
	enumerable: true,
});

export const ready = ready_promise;
NodeSiteClient.ready = ready_promise;
//////////////////////////////////////////////////////////////////////

/**
 * Proxy a URL to nodesite.eu
 * @param {string} from URL to proxy, for example 'http://localhost:3000'
 * @param {string} to NodeSite name, for example 'proxy.nodesite.eu'
 */
function proxy(from: string, to: string, { path } = { path: '/' }) {
	create(to, path, (req) => {
		return new Promise<ListenerResponse>(async (resolve) => {
			try {
				const req_uri = new URL(req.uri, from);
				const handler = req_uri.protocol === 'https:' ? https : http;

				const headers = sanitizeHeaders(req.head);
				headers['Host'] = req_uri.host;

				const request = handler.request(
					req_uri,
					{
						method: req.method,
						headers,
					},
					(response) => {
						const buffers = Array<Buffer>();
						response.on('data', (chunk) => buffers.push(chunk));
						response.on('end', () => {
							resolve({
								statusCode: response.statusCode,
								head: sanitizeHeaders(response.headers),
								body: Buffer.concat(buffers),
							});
						});
					}
				);

				if (req.body?.length) {
					request.write(req.body);
				}

				request.end();
			} catch {
				return resolve({
					statusCode: 500,
				});
			}
		});
	});
}

NodeSiteClient.proxy = proxy;
export { proxy };

NodeSiteClient.create = NodeSiteClient;
NodeSiteClient.init = init;
NodeSiteClient.sites = sites;
NodeSiteClient.redo = redo;
NodeSiteClient.io = IOListener;

NodeSiteClient.IOListener = IOListener;
NodeSiteClient.NodeSiteClient = NodeSiteClient;
export const { create, io } = NodeSiteClient;

export { NodeSiteClient, init, sites, redo, IOListener };

export {
	blake,
	deferred_challenges,
	open_file_options,
	requestHandlerProxy,
	config,
	solved,
	Listener,
	ListenerResponse,
	NodeSiteClientSocket,
	NodeSiteSocketListener,
	NodeSiteRequest,
	NodeSiteRequestHeaders,
	solve_v2,
	register_v2,
};

Object.assign(NodeSiteClient, {
	blake,
	deferred_challenges,
	open_file_options,
	requestHandlerProxy,
	config,
	solved,
	rawwrite,
	rewrite,
	direct,
	solve_v2,
	register_v2,

	errorResponse,
	setErrorHandler,
});

export default NodeSiteClient;
module.exports = NodeSiteClient;
