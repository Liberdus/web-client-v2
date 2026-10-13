/**
 * Who removes a member who has left, and when.
 *
 * group_leave takes an account off the network's roster but cannot touch the
 * MLS tree: leaving is not cryptographic on its own, and until a remaining
 * member commits the Remove, the leaver's retained state can still decrypt the
 * group (threat model T3). The network lets any member make that commit and
 * pays for it from the group's upkeep balance, so the only question is which
 * member, so that one commit lands rather than several racing for the epoch.
 *
 * Every member computes the same answer from the same two lists: the member
 * with the lowest leaf index who is still on the roster. If that member does
 * not act within the grace period -- offline, or out of step -- anyone may,
 * and the network's epoch fence decides the race.
 *
 * Pure: no storage, no network.
 */

const norm = (a) => String(a || '').toLowerCase();

/**
 * Addresses with a leaf in our MLS tree that are no longer on the roster.
 *
 * @param {string[]} mlsRoster  leaf identities, in leaf order (mlsEngine.rosterOf)
 * @param {string[]} chainRoster  GroupAccount.members
 * @param {string} me
 */
export function departedMembers(mlsRoster, chainRoster, me) {
  const roster = new Set(chainRoster.map(norm));
  return mlsRoster.map(norm).filter((a) => a !== norm(me) && !roster.has(a));
}

/** The member expected to remove departed leaves: the first leaf still on the roster. */
export function designatedRemover(mlsRoster, chainRoster) {
  const roster = new Set(chainRoster.map(norm));
  return mlsRoster.map(norm).find((a) => roster.has(a)) ?? null;
}

/**
 * Should this member commit the removal now?
 *
 * @param {object} o
 * @param {string[]} o.departed  from departedMembers
 * @param {string|null} o.designated  from designatedRemover
 * @param {string} o.me
 * @param {number} o.oldestSince  when the longest-standing departure was first seen (ms)
 * @param {number} o.now
 * @param {number} o.graceMs  how long the designated member gets before anyone may act
 */
export function shouldRemoveDeparted({ departed, designated, me, oldestSince, now, graceMs }) {
  if (departed.length === 0) return false;
  if (designated === norm(me)) return true;
  return now - oldestSince >= graceMs;
}
