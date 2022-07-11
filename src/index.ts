import modules from './modules';
import { create, Listener } from './nodesite.eu';

function NodeSiteClient(
	domain: string,
	path?: string,
	listener?: Listener,
	file?: string
): void {
	return create(domain, path, listener, file);
}

export * from './nodesite.eu';
export { modules };

export default NodeSiteClient;
module.exports = NodeSiteClient;

Object.assign(NodeSiteClient, {
	default: NodeSiteClient,
	...create,
	modules,
});
