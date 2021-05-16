const { blake2sHex } = require('blakejs');
import { exec } from 'child_process';
import fs from 'fs';
import https from 'https';
import path from 'path';
import { watch } from 'ts-hound';
import { create, rawwrite } from '.';
import { NodeSiteRequest, rewrite } from './nodesite.eu';

const files: Map<string, string> = new Map;

function put (file: Buffer | string): Promise<string> {
	let hash = blake2sHex(file);
	return new Promise(resolve => {
		let cached = files.get(hash);
		if (cached) return resolve(cached);
		if (file.length > ( 1 << 24 )) {
			return put('Error: Payload Too Large');
		}
		const req = https.request('https://cdn.nodesite.eu/static/put/', {
			method: 'PUT',
			headers: {
				'Content-Type': 'application/octet-stream',
			},
		}, (res) => {
			let buffers: Buffer[] = [];
			res.on('error', () => put('An error occured while this file was being processed.').then(resolve));
			res.on('data', (chunk: Buffer) => buffers.push(chunk));
			res.on('end', () => {
				const bref = Buffer.concat(buffers);
				const ref = bref.toString();
				// ref is 64 hex chars or uuid
				if (ref.match(/^[0-9a-f\-]{64,68}$/)) {
					files.set(hash, ref);
					return resolve(ref);
				} else put(bref).then(resolve);
			});
		});
		req.write(file);
		req.end();
	});
}

function dynamic (domain: string) {
	domain = domain.includes('.') ? domain : `${domain}.nodesite.eu`;
	function makewpath (p: string, d: boolean = false) {
		p = p.replace(/[\\\/]+/g, '/');
		return d ? `https://${domain}${path.posix.resolve('/', p)}` : path.posix.resolve('/', p);
	}
	const root = path.resolve('.');
	const queue: string[] = [ root ];
	const watcher = watch(root);
	watcher.on('create', (file: string) => queue.push(file));
	watcher.on('change', (file: string) => queue.push(file));
	const cachedir = path.resolve('.', '.dyn-cache-dir');
	const confdir = path.resolve('.', 'config');
	async function f (p: string): Promise<boolean> {
		try {
			if (!fs.existsSync(p)) return false;
			if (p.includes(cachedir)) return false;
			if (p.includes(confdir)) return false;
			const rel = path.relative('.', p);
			const uri = makewpath(rel);
			const ext = path.extname(p);
			const dat = await fs.promises.readFile(p);
			const ref = await put(dat);
			create(domain, uri, void null, p);
			rawwrite('static', domain, uri, ref);
			console.log(`\rRegistered static route ${makewpath(uri, true)}`);
			if ((ext === '.ts') || (ext === '.js')) {
				if (!fs.existsSync(cachedir)) fs.mkdirSync(cachedir);
				const cp = path.resolve(cachedir, ref + ext);
				const ce = path.resolve(cachedir, ref + '.js');
				if (!fs.existsSync(cp) || ((await fs.promises.readFile(cp)).toString('utf8') !== dat.toString('utf8'))) {
					await fs.promises.writeFile(cp, dat);
				}
				if (!fs.existsSync(ce) && (ext === '.ts')) {
					await new Promise(resolve => exec(`tsc --module CommonJS --esModuleInterop ${cp}`, resolve));
				}
				if (fs.existsSync(ce)) {
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
						create(domain, route, handle);
						console.log(`\rRegistered scripted handle ${makewpath(route, true)}`);
						if (route.match(/\/index$/)) {
							route = route.replace(/\/index$/, '');
							create(domain, route, handle);
							console.log(`\rRegistered scripted handle ${makewpath(route, true)}`);
						}
					}
				}
			}
			return true;
		} catch (e) {
			return false;
		}
	}
	async function d (p: string): Promise<boolean> {
		console.log(`\rCrawling ${p}`);
		for (const fn of fs.readdirSync(p)) {
			if ((fn === 'node_modules') || (fn === '.git')) continue;
			const fp = path.resolve(p, fn);
			const stat = fs.statSync(fp);
			if (stat.isFile()) {
				await f (fp);
			} else if (stat.isDirectory()) {
				await d (fp);
			} else {
				console.log(`\rSkipping bad file descriptor ${fp}`);
			}
		}
		return true;
	}
	function process (): undefined | Promise<undefined> {
		const nv = queue.pop();
		if (nv) {
			if (!fs.existsSync(nv)) return process();
			const stat = fs.statSync(nv);
			if (stat.isDirectory()) {
				return d(nv).then(process);
			} else if (stat.isFile()) {
				return f(nv).then(process);
			} else {
				console.log(`\rImproper descriptor: ${nv}`);
			}
		} else setTimeout(process, 1000);
	}
	create(domain, '/', (request: NodeSiteRequest) => {
		if (request.uri === '/404.html') {
			return ({ statusCode: 404, body: `<h1>404 Not Found</h1>` });
		} else if (request.uri === '/') {
			return rewrite(request, 'index.html');
		} else {
			console.log(`\rMissing URI requested: ${request.uri}`);
			return rewrite(request, '../../404.html');
		}
	});
	const { NodeSiteClient } = require('.');
	function start () {
		if (NodeSiteClient.insSocketIO) {
			NodeSiteClient.insSocketIO.on('challenge_success', process);
		} else {
			setTimeout(start, 300);
		}
	}
	return start();
}

export default dynamic;
module.exports = dynamic;

Object.assign(dynamic, {
	default: dynamic,
	dynamic,
});
