import { create, rawwrite } from './nodesite.eu';
import fetch from 'node-fetch';
import { posix as path } from 'path';
import { readdirSync, readFileSync, statSync } from 'fs';

const options: {
	action: 'init';
	site?: string;
} = {
	action: 'init',
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
		if (!options.site) {
			console.log(`Correct usage: nodesite init <domain>.nodesite.eu`);
		}
		let domain = options.site.toLowerCase().replace(/[^a-z0-9\-\.]/g, '');
		domain.match(/[^a-z0-9\-]/) ? domain : (domain += '.nodesite.eu');
		create(domain, '/', null, '.');
		async function uploadFile (file: string) {
			const paths: string[] = [
				path.format({
					root: '/',
					base: path.relative('.', file),
				}),
				path.format({
					root: '/',
					base: path.relative('./build/', file),
				}),
				path.format({
					root: '/',
					base: path.relative('./public/', file),
				}),
				path.format({
					root: '/',
					base: path.relative('./dist/', file),
				}),
			];
			const desc = await fetch('https://hosting.nodesite.eu/static/upload', {
				method: 'PUT',
				headers: {
					'Content-Type': 'application/octet-stream',
					'X-NodeSite': 'NodeSite-CLI',
				},
				body: readFileSync(file),
			}).then(response => response.text());
			paths.forEach(p => {
				rawwrite('static', domain, p, desc);
			});
		}
		async function scandir (dir: string) {
			const scan = readdirSync(dir);
			for (const f of scan) {
				const rel = path.resolve(dir, f);
				const stat = statSync(rel);
				if (stat.isDirectory()) {
					await scandir(rel);
				} else {
					await uploadFile(rel);
				}
			}
		}
		scandir('.');
	}
}