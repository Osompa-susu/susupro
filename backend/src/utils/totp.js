// TOTP (RFC 6238) implemented with zero external dependencies —
// deliberately, since npm install is unavailable in this environment,
// and there's no reason a 30-line HMAC-based algorithm needs a package
// anyway. Uses Node's built-in crypto module only.
const crypto = require('crypto');

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const STEP_SECONDS = 30;
const DIGITS = 6;

function generateSecret(byteLength = 20) {
  const bytes = crypto.randomBytes(byteLength);
  let bits = '';
  for (const b of bytes) bits += b.toString(2).padStart(8, '0');
  let secret = '';
  for (let i = 0; i + 5 <= bits.length; i += 5) {
    secret += BASE32_ALPHABET[parseInt(bits.slice(i, i + 5), 2)];
  }
  return secret;
}

function base32Decode(base32) {
  const clean = base32.toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = '';
  for (const char of clean) {
    const val = BASE32_ALPHABET.indexOf(char);
    if (val === -1) continue;
    bits += val.toString(2).padStart(5, '0');
  }
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  }
  return Buffer.from(bytes);
}

function hotp(secretBuffer, counter) {
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(counter));
  const hmac = crypto.createHmac('sha1', secretBuffer).update(counterBuffer).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binCode = ((hmac[offset] & 0x7f) << 24) | ((hmac[offset + 1] & 0xff) << 16) | ((hmac[offset + 2] & 0xff) << 8) | (hmac[offset + 3] & 0xff);
  return String(binCode % 10 ** DIGITS).padStart(DIGITS, '0');
}

function generateTOTP(base32Secret, forTimeMs = Date.now()) {
  const counter = Math.floor(forTimeMs / 1000 / STEP_SECONDS);
  return hotp(base32Decode(base32Secret), counter);
}

// Allows a ±1 step window (±30s) for clock drift between server and
// whatever authenticator app the admin is using — standard TOTP practice.
function verifyTOTP(base32Secret, token, window = 1) {
  if (token === null || token === undefined || token === '') return false;
  // A number-typed token that legitimately starts with 0 (e.g. the
  // TOTP value 007123) loses that leading zero when coerced through
  // Number — restore it before comparing. Strings are left as-is and
  // must already be exactly 6 digits, so a truncated/malformed string
  // input isn't silently "fixed" into something that happens to match.
  let str = String(token);
  if (typeof token === 'number') str = str.padStart(6, '0');
  if (!/^\d{6}$/.test(str)) return false;

  const nowCounter = Math.floor(Date.now() / 1000 / STEP_SECONDS);
  const secretBuffer = base32Decode(base32Secret);
  for (let errorWindow = -window; errorWindow <= window; errorWindow++) {
    if (hotp(secretBuffer, nowCounter + errorWindow) === str) return true;
  }
  return false;
}

module.exports = { generateSecret, generateTOTP, verifyTOTP };
