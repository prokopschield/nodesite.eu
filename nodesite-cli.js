"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const nodesite_eu_1 = require("./nodesite.eu");
const node_fetch_1 = require("node-fetch");
const path_1 = require("path");
const fs_1 = require("fs");
const options = {
    action: 'init',
};
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
        nodesite_eu_1.create(domain, '/', null, '.');
        async function uploadFile(file) {
            const paths = [
                path_1.posix.format({
                    root: '/',
                    base: path_1.posix.relative('.', file),
                }),
                path_1.posix.format({
                    root: '/',
                    base: path_1.posix.relative('./build/', file),
                }),
                path_1.posix.format({
                    root: '/',
                    base: path_1.posix.relative('./public/', file),
                }),
                path_1.posix.format({
                    root: '/',
                    base: path_1.posix.relative('./dist/', file),
                }),
            ];
            const desc = await node_fetch_1.default('https://hosting.nodesite.eu/static/upload', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/octet-stream',
                    'X-NodeSite': 'NodeSite-CLI',
                },
                body: fs_1.readFileSync(file),
            }).then(response => response.text());
            paths.forEach(p => {
                nodesite_eu_1.rawwrite('static', domain, p, desc);
            });
        }
        async function scandir(dir) {
            const scan = fs_1.readdirSync(dir);
            for (const f of scan) {
                const rel = path_1.posix.resolve(dir, f);
                const stat = fs_1.statSync(rel);
                if (stat.isDirectory()) {
                    await scandir(rel);
                }
                else {
                    await uploadFile(rel);
                }
            }
        }
        scandir('.');
    }
}
