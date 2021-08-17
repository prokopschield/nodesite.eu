import http from 'http';
import https from 'https';
import { create } from '../../nodesite.eu';

export interface Options {}

const DEFAULT_OPTIONS: Options = {};

/**
 * Proxy a URL to nodesite.eu
 * @param {string} from URL to proxy, for example 'http://localhost:3000'
 * @param {string} to NodeSite name, for example 'proxy.nodesite.eu'
 */
export function proxy(from: string, to: string, options: Options = {}) {
	const opts = Object.assign({}, DEFAULT_OPTIONS, options);
	const url = new URL(from);
	const protocol = url.protocol === 'https:' ? https : http;
	create(to, '/', async (request) => {
		return new Promise((resolve) => {
			const read_url = new URL(`${url.protocol}//${url.host}${request.uri}`);
			const req = protocol.request(read_url, (res) => {
				const ret: {
					statusCode: number;
					head: {
						[name: string]: undefined | string | string[];
					};
					body?: Buffer;
				} = {
					statusCode: res.statusCode || 200,
					head: {},
				};
				for (const [name, value] of Object.entries(res.headers)) {
					ret.head[name] = value;
				}
				const rb = Array<Buffer>();
				res.on('data', (c) => rb.push(c));
				res.on('end', () => {
					ret.body = Buffer.concat(rb);
					resolve(ret);
				});
			});
			Object.assign(request.head, {
				host: url.host,
			});
			for (const [name, value] of Object.entries(request.head)) {
				value && req.setHeader(name, value);
			}
			request.body && req.write(request.body);
			req.end();
		});
	});
}

export default proxy;

Object.defineProperties(proxy, {
	default: {
		get: () => proxy,
	},
	proxy: {
		get: () => proxy,
	},
});
