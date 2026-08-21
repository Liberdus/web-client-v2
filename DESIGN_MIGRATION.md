# Rolling the design language out across the app

Companion to `DESIGN.md`, which is the design system itself. This is the
migration: which screens to convert, in what order, and what "done" means for
each one.

The group chat screens are the reference implementation. Everything below is
about repeating that on the screens people actually use every day.

---

## 1. Scope

**In scope, in priority order:**

1. The home surface — the tab bar and all three tabs (Chats, Contacts, Wallet)
2. 1:1 chat
3. Entry — welcome, sign-in, create account, unlock
4. Settings and account

**Explicitly out of scope:**

- **DAO** — the feature is not finalised, so retrofitting a design language onto
  it would be work done twice. See §2.2, which is the most important paragraph
  in this document.
- **Bridge, validator, stake, calls, logs, backup** — power-user surfaces, low
  traffic. Convert opportunistically when touched for another reason, never as a
  project of their own.

---

## 2. Where the debt actually is

Measured, not estimated.

| signal | count |
| --- | ---: |
| rule blocks whose selector contains an id | **408** |
| — of which **DAO** | **207** |
| — everything else | **201** |
| colour literals outside `:root` | 224 |
| hardcoded `font-size` | 140 (against 141 tokenised) |
| `!important` | 30 |

### 2.1 The scary number was almost entirely DAO

400-odd id-scoped overrides reads like a year of work. But **half of them are
DAO**, and `#proposalInfoModal` alone accounts for the largest share. Take DAO
out and the screens you actually want converted look like this (counted as
selector lines, which is why these are larger than the rule-block totals above —
a comma-separated group spans several lines):

| screen | bespoke rules |
| --- | ---: |
| `#signInModal` | 17 |
| `#chatList` | 10 |
| `#chatsScreen` | 7 |
| `#contactsScreen` | 7 |
| `#walletScreen` | 7 |
| `.footer` / `.nav-*` | 15 |
| `#chatModal` | 2 |
| `#sendAssetFormModal` | 2 |
| `#receiveModal` | 2 |
| `#accountModal` | 1 |
| `#createAccountModal`, `#welcomeScreen`, `#menuModal`, `#settingsModal`, `#myInfoModal`, `#contactInfoModal`, `#newChatModal`, `#assetsModal` | **0 each** |

**Most of the screens in scope have no bespoke CSS at all.** They are already
built from shared classes, which means converting them is mostly swapping
markup onto `ui-*` primitives that already exist — not unpicking overrides.

This is a few weeks of work, not a quarter.

### 2.2 Build DAO in the language rather than migrating it later

Leaving DAO out is right, but it comes with an obligation, and skipping it is
how you end up back here with a 197th bespoke rule.

**When DAO is finalised, build it from `DESIGN.md` from the first commit.**
Not "ship it, then migrate it." The reason DAO has 308 overrides is that it was
built without a component vocabulary to reach for; that vocabulary now exists.
Designing the finalised DAO screens against `ui-row`, `ui-list`, `ui-banner` and
`ui-drawer` costs nothing extra at build time and saves the largest single
migration in the codebase.

Concretely: `dao.js` carries its own `dao-form-*` classes that duplicate the
form primitives. When the redesign lands, those should not be recreated.

---

## 3. The one rule

**Never restyle globally. One screen per pull request.**

Every shortcut is a trap. A global `text-align` change, a sweeping `.btn`
rewrite, a mass find-and-replace of colours — each looks like it saves weeks and
each puts the app into an unreviewable state where nobody can tell which screen
broke. The group work turned up **six** layout bugs that were only visible by
looking at a rendered screen: a left-aligned avatar, buttons 32px narrower than
their fields, a clipped placeholder, an invisible error, an avatar with a light
ring around it, and a composer stacked under the bar meant to replace it. None
of those would have been caught by reading a diff.

One screen, one PR, one before/after screenshot. `styles.css` shrinks each time.

---

## 4. Phase 0 — foundations

Small, mechanical, no visual change. Each makes every later conversion cheaper.

### 4.1 Make `[hidden]` authoritative

```css
[hidden] { display: none !important; }
```

`hidden` is only a UA-stylesheet `display: none`, so **any** author `display`
rule beats it. This already bit the group composer: it was `hidden`, and
`.message-input-container { display: flex }` silently outranked it, so the
invite bar that is supposed to *replace* the composer rendered above it.
`.ui-banner`, `.ui-row`, `.ui-fallback-input` and `.message-input-container`
each carry a hand-written `[hidden]` rule today for exactly this reason.

Its own PR. Click through the app once: it can only ever *hide* something that
was wrongly visible, so the blast radius is knowable.

### 4.2 Finish the tokens — in-scope files only

Two mechanical passes:

- colour literals → existing `--*` tokens
- hardcoded `font-size` → `--font-size-*`

**Skip the DAO blocks.** Tokenising CSS that is about to be rewritten is the
same wasted work as migrating the markup.

### 4.3 Do NOT touch `.container { text-align: center }` yet

The worst rule in the stylesheet — it is why list rows, hints and mono readouts
silently drift to centre, and it caused three separate fixes during the group
work. It is also the most dangerous thing to remove, because it changes every
screen at once.

**Instead:** each converted screen sets `text-align: left` on its own root.
Delete the global rule and the per-screen overrides in one final PR once the
in-scope screens are done. DAO will still depend on it, so this closing task
waits for the DAO rebuild — note it and move on.

---

## 5. Order of work

### Wave 1 — the home surface (ship together)

The tab bar plus all three tabs: **Chats**, **Contacts**, **Wallet**.

These ship as one wave rather than three independent PRs because people switch
between them constantly. A converted Chats tab beside an unconverted Contacts
tab is more jarring than either being old — inconsistency is most visible
exactly where switching is cheapest.

| PR | contents |
| --- | --- |
| 1a | Tab bar (`.footer`, `.nav-*`, 15 rules) — shared shell, so doing it first gives the other three PRs a consistent frame |
| 1b | Chats tab — `.chat-item` → `ui-list` / `ui-list-row`; delete the 10 `#chatList` rules; **includes the avatar decision in §6.1** |
| 1c | Contacts tab — the list already reuses `.chat-item`, so it inherits 1b. The work is defect repair, not conversion (see §5.1) |
| 1d | Wallet tab — needs one new primitive for amounts (`tabular-nums`, unit alignment) |

Every launch of the app lands here. Highest exposure in the product, ~40
bespoke rules between them.

#### 5.1 Correction: `contact-info-item` does NOT map onto `ui-row`

An earlier draft of this plan claimed it did, off a use count rather than a
look at the component. They are inverted:

- `ui-row` — the **label** is primary, the value is a muted trailing thing.
  It is a setting: *Invite link · Copy*.
- `contact-info-item` — the **label** is muted and fixed-width, the **value**
  is the primary text. It is a data readout: *Name · Ana*.

Contact info is right as it stands, and forcing it into `ui-row` would demote
the thing you opened the screen to read. Left alone. If a shared primitive is
wanted later, the honest one is a new `ui-field` (label + value + optional
action) that wallet, send and receive can also use — worth doing when a second
screen actually needs it, not before.

A rename for its own sake was also rejected: 22 markup sites plus JS class
toggles and `querySelector('.contact-info-value')` lookups, for no visual
change and a real regression surface.

### Wave 2 — 1:1 chat

The highest-traffic modal in the app, and mostly *deletion*: group chat already
established the header, composer, bubbles, banner and sender-run grouping, and
`renderTextConversation` is currently group-only.

The caution: `ChatModal` carries ~6.5k lines of two-party machinery — tolls,
pay-on-reply, read receipts, "blocked by recipient" — none of which has a group
meaning. That is why `groupUI.js` was kept separate in the first place. See
§6.2 before starting.

### Wave 3 — entry

Welcome, sign-in, create account, unlock.

**Lock and unlock: deferred, not done.** Welcome, sign-in and create account
shipped. Lock/unlock was skipped as an uncommon feature. The findings stand for
whenever it is picked up: `#lockModal` runs three modes (set / change / remove)
through one form switched by four inline `display:none` toggles under a title
that always reads "Lock"; Change Password and Remove Lock are both
`btn--primary btn--full`, so the destructive one is indistinguishable from the
safe one; three paragraphs precede the form, with the consequential sentence
("if you lose your password you cannot access your accounts") buried as the
middle one; `#passwordWarning` hardcodes `#dc3545` inline. `#unlockModal` does
not say which account it is unlocking. Only 2 bespoke CSS rules between them —
this is markup and hierarchy work, not a stylesheet fight.

Seen on every cold start, and the first thing a new user ever sees. `#signInModal`
has 17 bespoke rules — the most of any screen in scope — and create account,
welcome and the lock screens have none, so most of the wave is markup swaps.

### Wave 4 — settings and account — DONE

Menu, settings, my info, account.

**Shipped in two parts.** 4a converted Menu and Settings onto a new `ui-nav`
primitive; 4b merged My Info and My Profile into one **You** screen behind a new
`ui-identity` primitive, reached from both the header avatar and
Settings → Profile, with the form retitled *Edit profile* as its editor.

The plan's premise for this wave was wrong in the same way §5.1 was: it assumed
`menu-item` → `ui-row` off a use count. `ui-row` is a settings row (label
primary, muted value trailing); a menu row *navigates* and needs an icon and a
chevron. The hierarchy was compatible, so it converted — but as a sibling
primitive, not a reuse. **Check which element is primary before believing a
mapping.**

`menu-item` has 33 uses and 30 CSS rules: the single biggest `ui-row`
conversion available, and rows are the most mature primitive in the set. Almost
none of these modals carry bespoke CSS, so this wave is large in surface area
and small in risk — a good one to hand to someone learning the system.

---

## 6. Two decisions to make before Wave 1

### 6.1 Avatars — SETTLED

Resolved before Wave 1 rather than during it: **the style is the user's choice**,
under Settings → Appearance, either gradient or identicon. Both are derived from
the address, so both stay deterministic and need no storage per contact.

Every avatar in the app now goes through **`addressAvatar(address, size)`** in
`lib.js`, which dispatches on the preference. `generateAvatar` and
`generateIdenticon` remain exported, but calling them directly is reserved for
the two option swatches on the Appearance screen, which must each show their own
style regardless of what is selected.

**Rule for the rest of the migration: never call a generator directly.** A new
call site that reaches past `addressAvatar` is a screen that silently ignores
the setting, and it will only be noticed by whoever picked the non-default.

The preference is device-level (`localStorage`, key `avatar_style`), applied at
boot before any list renders. A per-contact `useAvatar: 'identicon'` still means
"use the generated avatar rather than their photo" — it now renders in whichever
style is chosen, which is what that setting always meant.

### 6.2 How far does 1:1 chat converge with group chat?

Decide explicitly before Wave 2, in writing:

> Converge the **chrome** — header, composer, bubbles, banner, avatars.
> Leave the **state models** separate.

Group chat has a health model (`groupHealth`); 1:1 has tolls and receipts.
Trying to unify those is how a two-day conversion becomes a two-week one, and
the result serves neither well.

---

## 7. Definition of done, per screen

- [ ] Every item on the `DESIGN.md` §9 checklist passes
- [ ] Zero new id-scoped CSS rules; the ones it replaces are deleted
- [ ] No new colour or font-size literals
- [ ] The screen's root sets `text-align: left` (§4.3)
- [ ] Harness scenes for every state, including ones that are hard to reach live
- [ ] Before/after screenshots in the PR description
- [ ] `?v=` bumped on `app.js` and `styles.css`
- [ ] The count of **selectors containing an id** went down

```bash
# the migration's health metric
python3 - <<'EOF'
import re
s = open('styles.css').read()
sels = re.findall(r'^\s*([^@{}/][^{}]*)\{', s, re.M)
print(sum(1 for x in sels if re.search(r'#[A-Za-z]', x)))
EOF
```

**Not raw line count.** That was the metric in the first draft of this plan and
Wave 1a disproved it: the tab bar removed three id-coupled rules, added
`aria-current`, re-anchored the unread dot and gained a reduced-motion guard —
and `styles.css` grew by 14 lines, because explanatory comments and an accessibility
block are lines too. Growing on a small screen is fine. What must never grow is
id coupling, colour literals and `!important`, because those are what make the
*next* screen expensive.

---

## 8. Guardrails

### 8.1 Generalise the harness

`dev/group-ui-harness.html` is the highest-leverage artefact from the group
work. It pulls the real markup out of `index.html` at runtime — so it cannot
drift from what ships — and renders every state against fixtures with no
network, wallet or sign-in.

Promote it to `dev/ui-harness.html` with a scene group per screen. States like
"insufficient balance", "transaction rejected" or "account locked" are expensive
or impossible to produce on demand against a live network, and those are exactly
the states that ship broken.

Roughly an hour per screen. It pays back the first time someone has to check a
disabled state.

### 8.2 A lint that fails on regression

Cheap CI script:

- no new hex/`rgba` literals outside `:root`
- no new `!important`
- no new `#someModal` rules
- every `focus(` inside a modal passes `{ preventScroll: true }`

**Exclude the DAO selectors and `dao.js` from all four checks**, or active DAO
work will trip a lint about a migration it is not part of. Baseline at today's
non-DAO numbers and ratchet down.

### 8.3 The cache key

`app.js` imports `groupUI.js`, `groupManager.js` and friends as bare specifiers
with no `?v=`, so bumping `app.js?v=` does **not** invalidate them — a module
edit needs a hard reload. Adding a query is not safe piecemeal: if a module is
ever imported under two different specifiers there will be two instances with
split state (`mlsStore` caches among them). Fix it in one PR that changes every
first-party import together, or leave it and keep hard-reloading.

---

## 9. First PR, concretely

1. **`[hidden]` fix** (§4.1) — its own PR, click through once.
2. **Tab bar** (PR 1a) — the shared shell, so the tab PRs land in a consistent frame.
3. **Chats tab** (PR 1b):
   - swap the two `generateIdenticon` fallbacks in `getContactAvatarHtml` for
     `generateAvatar` (§6.1)
   - convert `.chat-item` to `ui-list` / `ui-list-row`
   - delete the `#chatList` bespoke rules it replaces
   - add `dev/ui-harness.html` with chat-list scenes: empty, unread, group,
     failed-send, removed-from-group
   - before/after screenshots

That is about two days, it is visible to every user on every launch, and it
establishes the pattern the rest of the waves follow.
