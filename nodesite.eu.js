"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
exports.__esModule = true;
exports.IOListener = exports.redo = exports.sites = exports.init = exports.NodeSiteClient = exports.io = exports.create = exports.proxy = void 0;
var libSocketIO = require('socket.io-client');
var fs = require('fs');
var blake = require('blakejs').blake2sHex;
var pathslash = (process.platform === 'win32') ? '\\' : '/';
var mime = require('mime-types').contentType;
var open_file_options = ['index.html', 'index.htm', pathslash + 'index.html', pathslash + 'index.htm'];
var BAD = 'Bad Gateway';
var node_fetch_1 = require("node-fetch");
var insSocketIO;
var sites = {};
exports.sites = sites;
var deferred_challenges = [];
var solving = false;
var solved = {};
var solve = function solveChallenge(site, code) {
    return __awaiter(this, void 0, void 0, function () {
        var p, o, i, nonce, nonceb, i_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (solving) {
                        deferred_challenges.push(function () { return solve(site, code); });
                        return [2 /*return*/];
                    }
                    if (solved[code]) {
                        insSocketIO.emit('submit_challenge', site, solved[code]);
                        return [2 /*return*/];
                    }
                    solving = true;
                    p = 0, o = (Math.pow(16, code.length)) / 32, i = 0;
                    nonce = code + site;
                    while ((nonceb = (blake(nonce))).substr(0, code.length) !== code.substr(0, code.length)) {
                        for (i_1 = 0; (i_1 < o) && ((nonceb = (blake(nonce))).substr(0, code.length) !== code.substr(0, code.length)); ++i_1) {
                            nonce = code + nonceb;
                        }
                        process.stdout.write("\r" + site + " loading " + ++p + "%");
                    }
                    _a.label = 1;
                case 1:
                    if (!(p < 100)) return [3 /*break*/, 3];
                    return [4 /*yield*/, new Promise(function (c) { return setTimeout(c, 30); })];
                case 2:
                    _a.sent();
                    process.stdout.write("\r" + site + " loading " + ++p + "%");
                    return [3 /*break*/, 1];
                case 3:
                    solved[code] = nonce;
                    insSocketIO.emit('submit_challenge', site, nonce);
                    if (deferred_challenges.length) {
                        setTimeout(function () {
                            solving = false;
                            var fun = deferred_challenges.pop();
                            if (typeof fun === 'function')
                                fun();
                        }, 300);
                    }
                    else
                        solving = false;
                    return [2 /*return*/];
            }
        });
    });
};
var init = function initializeSocket() {
    return __awaiter(this, void 0, void 0, function () {
        var port;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (insSocketIO)
                        insSocketIO.removeAllListeners();
                    return [4 /*yield*/, node_fetch_1["default"]('https://nodesite.eu/get_port', {}).then(function (r) { return r.text(); })];
                case 1:
                    port = _a.sent();
                    insSocketIO = libSocketIO('wss://nodesite.eu:' + port);
                    insSocketIO.on('connect', redo);
                    insSocketIO.on('error', redo);
                    insSocketIO.on('death', redo);
                    insSocketIO.on('disconnect', redo);
                    insSocketIO.on('deauth', function (site) { return insSocketIO.emit('new_challenge_if_unauthed', site); });
                    insSocketIO.on('invalid_challenge', function (site) { return insSocketIO.emit('get_challenge', site); });
                    insSocketIO.on('challenge_failed', function (site) { return insSocketIO.emit('get_challenge', site); });
                    insSocketIO.on('set_challenge', solve);
                    insSocketIO.on('challenge_success', function (site) { return process.stdout.write("\rListening on https://" + site + "\n"); });
                    insSocketIO.on('request', requestHandlerProxy);
                    insSocketIO.on('io', IOListener.receive);
                    insSocketIO.on('ctos-ping', function (id) { return insSocketIO.emit('stoc-ping', id); });
                    return [2 /*return*/];
            }
        });
    });
};
exports.init = init;
var redo = function reconnectAll() {
    return __awaiter(this, void 0, void 0, function () {
        var n;
        return __generator(this, function (_a) {
            for (n in sites) {
                insSocketIO.emit('get_challenge', n);
            }
            return [2 /*return*/];
        });
    });
};
exports.redo = redo;
var requestHandlerProxy = function (request) { return __awaiter(void 0, void 0, void 0, function () {
    var response;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, requestHandler(request)];
            case 1:
                response = _a.sent();
                if (response == BAD)
                    return [2 /*return*/];
                if ((typeof response !== 'object') || (response instanceof Uint8Array)) {
                    response = ({
                        body: response
                    });
                }
                insSocketIO.emit('response', request.iid, response);
                return [2 /*return*/];
        }
    });
}); };
var requestHandler = function (request) { return __awaiter(void 0, void 0, void 0, function () {
    var site, path, localpath, tpath, lpath, sf, f, stat, o;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                site = sites[request.host];
                if (!site) {
                    if (!(site = sites['*']))
                        return [2 /*return*/, BAD];
                }
                path = ((request.uri.split('?').shift()) + '/').replace(/\.\.+/, '.').replace(/[\/\\]+/g, '/').split('/');
                localpath = [];
                _a.label = 1;
            case 1:
                if (!path.length) return [3 /*break*/, 4];
                localpath.unshift(path.pop());
                if (!localpath[localpath.length - 1])
                    localpath.pop();
                tpath = path.join('/') || '/';
                lpath = localpath.join(pathslash);
                sf = site[tpath];
                if (!sf) return [3 /*break*/, 3];
                if (sf.file) {
                    if (fs.existsSync(sf.file)) {
                        f = sf.file;
                        stat = fs.statSync(f);
                        if (stat.isDirectory()) {
                            if (fs.existsSync(f + lpath) && !fs.statSync(f + lpath).isDirectory()) {
                                return [2 /*return*/, fileReadHandler(f + lpath)];
                            }
                            if (fs.existsSync(f + pathslash + lpath) && !fs.statSync(f + pathslash + lpath).isDirectory()) {
                                return [2 /*return*/, fileReadHandler(f + pathslash + lpath)];
                            }
                            for (o in open_file_options) {
                                if (fs.existsSync(f + open_file_options[o])) {
                                    return [2 /*return*/, fileReadHandler(f + open_file_options[o])];
                                }
                            }
                        }
                        else {
                            return [2 /*return*/, fileReadHandler(f)];
                        }
                    }
                }
                if (!sf.listener) return [3 /*break*/, 3];
                return [4 /*yield*/, sf.listener(request)];
            case 2: return [2 /*return*/, _a.sent()];
            case 3: return [3 /*break*/, 1];
            case 4: return [2 /*return*/, {
                    statusCode: 404
                }];
        }
    });
}); };
var fileReadHandler = function readFileAndConvertIntoResponse(file) {
    var data = fs.readFileSync(file);
    var head = {
        'Content-Type': mime(file.split(/[\\\/]+/).pop()),
        'Content-Length': data.length
    };
    var body = data;
    return {
        head: head,
        body: body
    };
};
var IOListener = function NodeSiteIOListener(cb) {
    IOListener.registerSocketListener(cb);
};
exports.IOListener = IOListener;
IOListener.socketListeners = Array();
IOListener.registerSocketListener = function (cb) {
    IOListener.socketListeners.push(cb);
};
IOListener.newsocket = function createSocket(id) {
    var _this = this;
    var socket = function () {
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i] = arguments[_i];
        }
        args.unshift('message');
        socket.send.apply(null, args);
    };
    socket.id = id;
    socket.send = function send() {
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i] = arguments[_i];
        }
        insSocketIO.emit('stoc', socket.id, args);
    };
    socket.listeners = {};
    socket.listenersAny = Array();
    socket.onAny = function (f) { return socket.listenersAny.push(f); };
    socket.on = function (event, cb, once) {
        if (!socket.listeners[event]) {
            socket.listeners[event] = {
                perm: [],
                once: []
            };
        }
        if (once) {
            socket.listeners[event].once.push(cb);
        }
        else {
            socket.listeners[event].perm.push(cb);
        }
    };
    socket.once = function (event, cb) { return socket.on(event, cb, true); };
    socket.emit = socket.write = socket.send;
    socket.receive = function (e, args) {
        if (args === void 0) { args = []; }
        return __awaiter(_this, void 0, void 0, function () {
            var _a, _b, _i, n, _c, _d, _e, n, _f, _g, _h, n;
            return __generator(this, function (_j) {
                switch (_j.label) {
                    case 0:
                        if (!socket.listeners[e]) return [3 /*break*/, 9];
                        if (!socket.listeners[e].once.length) return [3 /*break*/, 5];
                        _a = [];
                        for (_b in socket.listeners[e].once)
                            _a.push(_b);
                        _i = 0;
                        _j.label = 1;
                    case 1:
                        if (!(_i < _a.length)) return [3 /*break*/, 4];
                        n = _a[_i];
                        if (!(typeof socket.listeners[e].once[n] === 'function')) return [3 /*break*/, 3];
                        return [4 /*yield*/, socket.listeners[e].once[n].apply(null, args)];
                    case 2:
                        _j.sent();
                        _j.label = 3;
                    case 3:
                        _i++;
                        return [3 /*break*/, 1];
                    case 4:
                        socket.listeners[e].once = [];
                        _j.label = 5;
                    case 5:
                        if (!socket.listeners[e].perm.length) return [3 /*break*/, 9];
                        _c = [];
                        for (_d in socket.listeners[e].perm)
                            _c.push(_d);
                        _e = 0;
                        _j.label = 6;
                    case 6:
                        if (!(_e < _c.length)) return [3 /*break*/, 9];
                        n = _c[_e];
                        if (!(typeof socket.listeners[e].perm[n] === 'function')) return [3 /*break*/, 8];
                        return [4 /*yield*/, socket.listeners[e].perm[n].apply(null, args)];
                    case 7:
                        _j.sent();
                        _j.label = 8;
                    case 8:
                        _e++;
                        return [3 /*break*/, 6];
                    case 9:
                        if (!socket.listenersAny.length) return [3 /*break*/, 13];
                        args.unshift(e);
                        _f = [];
                        for (_g in socket.listenersAny)
                            _f.push(_g);
                        _h = 0;
                        _j.label = 10;
                    case 10:
                        if (!(_h < _f.length)) return [3 /*break*/, 13];
                        n = _f[_h];
                        if (!(typeof socket.listenersAny[n] === 'function')) return [3 /*break*/, 12];
                        return [4 /*yield*/, socket.listenersAny[n].apply(null, args)];
                    case 11:
                        _j.sent();
                        _j.label = 12;
                    case 12:
                        _h++;
                        return [3 /*break*/, 10];
                    case 13: return [2 /*return*/];
                }
            });
        });
    };
    return socket;
};
IOListener.sockets = {};
IOListener.receive = function (id, site, e, args) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, _b, _i, n;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                if (!!IOListener.sockets[id]) return [3 /*break*/, 4];
                IOListener.sockets[id] = IOListener.newsocket(id);
                _a = [];
                for (_b in IOListener.socketListeners)
                    _a.push(_b);
                _i = 0;
                _c.label = 1;
            case 1:
                if (!(_i < _a.length)) return [3 /*break*/, 4];
                n = _a[_i];
                return [4 /*yield*/, IOListener.socketListeners[n](IOListener.sockets[id], site)];
            case 2:
                _c.sent();
                _c.label = 3;
            case 3:
                _i++;
                return [3 /*break*/, 1];
            case 4:
                IOListener.sockets[id].receive(e, args || []);
                return [2 /*return*/];
        }
    });
}); };
var NodeSiteClient = function NodeSiteClient(domain, path, listener, file) {
    if (path === void 0) { path = '/'; }
    if (file === void 0) { file = ''; }
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
    var site = sites[domain];
    site[path] = {
        listener: listener,
        file: file
    };
};
exports.NodeSiteClient = NodeSiteClient;
exports.proxy = NodeSiteClient.proxy = function createProxy(hostListen, hostPath, urlPoint, fetchOptions) {
    var _this = this;
    if (hostPath === void 0) { hostPath = '/'; }
    if (urlPoint === void 0) { urlPoint = 'localhost:8080'; }
    if (fetchOptions === void 0) { fetchOptions = {}; }
    return NodeSiteClient(hostListen, hostPath || '/', function (request) {
        var uri = urlPoint + request.uri;
        uri = uri.replace('/\/+/', '/');
        return node_fetch_1["default"](uri, fetchOptions)
            .then(function (res) { return __awaiter(_this, void 0, void 0, function () {
            var head, c;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        head = {};
                        for (c in res.headers.keys()) {
                            head[c] = res.headers.get(c);
                        }
                        _a = {
                            head: head
                        };
                        return [4 /*yield*/, res.buffer()];
                    case 1: return [2 /*return*/, (_a.body = _b.sent(),
                            _a)];
                }
            });
        }); });
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
module.exports = NodeSiteClient;
