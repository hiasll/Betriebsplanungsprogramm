/** Runtime bindings used by this application. */
interface D1Result<T=Record<string,unknown>> {success:boolean;results:T[];meta:{changes:number;[key:string]:unknown};error?:string}
interface D1PreparedStatement {bind(...values:unknown[]):D1PreparedStatement;first<T=Record<string,unknown>>(column?:string):Promise<T|null>;all<T=Record<string,unknown>>():Promise<D1Result<T>>;run<T=Record<string,unknown>>():Promise<D1Result<T>>;raw<T=unknown[]>():Promise<T[]>}
interface D1Database {prepare(sql:string):D1PreparedStatement;batch<T=Record<string,unknown>>(statements:D1PreparedStatement[]):Promise<D1Result<T>[]>;exec(sql:string):Promise<unknown>;dump():Promise<ArrayBuffer>}
interface Fetcher {fetch(request:Request):Promise<Response>}
interface AppBucket {put(key:string,value:ReadableStream|ArrayBuffer|string,options?:{httpMetadata?:{contentType?:string}}):Promise<unknown>;get(key:string):Promise<{body:ReadableStream}|null>}
declare module 'cloudflare:workers' {export const env:{DB:D1Database;BUCKET:AppBucket}}
