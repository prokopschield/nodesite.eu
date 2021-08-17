import { NodeSiteClient } from './nodesite.eu';

for (const [modname, modpath] of Object.entries({
	proxy: './modules/proxy/',
})) {
	for (const target of [module.exports, NodeSiteClient]) {
		Object.defineProperty(target, modname, {
			get: () => require(modpath).default,
			enumerable: true,
		});
	}
}

export default module.exports;
