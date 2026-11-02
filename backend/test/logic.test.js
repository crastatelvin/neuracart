// Pure-logic tests: no database, no network. Run with `npm test`.
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL ??= 'postgresql://localmart:localmart@localhost:5432/localmart';
process.env.JWT_ACCESS_SECRET ??= 'test-access-secret-that-is-long-enough';
process.env.JWT_REFRESH_SECRET ??= 'test-refresh-secret-that-is-long-enough';
process.env.OTP_PEPPER ??= 'test-otp-pepper-that-is-long-enough';

const test = require('node:test');
const assert = require('node:assert/strict');

const { hashOtp, verifyOtpHash, getOtpExpiry, isExpired } = require('../src/utils/otp');
const {
  istMinutes,
  startOfIstDay,
  startOfIstWeek,
  startOfIstPeriod,
  formatIstDate,
} = require('../src/utils/ist');
const { buildUpiIntent, makeUpiAck } = require('../src/modules/money/upi');
const { effectivePrice } = require('../src/modules/deals/deals.service');
const { tierForSpend } = require('../src/modules/money/money.service');

test('OTP hashes verify only for the same code and user', () => {
  const hash = hashOtp('123456', 'user-a');
  assert.equal(verifyOtpHash('123456', 'user-a', hash), true);
  assert.equal(verifyOtpHash('123456', 'user-b', hash), false);
  assert.equal(verifyOtpHash('654321', 'user-a', hash), false);
  assert.equal(verifyOtpHash('123456', 'user-a', 'not-hex'), false);
});

test('OTP expiry respects the configured window', () => {
  const now = new Date('2026-01-01T10:00:00Z');
  const expiry = getOtpExpiry(now);
  assert.equal(isExpired(expiry, now), false);
  assert.equal(isExpired(expiry, new Date(expiry.getTime() + 1)), true);
});

test('IST day boundaries land at 18:30 UTC', () => {
  const noonUtc = new Date('2026-01-01T12:00:00Z');
  assert.equal(startOfIstDay(noonUtc).toISOString(), '2025-12-31T18:30:00.000Z');
  assert.equal(formatIstDate(new Date('2026-01-01T19:00:00Z')), '2026-01-02');
  assert.equal(istMinutes(new Date('2026-01-01T00:00:00Z')), 330);
});

test('IST week starts Monday and "all" has no start', () => {
  const wednesday = new Date('2026-01-07T06:00:00Z');
  assert.equal(startOfIstWeek(wednesday).toISOString(), '2026-01-04T18:30:00.000Z');
  assert.equal(startOfIstPeriod('all', wednesday), null);
});

test('UPI intent carries the VPA, amount and order reference', () => {
  const intent = buildUpiIntent({ orderNumber: 'LM-1', amount: 249.5 });
  assert.match(intent, /^upi:\/\/pay\?/);
  const query = new URLSearchParams(intent.split('?')[1]);
  assert.equal(query.get('am'), '249.50');
  assert.equal(query.get('cu'), 'INR');
  assert.match(query.get('tn') ?? '', /LM-1/);
});

test('UPI acknowledgement keeps the last four digits', () => {
  const ack = makeUpiAck('LM-1', 'xx-9876');
  assert.match(ack.paymentRef, /^upi-acked:9876:/);
  assert.match(makeUpiAck('LM-1', 'no-digits').paymentRef, /^upi-acked:0000:/);
});

test('flash deal price is discounted and never negative', () => {
  assert.equal(effectivePrice(100, 20).toNumber(), 80);
  assert.equal(effectivePrice(100, 0).toNumber(), 100);
  assert.ok(effectivePrice(100, 500).toNumber() >= 0);
});

test('loyalty tiers follow lifetime spend', () => {
  assert.equal(tierForSpend(0), 'GREEN');
  assert.equal(tierForSpend(5000), 'SILVER');
  assert.equal(tierForSpend(20000), 'PRIME');
});
