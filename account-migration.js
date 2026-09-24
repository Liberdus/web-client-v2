export const ACCOUNT_MIGRATION_JOURNAL_KEY = '__liberdus_account_migration_v1';

const ACCOUNT_KEY_PATTERN = /^[^_]+_[0-9a-fA-F]{64}$/;

function assertJournal(journal) {
  if (
    journal?.version !== 1 ||
    !Array.isArray(journal.previousRecords) ||
    typeof journal.previousLock !== 'object' ||
    journal.previousLock === null
  ) {
    throw new Error('Account migration journal is invalid');
  }

  const seen = new Set();
  for (const record of journal.previousRecords) {
    if (
      typeof record?.key !== 'string' ||
      !ACCOUNT_KEY_PATTERN.test(record.key) ||
      seen.has(record.key) ||
      (record.value !== null && typeof record.value !== 'string')
    ) {
      throw new Error('Account migration journal contains an invalid record');
    }
    seen.add(record.key);
  }

  if (journal.previousLock.value !== null && typeof journal.previousLock.value !== 'string') {
    throw new Error('Account migration journal contains an invalid lock');
  }
}

function restorePreviousState(storage, journal) {
  for (const record of journal.previousRecords) {
    if (record.value === null) storage.removeItem(record.key);
    else storage.setItem(record.key, record.value);
  }

  if (journal.previousLock.value === null) storage.removeItem('lock');
  else storage.setItem('lock', journal.previousLock.value);
}

export function recoverAccountMigration(storage = globalThis.localStorage) {
  const serialized = storage.getItem(ACCOUNT_MIGRATION_JOURNAL_KEY);
  if (serialized === null) return false;

  let journal;
  try {
    journal = JSON.parse(serialized);
  } catch (_) {
    throw new Error('Account migration journal cannot be parsed');
  }
  assertJournal(journal);
  restorePreviousState(storage, journal);
  storage.removeItem(ACCOUNT_MIGRATION_JOURNAL_KEY);
  return true;
}

export function commitAccountMigration({
  storage = globalThis.localStorage,
  changes,
  nextLock,
}) {
  if (!Array.isArray(changes)) throw new TypeError('Account changes must be an array');
  if (nextLock !== null && typeof nextLock !== 'string') {
    throw new TypeError('The next lock must be a string or null');
  }

  // Finish rolling back any interrupted migration before taking a fresh snapshot.
  recoverAccountMigration(storage);

  const seen = new Set();
  const normalizedChanges = changes.map((change) => {
    if (
      typeof change?.key !== 'string' ||
      !ACCOUNT_KEY_PATTERN.test(change.key) ||
      typeof change.value !== 'string' ||
      seen.has(change.key)
    ) {
      throw new Error('Account migration contains an invalid record');
    }
    seen.add(change.key);
    return { key: change.key, value: change.value };
  });

  const journal = {
    version: 1,
    previousRecords: normalizedChanges.map(({ key }) => ({
      key,
      value: storage.getItem(key),
    })),
    previousLock: { value: storage.getItem('lock') },
  };
  assertJournal(journal);

  // localStorage writes are individually atomic. Persisting the rollback journal
  // first makes the group recoverable if a write fails or the browser exits.
  storage.setItem(ACCOUNT_MIGRATION_JOURNAL_KEY, JSON.stringify(journal));

  try {
    for (const change of normalizedChanges) {
      storage.setItem(change.key, change.value);
    }
    if (nextLock === null) storage.removeItem('lock');
    else storage.setItem('lock', nextLock);
    storage.removeItem(ACCOUNT_MIGRATION_JOURNAL_KEY);
  } catch (error) {
    try {
      restorePreviousState(storage, journal);
      storage.removeItem(ACCOUNT_MIGRATION_JOURNAL_KEY);
    } catch (rollbackError) {
      // Keep the journal for recoverAccountMigration() on the next page load.
      try { error.rollbackError = rollbackError; } catch (_) {}
    }
    throw error;
  }
}
