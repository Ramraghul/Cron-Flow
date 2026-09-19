import { assertPublicUrl, HostResolver, isNonPublicAddress, NonPublicAddressError } from './network.util';

describe('isNonPublicAddress', () => {
    it.each([
        '127.0.0.1',
        '10.1.2.3',
        '172.16.0.1',
        '172.31.255.255',
        '192.168.1.1',
        '169.254.169.254',
        '100.64.0.1',
        '0.0.0.0',
        '::1',
        'fd12:3456::1',
        'fe80::1',
        '::ffff:127.0.0.1',
    ])('blocks %s', (address) => {
        expect(isNonPublicAddress(address)).toBe(true);
    });

    it.each(['8.8.8.8', '1.1.1.1', '172.32.0.1', '2606:4700:4700::1111'])('allows public address %s', (address) => {
        expect(isNonPublicAddress(address)).toBe(false);
    });

    it('throws for input that is not an IP address', () => {
        expect(() => isNonPublicAddress('example.com')).toThrow(TypeError);
    });
});

describe('assertPublicUrl', () => {
    let resolve: jest.Mock<ReturnType<HostResolver>, Parameters<HostResolver>>;

    beforeEach(() => {
        resolve = jest.fn<ReturnType<HostResolver>, Parameters<HostResolver>>();
    });

    it('allows a hostname that resolves only to public addresses', async () => {
        resolve.mockResolvedValue(['93.184.216.34']);

        await expect(assertPublicUrl(new URL('https://example.com/hook'), resolve)).resolves.toBeUndefined();
        expect(resolve).toHaveBeenCalledWith('example.com');
    });

    it('rejects a hostname when any of its addresses is non-public', async () => {
        resolve.mockResolvedValue(['93.184.216.34', '10.0.0.5']);

        await expect(assertPublicUrl(new URL('https://internal.example.com'), resolve)).rejects.toThrow(
            new NonPublicAddressError('Refusing to call "internal.example.com": it resolves to non-public address 10.0.0.5'),
        );
    });

    it('checks IP literals directly, including bracketed IPv6, without DNS lookups', async () => {
        await expect(
            assertPublicUrl(new URL('http://169.254.169.254/latest/meta-data'), resolve),
        ).rejects.toBeInstanceOf(NonPublicAddressError);
        await expect(assertPublicUrl(new URL('http://[::1]:8080/'), resolve)).rejects.toBeInstanceOf(NonPublicAddressError);
        await expect(assertPublicUrl(new URL('https://1.1.1.1/dns-query'), resolve)).resolves.toBeUndefined();

        expect(resolve).not.toHaveBeenCalled();
    });

    it('propagates DNS resolution failures', async () => {
        resolve.mockRejectedValue(new Error('getaddrinfo ENOTFOUND nowhere.invalid'));

        await expect(assertPublicUrl(new URL('https://nowhere.invalid'), resolve)).rejects.toThrow('ENOTFOUND');
    });
});
