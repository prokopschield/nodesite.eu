"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const { blake2sHex } = require('blakejs');
const child_process_1 = require("child_process");
const fs_1 = __importDefault(require("fs"));
const https_1 = __importDefault(require("https"));
const path_1 = __importDefault(require("path"));
const ts_hound_1 = require("ts-hound");
const _1 = require(".");
const files = new Map;
function put(file) {
    let hash = blake2sHex(file);
    return new Promise(resolve => {
        let cached = files.get(hash);
        if (cached)
            return resolve(cached);
        if (file.length > (1 << 24)) {
            return put('Error: Payload Too Large');
        }
        const req = https_1.default.request('https://cdn.nodesite.eu/static/put/', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/octet-stream',
            },
        }, (res) => {
            let buffers = [];
            res.on('error', () => put('An error occured while this file was being processed.').then(resolve));
            res.on('data', (chunk) => buffers.push(chunk));
            res.on('end', () => {
                const bref = Buffer.concat(buffers);
                const ref = bref.toString();
                if (ref.match(/^[0-9a-f\-]{64,68}$/)) {
                    files.set(hash, ref);
                    return resolve(ref);
                }
                else
                    put(bref).then(resolve);
            });
        });
        req.write(file);
        req.end();
    });
}
function dynamic(domain) {
    domain = domain.includes('.') ? domain : `${domain}.nodesite.eu`;
    function makewpath(p, d = false) {
        return d ? `https://${domain}${path_1.default.resolve('/', p)}` : path_1.default.resolve('/', p);
    }
    async function f(p) {
        try {
            if (!fs_1.default.existsSync(p))
                return false;
            const rel = path_1.default.relative('.', p);
            const uri = makewpath(rel);
            const ext = path_1.default.extname(p);
            const dat = await fs_1.default.promises.readFile(p);
            const ref = await put(dat);
            _1.create(domain, uri, void null, p);
            _1.rawwrite('static', domain, uri, ref);
            console.log(`\rRegistered static route ${makewpath(uri, true)}`);
            if ((ext === '.ts') || (ext === '.js')) {
                const cachedir = path_1.default.resolve(__dirname, '.dyn-cache-dir');
                if (!fs_1.default.existsSync(cachedir))
                    fs_1.default.mkdirSync(cachedir);
                const cp = path_1.default.resolve(cachedir, ref + ext);
                await fs_1.default.promises.writeFile(cp, dat);
                if (ext === '.ts') {
                    await new Promise(resolve => child_process_1.exec(`tsc --module CommonJS --esModuleInterop ${cp}`, resolve));
                }
                const ce = path_1.default.resolve(cachedir, ref + '.js');
                if (fs_1.default.existsSync(ce)) {
                    let handle = require(ce);
                    if (typeof handle !== 'function') {
                        for (const method of Object.values(handle)) {
                            if (typeof method === 'function') {
                                handle = method;
                            }
                        }
                    }
                    if (typeof handle === 'function') {
                        let route = uri.split(/\./g).slice(0, -1).join('.');
                        _1.create(domain, route, handle);
                        console.log(`\rRegistered scripted handle ${makewpath(route, true)}`);
                        if (route.match(/\/index$/)) {
                            route = route.replace(/\/index$/, '');
                            _1.create(domain, route, handle);
                            console.log(`\rRegistered scripted handle ${makewpath(route, true)}`);
                        }
                    }
                }
            }
            return true;
        }
        catch (e) {
            return false;
        }
    }
    async function d(p) {
        console.log(`\rCrawling ${p}`);
        for (const fn of fs_1.default.readdirSync(p)) {
            const fp = path_1.default.resolve(p, fn);
            const stat = fs_1.default.statSync(fp);
            if (stat.isFile()) {
                await f(fp);
            }
            else if (stat.isDirectory()) {
                await d(fp);
            }
            else {
                console.log(`\rSkipping bad file descriptor ${fp}`);
            }
        }
        return true;
    }
    const root = path_1.default.resolve('.');
    const queue = [root];
    const watcher = ts_hound_1.watch(root);
    watcher.on('create', (file) => queue.push(file));
    watcher.on('change', (file) => queue.push(file));
    function process() {
        const nv = queue.pop();
        if (nv) {
            if (!fs_1.default.existsSync(nv))
                return process();
            const stat = fs_1.default.statSync(nv);
            if (stat.isDirectory()) {
                return d(nv).then(process);
            }
            else if (stat.isFile()) {
                return f(nv).then(process);
            }
            else {
                console.log(`\rImproper descriptor: ${nv}`);
            }
        }
        else
            setTimeout(process, 1000);
    }
    _1.create(domain, '/', (request) => {
        if (request.uri === '/404.html') {
            return ({ statusCode: 404, body: `<h1>404 Not Found</h1>` });
        }
        else if (request.uri === '/index.html') {
            return ({ statusCode: 302, head: { Location: '/404.html' } });
        }
        else if (request.uri === '/index') {
            return ({ statusCode: 302, head: { Location: '/index.html' } });
        }
        else if (request.uri === '/') {
            return ({ statusCode: 302, head: { Location: '/index' } });
        }
        else {
            console.log(`\rMissing URI requested: ${request.uri}`);
            return ({ statusCode: 302, head: { Location: path_1.default.resolve(request.uri, '..') } });
        }
    });
    const { NodeSiteClient } = require('.');
    function start() {
        if (NodeSiteClient.insSocketIO) {
            NodeSiteClient.insSocketIO.on('challenge_success', process);
        }
        else {
            setTimeout(start, 300);
        }
    }
    return start();
}
exports.default = dynamic;
module.exports = dynamic;
Object.assign(dynamic, {
    default: dynamic,
    dynamic,
});
