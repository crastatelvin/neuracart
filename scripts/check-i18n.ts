import assert from 'node:assert/strict';
import { catalogues, translate } from '../src/lib/i18n.ts';

// Interpolation and fallback.
assert.equal(translate('en', 'common.itemsCount', { count: 3 }), '3 items');
assert.equal(translate('kn', 'common.itemsCount', { count: 3 }), '3 ವಸ್ತುಗಳು');
assert.equal(translate('hi', 'common.openTill', { time: '9 PM' }), '9 PM तक खुला');
assert.equal(translate('kn', 'missing.key'), 'missing.key');

// Every English key must exist in Kannada and Hindi so nothing silently falls back.
const enKeys = Object.keys(catalogues.en);
assert.ok(enKeys.length > 50, `expected a full catalogue, found ${enKeys.length} keys`);
for (const language of ['kn', 'hi'] as const) {
  for (const key of enKeys) {
    assert.ok(catalogues[language][key], `${language} is missing ${key}`);
  }
}

console.log('i18n checks passed');
