"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.solved = exports.requestHandlerProxy = exports.open_file_options = exports.deferred_challenges = exports.blake = exports.rawwrite = exports.IOListener = exports.redo = exports.sites = exports.init = exports.NodeSiteClient = exports.io = exports.create = exports.proxy = void 0;
const libSocketIO = require('socket.io-client');
const fs = require('fs');
const blake = require('blakejs').blake2sHex;
exports.blake = blake;
const pathslash = (process.platform === 'win32') ? '\\' : '/';
const mime = require('mime-types').contentType;
const open_file_options = [
    'index.html',
    'index.htm',
    pathslash + 'index.html',
    pathslash + 'index.htm'
];
exports.open_file_options = open_file_options;
const BAD = 'Bad Gateway';
const node_fetch_1 = __importDefault(require("node-fetch"));
let insSocketIO;
let sites = {};
exports.sites = sites;
const deferred_challenges = [];
exports.deferred_challenges = deferred_challenges;
let solving = false;
const solved = {};
exports.solved = solved;
const solve = async function solveChallenge(site, code) {
    if (solving) {
        deferred_challenges.push(() => solve(site, code));
        return;
    }
    if (solved[code]) {
        insSocketIO.emit('submit_challenge', site, solved[code]);
        return;
    }
    solving = true;
    let p = 0, o = (16 ** code.length) / 32, i = 0;
    let nonce = code + site;
    let nonceb;
    while ((nonceb = (blake(nonce))).substr(0, code.length) !== code.substr(0, code.length)) {
        for (let i = 0; (i < o) && ((nonceb = (blake(nonce))).substr(0, code.length) !== code.substr(0, code.length)); ++i) {
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
            if (typeof fun === 'function')
                fun();
        }, 300);
    }
    else
        solving = false;
};
let init = async function initializeSocket() {
    if (insSocketIO)
        insSocketIO.removeAllListeners();
    const port = await node_fetch_1.default('https://nodesite.eu/get_port', {}).then((r) => r.text());
    insSocketIO = libSocketIO('wss://nodesite.eu:' + port);
    insSocketIO.on('connect', redo);
    insSocketIO.on('error', redo);
    insSocketIO.on('death', redo);
    insSocketIO.on('disconnect', redo);
    insSocketIO.on('deauth', (site) => insSocketIO.emit('new_challenge_if_unauthed', site));
    insSocketIO.on('invalid_challenge', (site) => insSocketIO.emit('get_challenge', site));
    insSocketIO.on('challenge_failed', (site) => insSocketIO.emit('get_challenge', site));
    insSocketIO.on('set_challenge', solve);
    insSocketIO.on('challenge_success', (site) => process.stdout.write("\rListening on https://" + site + "\n"));
    insSocketIO.on('request', requestHandlerProxy);
    insSocketIO.on('io', IOListener.receive);
    insSocketIO.on('ctos-ping', (id) => insSocketIO.emit('stoc-ping', id));
};
exports.init = init;
let redo = async function reconnectAll() {
    for (const n in sites) {
        insSocketIO.emit('get_challenge', n);
    }
};
exports.redo = redo;
const requestHandlerProxy = async (request) => {
    let response = await requestHandler(request);
    if (response == BAD)
        return;
    if ((typeof response !== 'object') || (response instanceof Uint8Array)) {
        response = ({
            body: response
        });
    }
    insSocketIO.emit('response', request.iid, response);
};
exports.requestHandlerProxy = requestHandlerProxy;
const requestHandler = async (request) => {
    let site = sites[request.host];
    if (!site) {
        if (!(site = sites['*']))
            return BAD;
    }
    let path = ((request.uri.split('?').shift()) + '/').replace(/\.\.+/, '.').replace(/[\/\\]+/g, '/').split('/');
    let localpath = [];
    while (path.length) {
        localpath.unshift(path.pop());
        if (!localpath[localpath.length - 1])
            localpath.pop();
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
                    }
                    else {
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
    };
};
const fileReadHandler = function readFileAndConvertIntoResponse(file) {
    let data = fs.readFileSync(file);
    let head = {
        'Content-Type': mime(file.split(/[\\\/]+/).pop()),
        'Content-Length': data.length
    };
    let body = data;
    return {
        head,
        body
    };
};
const IOListener = function NodeSiteIOListener(cb) {
    IOListener.registerSocketListener(cb);
};
exports.IOListener = IOListener;
IOListener.socketListeners = Array();
IOListener.registerSocketListener = (cb) => {
    IOListener.socketListeners.push(cb);
};
IOListener.newsocket = function createSocket(id) {
    const socket = function (...args) {
        args.unshift('message');
        socket.send.apply(null, args);
    };
    socket.id = id;
    socket.send = function send(...args) {
        insSocketIO.emit('stoc', socket.id, args);
    };
    socket.listeners = {};
    socket.listenersAny = Array();
    socket.onAny = (f) => socket.listenersAny.push(f);
    socket.on = (event, cb, once) => {
        if (!socket.listeners[event]) {
            socket.listeners[event] = {
                perm: [],
                once: [],
            };
        }
        if (once) {
            socket.listeners[event].once.push(cb);
        }
        else {
            socket.listeners[event].perm.push(cb);
        }
        return socket;
    };
    socket.once = (event, cb) => socket.on(event, cb, true);
    socket.emit = socket.write = socket.send;
    socket.receive = async (e, args = []) => {
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
IOListener.receive = async (id, site, e, args) => {
    if (!IOListener.sockets[id]) {
        IOListener.sockets[id] = IOListener.newsocket(id);
        for (const n in IOListener.socketListeners) {
            await IOListener.socketListeners[n](IOListener.sockets[id], site);
        }
    }
    IOListener.sockets[id].receive(e, args || []);
};
const NodeSiteClient = function NodeSiteClient(domain, path = '/', listener, file = '') {
    domain = domain.toLowerCase().replace(/[^a-z0-9\-\.]/g, '');
    domain = domain.match(/[^a-z0-9\-]/) ? domain : domain + '.nodesite.eu';
    if (!sites[domain]) {
        sites[domain] = {};
        if (insSocketIO) {
            insSocketIO.emit('get_challenge', domain);
        }
        else {
            init();
        }
    }
    let site = sites[domain];
    site[path] = {
        listener,
        file,
    };
};
exports.NodeSiteClient = NodeSiteClient;
exports.proxy = NodeSiteClient.proxy = function createProxy(hostListen, hostPath = '/', urlPoint = 'localhost:8080', fetchOptions = {}) {
    return NodeSiteClient(hostListen, hostPath || '/', async (request) => {
        let uri = urlPoint + request.uri;
        uri = uri.replace('/\/+/', '/');
        const res = await node_fetch_1.default(uri, fetchOptions);
        let head = {};
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
};
NodeSiteClient.create = NodeSiteClient;
NodeSiteClient.init = init;
NodeSiteClient.sites = sites;
NodeSiteClient.redo = redo;
NodeSiteClient.io = IOListener;
NodeSiteClient.IOListener = IOListener;
NodeSiteClient.NodeSiteClient = NodeSiteClient;
exports.create = NodeSiteClient.create, exports.io = NodeSiteClient.io;
function rawwrite(...args) {
    insSocketIO.emit(...args);
}
exports.rawwrite = rawwrite;
NodeSiteClient.rawwrite = rawwrite;
Object.assign(NodeSiteClient, {
    blake,
    deferred_challenges,
    open_file_options,
    requestHandlerProxy,
    solved,
});
exports.default = NodeSiteClient;
module.exports = NodeSiteClient;
