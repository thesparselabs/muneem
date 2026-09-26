import { describe, expect, it } from 'vitest';
import { createHash, createPublicKey, generateKeyPairSync, verify } from 'node:crypto';
import { deviceTimestamp, signingString } from '../src/main/infra/signing.js';
import { signRequest } from '../src/main/infra/cloudClient.js';

const sha = (s: string) => createHash('sha256').update(s).digest('hex');

describe('device request signing (shared string with the Go server)', () => {
  it('builds METHOD\\nPATH\\nTIMESTAMP\\nsha256hex(body)', () => {
    expect(signingString('post', '/v1/devices/register', '1790467200', '{"a":1}')).toBe(`POST\n/v1/devices/register\n1790467200\n${sha('{"a":1}')}`);
    expect(deviceTimestamp(1790467200999)).toBe('1790467200'); // unix seconds, floored, decimal string
    expect(signingString('GET', '/v1/health', 't', undefined)).toBe(`GET\n/v1/health\nt\n${sha('')}`);
    expect(sha('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  });
  it('signature verifies with the raw 32-byte public key the device registers', () => {
    const { publicKey, privateKey } = generateKeyPairSync('ed25519');
    const pem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
    const raw = (publicKey.export({ type: 'spki', format: 'der' }) as Buffer).subarray(-32);
    const sig = signRequest(pem, 'POST', '/v1/x', 'ts', '{}');
    // rebuild SPKI from the raw key exactly as Go's ed25519.PublicKey (raw 32 bytes) would be wrapped
    const spki = Buffer.concat([Buffer.from('302a300506032b6570032100', 'hex'), raw]);
    const pub = createPublicKey({ key: spki, format: 'der', type: 'spki' });
    expect(verify(null, Buffer.from(signingString('POST', '/v1/x', 'ts', '{}')), pub, Buffer.from(sig, 'base64'))).toBe(true);
    expect(verify(null, Buffer.from(signingString('POST', '/v1/y', 'ts', '{}')), pub, Buffer.from(sig, 'base64'))).toBe(false);
  });
});
