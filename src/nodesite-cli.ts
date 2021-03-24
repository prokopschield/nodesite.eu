#!/usr/bin/env node

import { create, rawwrite } from './nodesite.eu';
import fetch from 'node-fetch';
import { posix as path, resolve as syspath_resolve } from 'path';
import { createReadStream, readdirSync, statSync } from 'fs';

const options: {
	action: 'init';
	site: string;
	entry: string;
} = {
	action: 'init',
	site: 'cli-default',
	entry: process.env.index || process.env.entry || 'index.html',
}

for (const arg of process.argv) {
	switch (arg) {
		case 'init':
		{
			options.action = arg;
			break;
		}
		default:
		{
			options.site = arg;
			break;
		}
	}
}

switch (options.action) {
	case 'init': {
		if (!options.site || !options.entry) {
			console.log(`Correct usage: nodesite init <domain>`);
			console.log(`E.g. nodesite init test`);
		}
		let domain = options.site.toLowerCase().replace(/[^a-z0-9\-\.]/g, '');
		domain.match(/[^a-z0-9\-]/) ? domain : (domain += '.nodesite.eu');
		create(domain, '/', void 0, '.');
		async function uploadFile (file: string, paths?: string[]) {
			paths ||= [
				path.format({
					root: '/',
					base: path.relative('.', file).replace(/\\+/g, '/'),
				}),
				path.format({
					root: '/',
					base: path.relative('./build/', file).replace(/\\+/g, '/'),
				}),
				path.format({
					root: '/',
					base: path.relative('./public/', file).replace(/\\+/g, '/'),
				}),
				path.format({
					root: '/',
					base: path.relative('./dist/', file).replace(/\\+/g, '/'),
				}),
			];
			const desc = await fetch('https://hosting.nodesite.eu/static/upload', {
				method: 'PUT',
				headers: {
					'Content-Type': 'application/octet-stream',
					'X-NodeSite': 'NodeSite-CLI',
				},
				body: createReadStream(file),
			}).then(response => response.text());
			paths.filter(a=>!a.includes('..')).forEach(p => {
				rawwrite('static', domain, p, desc);
				create(domain, p, async () => {
					rawwrite('static', domain, p, desc);
					return ({
						statusCode: 302,
						head: {
							location: `https://${domain}${p}`,
						}
					});
				});
			});
		}
		async function scandir (dir: string) {
			const scan = readdirSync(dir);
			for (const f of scan) {
				const rel = syspath_resolve(dir, f);
				const stat = statSync(rel);
				if (stat.isDirectory()) {
					await scandir(rel);
				} else {
					await uploadFile(rel);
				}
			}
		}
		
		if (options.entry) {
			setTimeout(() => uploadFile(options.entry, ['/']), 10000);
		}
		setTimeout(() => scandir('.'), 12000);
	}
}
