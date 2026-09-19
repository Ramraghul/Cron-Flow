import { lookup } from 'node:dns/promises';
import { BlockList, isIP } from 'node:net';

/**
 * Address ranges that user-defined HTTP steps must not reach (SSRF protection):
 * loopback, private networks, link-local (incl. cloud metadata at 169.254.169.254), etc.
 * IPv4-mapped IPv6 addresses (::ffff:a.b.c.d) are matched against the IPv4 rules by Node.
 */
const NON_PUBLIC_RANGES = new BlockList();
NON_PUBLIC_RANGES.addSubnet('0.0.0.0', 8, 'ipv4'); // "this" network
NON_PUBLIC_RANGES.addSubnet('10.0.0.0', 8, 'ipv4'); // private
NON_PUBLIC_RANGES.addSubnet('100.64.0.0', 10, 'ipv4'); // carrier-grade NAT
NON_PUBLIC_RANGES.addSubnet('127.0.0.0', 8, 'ipv4'); // loopback
NON_PUBLIC_RANGES.addSubnet('169.254.0.0', 16, 'ipv4'); // link-local / cloud metadata
NON_PUBLIC_RANGES.addSubnet('172.16.0.0', 12, 'ipv4'); // private
NON_PUBLIC_RANGES.addSubnet('192.168.0.0', 16, 'ipv4'); // private
NON_PUBLIC_RANGES.addSubnet('224.0.0.0', 4, 'ipv4'); // multicast
NON_PUBLIC_RANGES.addSubnet('240.0.0.0', 4, 'ipv4'); // reserved
NON_PUBLIC_RANGES.addAddress('::', 'ipv6'); // unspecified
NON_PUBLIC_RANGES.addAddress('::1', 'ipv6'); // loopback
NON_PUBLIC_RANGES.addSubnet('fc00::', 7, 'ipv6'); // unique local
NON_PUBLIC_RANGES.addSubnet('fe80::', 10, 'ipv6'); // link-local
NON_PUBLIC_RANGES.addSubnet('ff00::', 8, 'ipv6'); // multicast

export class NonPublicAddressError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'NonPublicAddressError';
    }
}

/** Resolves a hostname to every IP address it maps to. Injectable for tests. */
export type HostResolver = (hostname: string) => Promise<string[]>;

const resolveAllAddresses: HostResolver = async (hostname) =>
    (await lookup(hostname, { all: true })).map((entry) => entry.address);

export function isNonPublicAddress(address: string): boolean {
    const family = isIP(address);
    if (family === 0) {
        throw new TypeError(`"${address}" is not an IP address`);
    }
    return NON_PUBLIC_RANGES.check(address, family === 6 ? 'ipv6' : 'ipv4');
}

/**
 * Throws {@link NonPublicAddressError} if the URL's host is, or resolves to, a non-public address.
 * Checking every resolved address stops hostnames that point at internal services.
 */
export async function assertPublicUrl(url: URL, resolve: HostResolver = resolveAllAddresses): Promise<void> {
    const hostname = url.hostname.replace(/^\[(.*)\]$/, '$1');
    const addresses = isIP(hostname) ? [hostname] : await resolve(hostname);
    const blocked = addresses.find(isNonPublicAddress);

    if (blocked) {
        throw new NonPublicAddressError(`Refusing to call "${url.hostname}": it resolves to non-public address ${blocked}`);
    }
}
