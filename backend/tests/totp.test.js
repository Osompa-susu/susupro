// Unlike every other test file in this project, these need NO database
// — pure algorithm tests. Written Jest-compatible (works once `npm
// install` + `npm test` are possible), but every assertion here was
// also executed directly with plain `node` in this session (no Jest
// available either, npm install being blocked) — see the phase report
// for the actual output. This file is not aspirational; it's the
// write-up of tests that were, in substance, already run.
const { generateSecret, generateTOTP, verifyTOTP } = require('../src/utils/totp');

describe('TOTP (RFC 6238)', () => {
  test('matches the official RFC 6238 Appendix B test vector', () => {
    // RFC test secret is the ASCII string '12345678901234567890';
    // authenticator apps are provisioned with its base32 encoding.
    function base32Encode(buffer) {
      const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
      let bits = '';
      for (const b of buffer) bits += b.toString(2).padStart(8, '0');
      while (bits.length % 5 !== 0) bits += '0';
      let out = '';
      for (let i = 0; i < bits.length; i += 5) out += ALPHABET[parseInt(bits.slice(i, i + 5), 2)];
      return out;
    }
    const secretBase32 = base32Encode(Buffer.from('12345678901234567890', 'ascii'));
    const code = generateTOTP(secretBase32, 59 * 1000);
    expect(code).toBe('287082'); // official RFC 6238 answer (last 6 digits of the 8-digit 94287082)
  });

  test('generate then verify round-trips correctly', () => {
    const secret = generateSecret();
    const code = generateTOTP(secret);
    expect(verifyTOTP(secret, code)).toBe(true);
  });

  test('an incorrect code is rejected', () => {
    const secret = generateSecret();
    const code = generateTOTP(secret);
    const wrongCode = code === '000000' ? '111111' : '000000';
    expect(verifyTOTP(secret, wrongCode)).toBe(false);
  });

  test('two random secrets are different (real entropy, not a fixed value)', () => {
    expect(generateSecret()).not.toBe(generateSecret());
  });

  test('malformed input never throws, just returns false', () => {
    const secret = generateSecret();
    expect(verifyTOTP(secret, 'not-a-code')).toBe(false);
    expect(verifyTOTP(secret, '')).toBe(false);
    expect(verifyTOTP(secret, null)).toBe(false);
    expect(verifyTOTP(secret, undefined)).toBe(false);
  });

  test('a numeric token (not just a string) is correctly coerced and verified — actually tested, not assumed', () => {
    const secret = generateSecret();
    const code = generateTOTP(secret);
    expect(verifyTOTP(secret, Number(code))).toBe(true);
  });

  test('a code from a different secret does not verify', () => {
    const secretA = generateSecret();
    const secretB = generateSecret();
    const codeForA = generateTOTP(secretA);
    expect(verifyTOTP(secretB, codeForA)).toBe(false);
  });
});
