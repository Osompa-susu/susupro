// SMS provider integration (Arkesel — a Ghana-focused SMS gateway with
// direct routes to MTN/Telecel/AirtelTigo, pay-as-you-go via Mobile
// Money). Isolated in this one file deliberately: ledgerService.js
// calls `sendSms()` without knowing or caring which provider is behind
// it, so switching providers later touches only this file.
//
// IMPORTANT — cannot be verified in this environment: this integration
// is built against Arkesel's documented v2 SMS API shape (POST
// https://sms.arkesel.com/api/v2/sms/send, `api-key` header, JSON body
// with sender/message/recipient), but has never been executed against
// a live Arkesel account — there is no network access available to
// test it here. Before relying on this in production: create a real
// Arkesel account, get a sender ID approved (this takes real time —
// commonly 1-2 weeks for a business name to be approved on all three
// networks), and send at least one real test message end-to-end.
const env = require('../config/env');

function normalizeGhanaPhone(phone) {
  // Accepts local format (0240000001) or already-international
  // (233240000001) and always returns international, since that's
  // the safer format across Ghanaian SMS gateways.
  const digits = String(phone).replace(/\D/g, '');
  if (digits.startsWith('233')) return digits;
  if (digits.startsWith('0')) return '233' + digits.slice(1);
  return digits;
}

async function sendSms({ phone, message }) {
  if (!env.SMS_API_KEY) {
    // Fails loudly rather than silently pretending to send — a
    // missing API key should never look like a successful send.
    throw Object.assign(new Error('SMS_API_KEY is not configured'), { code: 'SMS_NOT_CONFIGURED' });
  }

  const recipient = normalizeGhanaPhone(phone);
  const res = await fetch('https://sms.arkesel.com/api/v2/sms/send', {
    method: 'POST',
    headers: {
      'api-key': env.SMS_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      sender: env.SMS_SENDER_ID || 'SusuPro',
      message,
      recipients: [recipient],
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.status !== 'success') {
    throw Object.assign(new Error('SMS provider rejected the message'), { code: 'SMS_SEND_FAILED', providerResponse: data });
  }
  return data;
}

module.exports = { sendSms, normalizeGhanaPhone };
