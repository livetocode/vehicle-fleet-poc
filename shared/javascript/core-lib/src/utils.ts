// import { setTimeout } from 'node:timers/promises';

export async function sleep(delay: number) {
    return new Promise<void>((resolve, reject) => {
        setTimeout(() => {
            resolve();
        }, delay);
    });
}

// export async function sleep(delay: number): Promise<void> {
//     return setTimeout(delay, undefined);
// }

// /**
//  * Return a promise that is resolved after a given delay, or after being cancelled.
//  *
//  * @param  {number} duration The delay, in milliseconds.
//  * @param  {AbortSignal|null} signal An optional AbortSignal to cancel the delay.
//  *
//  * @return {Promise<void>} A promise that is either resolved after the delay, or rejected after the signal is cancelled.
//  */
// export async function abortableSleep(duration: number, signal: AbortSignal): Promise<void> {

//     if (signal.aborted) {
//         return;
//     }
//     try {
//         await setTimeout(duration, undefined, { signal });
//     } catch(err: any) {
//         if (err?.name === 'AbortError') {
//             return;
//         } else {
//             throw err;
//         }
//     }
// }

export interface Deferred<T> extends Promise<T> {
    /**
     * Resolves the Deferred to a value T
     * @param value
     */
    resolve: (value?: T | PromiseLike<T>) => void;
    //@ts-ignore: tsc guard
    /**
     * Rejects the Deferred
     * @param reason
     */
    reject: (reason?: any) => void;
}
  
/**
 * Returns a Promise that has a resolve/reject methods that can
 * be used to resolve and defer the Deferred.
 */
export function deferred<T>(): Deferred<T> {
    let methods = {};
    const p = new Promise<T>((resolve, reject): void => {
        methods = { resolve, reject };
    });
    return Object.assign(p, methods) as Deferred<T>;
}
  
export function randomUUID() {
    // Note that if we don't serve the site over https, the crypto.randomUUID() would not exist!
    // See https://stackoverflow.com/questions/74911304/crypto-module-not-loading-randomuuid-when-viewing-a-local-network-ip-address
    const cryptoRandomUUID = (crypto as any).randomUUID;
    if (cryptoRandomUUID) {
        return crypto.randomUUID();
    }
    return new Date().getTime().toString();
}
