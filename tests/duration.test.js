import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DURATION_DAY_MS,
  durationPartsToMilliseconds,
  formatDurationParts,
  millisecondsToDurationParts,
} from '../duration.js';
import { buildDaoProposalCreateDraft } from '../dao.js';

test('converts duration parts to milliseconds', () => {
  assert.equal(durationPartsToMilliseconds(0, 0, 0), 0);
  assert.equal(durationPartsToMilliseconds(0, 0, 4), 240_000);
  assert.equal(durationPartsToMilliseconds(2, 3, 4), 183_840_000);
  assert.equal(durationPartsToMilliseconds(30, 0, 0), 2_592_000_000);
});

test('decomposes whole-minute durations', () => {
  assert.deepEqual(millisecondsToDurationParts(183_840_000), { days: 2, hours: 3, minutes: 4 });
  assert.equal(millisecondsToDurationParts(60_001), null);
});

test('rejects invalid duration parts', () => {
  assert.ok(Number.isNaN(durationPartsToMilliseconds(0, 24, 0)));
  assert.ok(Number.isNaN(durationPartsToMilliseconds(0, 0, 60)));
  assert.ok(Number.isNaN(durationPartsToMilliseconds(-1, 0, 0)));
});

test('formats complete duration labels', () => {
  assert.equal(formatDurationParts(0), '0 minutes');
  assert.equal(formatDurationParts(DURATION_DAY_MS), '1 day');
  assert.equal(formatDurationParts(183_840_000), '2 days 3 hours 4 minutes');
});

test('keeps the selected duration as milliseconds in the proposal payload', () => {
  const gracePeriodMs = durationPartsToMilliseconds(0, 0, 4);
  const draft = buildDaoProposalCreateDraft({
    from: 'sender',
    displayTitle: 'Duration test',
    emergency: false,
    proposalType: 'governance',
    description: 'Verify the grace period payload.',
    options: ['no', 'yes'],
    changes: [[{ key: 'graceDuration', value: gracePeriodMs, current: '0' }]],
    proposalFeeUsdStr: '1',
    reviewStartTimeMs: 0,
    gracePeriodMs,
    maxGracePeriodMs: gracePeriodMs,
  });

  assert.equal(draft.transaction.gracePeriod, 240_000);
  assert.equal(typeof draft.transaction.gracePeriod, 'number');
});
