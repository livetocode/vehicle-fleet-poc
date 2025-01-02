export async function sleep(delay: number) {
    return new Promise<void>((resolve, reject) => {
        setTimeout(() => {
            resolve();
        }, delay);
    });
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
