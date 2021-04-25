/// <reference types="node" />
declare const blake: (input: string) => string;
declare const open_file_options: string[];
import { Socket } from "socket.io-client";
declare let insSocketIO: Socket;
declare let sites: {
    [domain: string]: {
        [path: string]: {
            listener?: Listener;
            file?: string;
        };
    };
};
declare type ListenerResponse = string | Buffer | {
    statusCode?: number;
    body?: string | Buffer;
    head?: {
        [header: string]: string;
    };
};
declare type Listener = (request: NodeSiteRequest) => ListenerResponse | Promise<ListenerResponse>;
declare const deferred_challenges: Function[];
declare const solved: {
    [site: string]: string;
};
declare let init: () => Promise<void>;
declare let redo: () => Promise<void>;
interface NodeSiteRequest {
    iid: number;
    host: string;
    method: string;
    uri: string;
    body: string | Buffer;
    head: NodeSiteRequestHeaders;
}
interface NodeSiteRequestHeaders {
    [key: string]: string | undefined;
    host: string;
    connection?: string;
    cookie?: string;
    'user-agent'?: string;
    accept?: string;
    'sec-fetch-site'?: string;
    'sec-fetch-mode'?: string;
    'sec-fetch-dest'?: string;
    referer?: string;
    'accept-encoding'?: string;
    'accept-language'?: string;
}
declare const requestHandlerProxy: (request: NodeSiteRequest) => Promise<void>;
declare type NodeSiteSocketListener = (socket: NodeSiteClientSocket, site: string) => void;
declare const IOListener: {
    (cb: NodeSiteSocketListener): void;
    socketListeners: Array<NodeSiteSocketListener>;
    registerSocketListener(cb: NodeSiteSocketListener): void;
    newsocket(id: any): NodeSiteClientSocket;
    sockets: {
        [iid: number]: NodeSiteClientSocket;
    };
    receive(id: number, site: string, e: string, args: Array<any>): Promise<void>;
};
interface NodeSiteClientSocket {
    (...args: Array<any>): void;
    id: any;
    send(...args: Array<any>): void;
    listeners: {
        [e: string]: {
            perm: Function[];
            once: Function[];
        };
    };
    listenersAny: Function[];
    onAny(f: Function): number;
    on(event: string, cb: Function, once: boolean): NodeSiteClientSocket;
    once(event: string, cb: Function): NodeSiteClientSocket;
    emit: (...args: Array<any>) => void;
    write: (...args: Array<any>) => void;
    receive(e: string, args?: any[]): Promise<void>;
}
declare const NodeSiteClient: {
    (domain: string, path?: string, listener?: Listener | undefined, file?: string): void;
    proxy(hostListen: string, hostPath?: string, urlPoint?: string, fetchOptions?: {}): void;
    create: any;
    init: () => Promise<void>;
    sites: {
        [domain: string]: {
            [path: string]: {
                listener?: Listener | undefined;
                file?: string | undefined;
            };
        };
    };
    redo: () => Promise<void>;
    io: {
        (cb: NodeSiteSocketListener): void;
        socketListeners: Array<NodeSiteSocketListener>;
        registerSocketListener(cb: NodeSiteSocketListener): void;
        newsocket(id: any): NodeSiteClientSocket;
        sockets: {
            [iid: number]: NodeSiteClientSocket;
        };
        receive(id: number, site: string, e: string, args: Array<any>): Promise<void>;
    };
    IOListener: {
        (cb: NodeSiteSocketListener): void;
        socketListeners: Array<NodeSiteSocketListener>;
        registerSocketListener(cb: NodeSiteSocketListener): void;
        newsocket(id: any): NodeSiteClientSocket;
        sockets: {
            [iid: number]: NodeSiteClientSocket;
        };
        receive(id: number, site: string, e: string, args: Array<any>): Promise<void>;
    };
    NodeSiteClient: any;
    rawwrite: typeof rawwrite;
};
export declare const proxy: (hostListen: string, hostPath?: string, urlPoint?: string, fetchOptions?: {}) => void;
export declare const create: {
    (domain: string, path?: string, listener?: Listener | undefined, file?: string): void;
    proxy(hostListen: string, hostPath?: string, urlPoint?: string, fetchOptions?: {}): void;
    create: any;
    init: () => Promise<void>;
    sites: {
        [domain: string]: {
            [path: string]: {
                listener?: Listener | undefined;
                file?: string | undefined;
            };
        };
    };
    redo: () => Promise<void>;
    io: {
        (cb: NodeSiteSocketListener): void;
        socketListeners: Array<NodeSiteSocketListener>;
        registerSocketListener(cb: NodeSiteSocketListener): void;
        newsocket(id: any): NodeSiteClientSocket;
        sockets: {
            [iid: number]: NodeSiteClientSocket;
        };
        receive(id: number, site: string, e: string, args: Array<any>): Promise<void>;
    };
    IOListener: {
        (cb: NodeSiteSocketListener): void;
        socketListeners: Array<NodeSiteSocketListener>;
        registerSocketListener(cb: NodeSiteSocketListener): void;
        newsocket(id: any): NodeSiteClientSocket;
        sockets: {
            [iid: number]: NodeSiteClientSocket;
        };
        receive(id: number, site: string, e: string, args: Array<any>): Promise<void>;
    };
    NodeSiteClient: any;
    rawwrite: typeof rawwrite;
}, io: {
    (cb: NodeSiteSocketListener): void;
    socketListeners: Array<NodeSiteSocketListener>;
    registerSocketListener(cb: NodeSiteSocketListener): void;
    newsocket(id: any): NodeSiteClientSocket;
    sockets: {
        [iid: number]: NodeSiteClientSocket;
    };
    receive(id: number, site: string, e: string, args: Array<any>): Promise<void>;
};
export { NodeSiteClient, init, sites, redo, IOListener };
export declare function rawwrite(e: string, ...args: any[]): void;
export { blake, deferred_challenges, open_file_options, requestHandlerProxy, solved, insSocketIO, Listener, ListenerResponse, NodeSiteClientSocket, NodeSiteSocketListener, NodeSiteRequest, NodeSiteRequestHeaders, };
export default NodeSiteClient;
