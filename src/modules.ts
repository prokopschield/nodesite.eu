import { NodeSiteClient } from './nodesite.eu';

for (const [modname, modpath] of Object.entries({
	proxy: '../modules/nodesite-proxy/',
})) {
	for (const target of [module.exports, NodeSiteClient]) {
		Object.defineProperty(target, modname, {
			get: () => require(modpath),
			enumerable: true,
		});
	}
}

export default module.exports;
