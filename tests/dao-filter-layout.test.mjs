import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const [appSource, markup, styles] = await Promise.all([
  readFile(new URL('../app.js', import.meta.url), 'utf8'),
  readFile(new URL('../index.html', import.meta.url), 'utf8'),
  readFile(new URL('../styles.css', import.meta.url), 'utf8'),
]);

test('renders every DAO proposal filter without an expand control', () => {
  const filterKeys = [...markup.matchAll(/class="dao-filter-chip"[^>]*data-filter-key="([^"]+)"/g)]
    .map(([, key]) => key);

  assert.deepEqual(filterKeys, [
    'review',
    'voting',
    'accepted',
    'claimable',
    'withheld',
    'rejected',
    'applied',
    'all',
  ]);
  assert.doesNotMatch(markup, /daoFilterExpandButton|daoFilterOverflow/);
  assert.doesNotMatch(appSource, /setFiltersExpanded|DAO_FILTER_OVERFLOW_KEYS|filterExpandButton|filterOverflow/);
});

test('aligns DAO filter counts in a responsive shared grid', () => {
  assert.match(styles, /#daoModal \.dao-filter-bar \{[\s\S]*grid-template-columns: repeat\(4, minmax\(0, 1fr\)\)/);
  assert.match(styles, /@media \(max-width: 640px\) \{[\s\S]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(styles, /#daoModal \.dao-filter-chip \{[\s\S]*grid-template-columns: minmax\(0, 1fr\) auto/);
  assert.match(styles, /#daoModal \.dao-filter-chip-count \{[\s\S]*justify-self: end/);
});
