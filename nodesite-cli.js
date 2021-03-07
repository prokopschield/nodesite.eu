#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const nodesite_eu_1 = require("./nodesite.eu");
const node_fetch_1 = require("node-fetch");
const path_1 = require("path");
const fs_1 = require("fs");
const options = {
    action: 'init',
    entry: process.env.index || process.env.entry || 'index.html',
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
        if (!options.site || !options.entry) {
            console.log(`Correct usage: nodesite init <domain>`);
            console.log(`E.g. nodesite init test`);
        }
        let domain = options.site.toLowerCase().replace(/[^a-z0-9\-\.]/g, '');
        domain.match(/[^a-z0-9\-]/) ? domain : (domain += '.nodesite.eu');
        nodesite_eu_1.create(domain, '/', null, '.');
        async function uploadFile(file, paths) {
            paths || (paths = [
                path_1.posix.format({
                    root: '/',
                    base: path_1.posix.relative('.', file).replace(/\\+/g, '/'),
                }),
                path_1.posix.format({
                    root: '/',
                    base: path_1.posix.relative('./build/', file).replace(/\\+/g, '/'),
                }),
                path_1.posix.format({
                    root: '/',
                    base: path_1.posix.relative('./public/', file).replace(/\\+/g, '/'),
                }),
                path_1.posix.format({
                    root: '/',
                    base: path_1.posix.relative('./dist/', file).replace(/\\+/g, '/'),
                }),
            ]);
            const desc = await node_fetch_1.default('https://hosting.nodesite.eu/static/upload', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/octet-stream',
                    'X-NodeSite': 'NodeSite-CLI',
                },
                body: fs_1.createReadStream(file),
            }).then(response => response.text());
            paths.filter(a => !a.includes('..')).forEach(p => {
                nodesite_eu_1.rawwrite('static', domain, p, desc);
                nodesite_eu_1.create(domain, p, () => {
                    nodesite_eu_1.rawwrite('static', domain, p, desc);
                    return ({
                        statusCode: 302,
                        head: {
                            location: `https://${domain}${p}`,
                        }
                    });
                });
            });
        }
        async function scandir(dir) {
            const scan = fs_1.readdirSync(dir);
            for (const f of scan) {
                const rel = path_1.resolve(dir, f);
                const stat = fs_1.statSync(rel);
                if (stat.isDirectory()) {
                    await scandir(rel);
                }
                else {
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
