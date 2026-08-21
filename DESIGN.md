# Liberdus web client — UI language

How screens in this app are meant to be built. Written while redesigning the
group chat screens, but nothing here is group-specific: the same rules are what
the wallet, DAO, bridge and contact screens should be held to when they get
their turn.

Read §1 and §2 before designing a screen. §4 is a component inventory — reach
for something there before inventing markup. §6 records traps that have cost
real debugging time. §7 points at the migration plan.

---

## 1. Principles

Eight rules, in the order they usually matter. Where two conflict, the earlier
one wins.

### 1.1 Never show internal state

If a value exists because of how the system is built rather than what the person
is doing, it does not belong on the screen. Derive something they can act on.

The group screens used to print MLS epoch counters into the chat subtitle, the
sync status, the reset copy and four warnings — twelve sites in one feature. A
person cannot do anything with "epoch 5". What they need is whether their
messages are getting through. One derived state replaced all twelve.

```js
// One helper, computed from state the view already carries.
// Every status string on every screen reads from this, and nothing else.
groupHealth(view) -> 'fine' | 'catching-up' | 'needs-attention' | ...
```

The raw values are not deleted — they are **demoted** (§1.3). Deleting them
would trade a user problem for a debugging one.

### 1.2 Silence is the healthy state

Status that says "everything is fine" is noise. It trains people to ignore the
place where the real warning will appear.

A healthy group shows no banner, no sync section, no reset button — the subtitle
says `5 members` and stops. Apply the same test anywhere: if a status element is
visible more often than not, it is decoration.

### 1.3 Diagnostics are not features

Recovery tools exist because something can break. They must not sit at the same
weight as the things people came to do.

Put them in a collapsed **Technical details** drawer (`ui-drawer`) at the bottom
of the relevant screen, along with any raw internals from §1.1. Nobody opens it
when things work. When things break, §1.4 brings the action to them instead.

### 1.4 Recovery is an event, and it is a ladder

When something *is* wrong, the fix belongs where the person hit the problem —
not filed under a settings section they have to go find.

Ladder the repair so the person is never asked to understand the machinery:

1. Run the safe repair automatically, or behind one neutral button.
2. Only if that fails, escalate **in place** to the destructive option.
3. Confirm before anything destructive.

Group chat: an out-of-step device shows one amber banner with **Fix this**,
which attempts a catch-up. Only when catch-up cannot win does the banner become
**Reset and rejoin**. The person is never offered the choice between them,
because they have no basis to make it.

### 1.5 One thought is one component

Sections that answer the same question should be one thing. "Who's in this
group" and "who wants in" were three slots apart; they are now one list, with
requests at the top carrying the decision they need.

This is also what makes a permission-limited view read as *simple* rather than
*empty*: when a screen is a list, a non-admin sees a list with fewer controls.
When a screen is eight sections and five are hidden, they see holes.

### 1.6 Explanatory notes are a smell

A note apologising for missing UI — *"Only admins can add or remove members"* —
means the layout has visible holes. Fix the layout; the note then has nothing to
explain.

Hide sections that do not apply rather than emptying them. A short screen is a
feature.

### 1.7 Ask for one thing

Only the genuinely required field should look required. Everything else either
collapses to a single row that already states its default, or moves inline.

Creating a group asked for three fields when only the name was needed, and an
empty box labelled *Join fee (optional)* implied groups normally cost money. It
is now one row reading **Free to join** — correct for the 95% who never touch
it, expanding to the amount for the rest.

### 1.8 Explanation scales with commitment

Three lines about how escrow vesting works are worth it *once someone has chosen
to charge a fee*, and worth nothing before. Put the explanation behind the
disclosure, next to the control it describes.

---

## 2. Voice

Words are the cheapest part of the interface to get right and the most often
skipped.

| do | don't |
| --- | --- |
| Name things by what people recognise | Name them after the mechanism |
| "Your messages won't reach anyone until it's fixed" | "This device is at epoch 3, the group is at 5" |
| "Joining costs a small network fee" | "Joining publishes a key update from your account" |
| A control says what happens: **Collect**, **Approve**, **Reset and rejoin** | **Submit**, **OK**, **Confirm** |
| Errors say what went wrong and what to do | Errors apologise, or restate the exception |
| "Free to join" (a fact) | "Join fee (optional)" (an empty obligation) |

Specifics:

- **Second person, active voice.** "You're no longer a member", not "The user has
  been removed".
- **State the consequence, not the mechanism.** People need to know what it
  means for them, not what the code does.
- **No protocol nouns in the product.** epoch, ratchet, commit, KeyPackage,
  UpdatePath, PSK. These belong in `ui-drawer`, code comments and this repo's
  specs — never in a label, toast or placeholder.
- **A toast confirms in the same words as the button.** Tapping **Collect** says
  "Collected", not "Transaction submitted successfully".

---

## 3. Foundations

Defined in `styles.css` under `:root`. **Never hardcode a colour, font size or
font family** — every value below is already a token.

### Colour

| token | value | use |
| --- | --- | --- |
| `--primary-color` | `#3d3dce` | the one accent: primary actions, links, selection |
| `--primary-hover` | `#3535b8` | hover only |
| `--text-color` | `#1c1c21` | body text |
| `--secondary-text-color` | `#65676b` | supporting text, labels, hints |
| `--muted-text-color` | `#999` | disabled, placeholder |
| `--border-color` | `#dee2e6` | every hairline |
| `--background-color` | `white` | surfaces |
| `--input-background` | `#e4e6e9` | inputs, received bubbles |
| `--light-color` | `#f8f9fa` | recessed panels |

Semantic colour is **separate from the accent** and only ever carries meaning:

| token | value | means |
| --- | --- | --- |
| `--success-color` | `#28a745` | it worked |
| `--warning-color` | `#ef6c00` | needs attention, recoverable |
| `--danger-color` | `#dc3545` | destructive, or failed |
| `--info-color` | `#0066cc` | neutral information |

Never use the accent to signal state, and never use a semantic colour for
emphasis. Amber means "you need to do something", everywhere.

For tinted backgrounds use the existing alpha tokens (`--primary-tint-04/12/20`,
`--hover-background-purple`) rather than new rgba literals.

### Type

Inter is **self-hosted** in `fonts/` (variable, weights 400–700, latin and
latin-ext subsets, ~132 kB total, SIL OFL — `fonts/LICENSE.txt`). Not linked
from Google Fonts: this is a wallet with an offline page, so a webfont needing
a third-party request on every cold load is both an offline failure and a
signal to another host about when the app is opened.

`--font-primary` carries a real fallback stack after Inter, which is what shows
during the `font-display: swap` and if the font ever fails to load.

**When checking whether a font is actually loading, measure it** —
`document.fonts.check()` returns `true` for fonts that are not present:

```js
c.font = '16px "Inter", sans-serif'      // if these two measure the SAME,
c.font = '16px "NoSuchFont", sans-serif' // the font is not loaded
```

This is how the gap was found: `--font-primary` had named Inter for a long time
without the font ever shipping, so the app silently rendered in Helvetica /
Arial / Roboto and nothing anywhere said so.

`--font-primary` everywhere; `--font-monospace` only for machine values
— addresses, ids, hashes, the `ui-drawer` readout.

Scale: `--font-size-xs` 12 · `--font-size-sm` 14 · `--font-size-base` 16 ·
`--font-size-lg` 20 · `--font-size-xl` 24. Weights: 400 / 500 / 600 / 700.

Convention: body 16, supporting text 14, hints and metadata 12. Uppercase
section labels get `letter-spacing: 0.05em` and weight 600 — never uppercase a
sentence.

### Shape and space

Radius: `12px` inputs · `10px` cards and lists · `24px` pill buttons · `999px` chips and badges · `50%` avatars.

Space in multiples of 4, usually 8. Prefer flex/grid `gap` over per-element
margins — sibling margins collapse and double, and most of the spacing bugs in
this stylesheet come from that.

**A screen needs a scale, not a set of individually plausible numbers.** The
wallet ran 28 / 4 / 4 / 20 / 0 / 40 / 8 — every value a multiple of 4, and no
system: the section break got more air than the balance, and the two action
tiers touched. Four steps are enough for a screen:

| step | for |
| ---: | --- |
| 8 | inside one unit — a caption and the figure it labels |
| 16 | between related things — two tiers of the same control |
| 32 | between blocks — hero to actions, actions to a list |
| 48 | page entry — above the thing the screen exists for |

Make the entry space the largest value on the page. A hero that is a short
block of text reads as the first row of a list if nothing sits above it.

### Layout

The app is a single 480px column with sliding full-height modals. `.form--narrow`
(390px) is the standard padded body for modal forms. Nothing should require
horizontal scrolling; wide content (a mono id, a table) gets `overflow-x: auto`
on its own container.

---

## 4. Components

### 4.1 Existing primitives — reuse these

| class | what it is |
| --- | --- |
| `.modal.fixed-header` + `.modal-header` + `.modal-content` | a full-screen sliding screen |
| `.btn` + `--primary` / `--secondary` / `--danger` | button colour |
| `.btn--pill.btn--full` | the standard full-width action button |
| `.btn--text` | link-styled button |
| `.btn--tiny` | inline action inside a list row (`--tiny-primary`, `--tiny-danger`) |
| `.btn--danger-quiet` | outlined destructive — for a recovery tool, not a primary action |
| `.form-control`, `.form-group`, `.form-label`, `.form-hint`, `.form-actions` | forms |
| `.icon-button` | a 30×40 icon-only control |
| `addressAvatar(address, size)` | **use this** — the avatar for an address, in the style the user chose |
| `generateAvatar` / `generateIdenticon` | the two styles themselves; direct calls bypass the user's setting |
| `showToast(msg, ms, kind)` | transient confirmation |

### 4.2 New primitives — added with the group redesign

Deliberately named `ui-*` rather than `group-*`: they solve general problems and
are meant to be used elsewhere.

**`.ui-banner`** — persistent status attached to the top of a screen's content,
directly under the header. Not a toast (which is transient) and not a system
message in a list (which scrolls away from its own action).

```html
<div class="ui-banner ui-banner--attention">
  <span class="ui-banner-icon">△</span>
  <div class="ui-banner-text">
    Short statement of the problem.
    <span class="ui-banner-sub">What it means for you.</span>
  </div>
  <button class="ui-banner-action">Fix this</button>
</div>
```

Variants: `--quiet` (grey, resolves itself, no action) · `--attention` (amber,
needs a decision) · `--muted` (grey, terminal state). One banner at a time;
never stack them.

**`.ui-list`** — a bordered list of people or things.
`.ui-list-row` for an entry, `.ui-list-row--action` for an affordance row at the
top (`+ Add people`), `.ui-list-row--pending` for a row awaiting a decision
(amber inset rail). `.ui-list-name`, `.ui-list-note`, `.ui-list-more` inside.

**`.ui-picker`** — search field + staged chips + results as one stack, spaced
with flex `gap`. Not margins on each child: the error and the chip list are
`display: none` when empty, and a margin would leave a phantom gap wherever one
is hidden. The gap is also what keeps the field's focus ring off the results
box — flush together they read as one control with a doubled border.

**`.ui-list-pick`** — a selectable row. The native checkbox is visually hidden
(kept for state, labels and keyboard) and `.ui-list-check` renders on the
**right**, after the name: the row reads "who, then whether they are picked",
and a column of ticks down the right edge scans as a set of answers rather than
as decoration in front of each face.

**`.ui-row`** — a one-line setting: label, optional sub-label, value or action on
the right. Replaces a full section with a heading, a note and a full-width
button when the content is genuinely one line. `--danger` for destructive.

**`.ui-drawer`** — a collapsed `<details>` for diagnostics and raw internals.
Contains `.ui-kv`, a mono key/value readout. This is where §1.1 and §1.3 send
things.

**`.ui-badge`** — a small pill for a role or count. `--accent` is a role and is
set uppercase as a label (`ADMIN`); `--attention` is a sentence and stays in
sentence case (`1 wants to join`).

**`.ui-section-title`** — an uppercase label above a list or group of rows.

---

## 5. Screen patterns

**Section order is by audience frequency**, not by how the code is organised.
Identity → the thing people came for → occasional admin → destructive → drawer.

**Merge before you add.** Before adding a section, check whether it answers a
question an existing one already answers (§1.5).

**A row, not a section.** If the content is one line and one action, it is a
`ui-row`. Sections cost a heading, a note and vertical space, and imply the
content is substantial.

**A marker beats a word for anything repeated down a list.** A chat row shows
what happened to *your* last message with a 14px `.chat-status` glyph — a
single check for sent, a clock for sending, a filled red badge for failed, and
nothing at all when the last message was theirs. It replaced `"You: "`, which
spent five characters of a preview that has none to spare and repeated the same
word down the whole screen.

Two rules came out of it. **Keep the slot fixed-width**, or rows stop lining up
— the same defect as putting a variable-width unread badge before the preview
text. And **never claim more than the system knows**: the message vocabulary
here is `pending | sent | failed` with no delivered or read state, so a second
check would assert something nothing in the app can verify.

**Blue means "this does something consequential."** If every control in a run
of rows is blue, none of them reads as more important than the others. `Collect`
(moves money) is blue; `Copy` (copies a link) is a muted `ui-row-value`. A
disabled state is never blue — it is not an action.

**Attribute a run once, not once per bubble.** Consecutive messages from one
person show the avatar and name only on the first, and the continuation carries
`.message--continues` — tighter margin, squared top corner on the speaker's
side — so the run reads as one block. Repeating the header on every line makes
three short replies look like three separate arrivals. Handled in
`renderTextConversation`, which only group chat uses; 1:1 has its own renderer.

**Avatars go through `addressAvatar(address, size)`, never a generator
directly.** Settings → Appearance lets people choose gradient or identicon, and
`addressAvatar` is what honours it. Calling `generateAvatar` or
`generateIdenticon` directly builds a screen that silently ignores the setting.
The only exception is the Appearance screen's own two swatches, which must each
show their own style whatever is selected.

**Avatars are circles.** `generateAvatar` fills the frame edge to edge so the
circle reads as one. `generateIdenticon` paints a small pattern on `#f0f0f0`,
which on a white page looks like a floating square — the round container is
invisible because its background is nearly the page colour. Either way the
container clips: an avatar must be `width: 100%` of its frame.

**Destructive actions sit low and quiet**, in `--danger-color`, above the
drawer — but never *inside* it. Leaving a group is a real product action, not a
diagnostic.

**Disable rather than hide** a control whose unavailability is temporary and
explained; **hide** one that will never apply to this person.

---

## 6. Traps

Hard-won. Each of these has cost hours.

**`focus()` inside a modal scrolls the container sideways.** A modal is still at
`left: 100%` when `open()` runs, so the browser scrolls the off-screen input
into view; `.container` is `overflow: hidden`, so the displacement sticks and the
modal is left parked off-screen. Always:

```js
setTimeout(() => input.focus({ preventScroll: true }), 350); // past the 0.3s transition
```

**`index.html` uses a manual cache key.** After editing `app.js` or
`styles.css`, bump `?v=` on both, and hard-reload once for the new
`index.html`. Stale bundles have caused hours of confusion.

**ES module imports have no cache key at all.** `app.js` imports `groupUI.js`,
`groupManager.js` and friends as bare specifiers, so bumping `app.js?v=` does
**not** invalidate them. Editing a module means a hard reload.

**Two `.btn--*` variants side by side in a flex row come out different
widths.** `.btn--primary` and `.btn--secondary` carry different horizontal
padding, and under `box-sizing: border-box` a `flex-basis: 0` item cannot
shrink below its own padding — so the free space splits evenly on top of
*unequal floors*. State the padding on the row's own class. Bitten twice:
`.group-invite-actions .btn` and `.wallet-primary-action`.

**`.container` centres the entire app.** `.container { text-align: center }`
cascades into every screen, so any new component holding a name, a sentence or
a key/value readout must set `text-align: left` itself. Symptom: list rows and
hints that drift to the middle of their own container for no visible reason.

**Inline error text hides itself with `:empty`, never a `display` default.**
`.form-error { display: none }` silently swallowed the join-by-link errors,
which set `textContent` and nothing else. An error that depends on every caller
remembering to toggle `display` will eventually be invisible somewhere.

**An avatar fills its frame.** Containers are fixed-size circles
(`.chat-avatar` 48px, `.modal-avatar` 40px), so the SVG must be `width: 100%`.
Passing a smaller size to the generator leaves a ring of the container's
background around the avatar — invisible with an identicon, whose own
background is nearly the same colour, and obvious with a gradient.

**An SVG id must be unique per rendered element, never derived from its
data.** SVG ids are global to the document and `url(#id)` resolves to the first
match in document order. `generateAvatar` keyed its gradient id on the address,
which looked unique until the same person appeared in two lists at once — the
chat list and the contacts list are both in the DOM, only one is visible, so
the visible avatar resolved its gradient to the copy inside a `display: none`
screen and painted nothing. A counter is the only thing that actually
guarantees uniqueness. Colour stays deterministic; only the internal id varies.

**Renderers must be total.** `render()` runs on every background sync with
whatever the network returned. One odd roster entry must not be able to blank a
conversation — see `displayName()`, which is deliberately exception-safe.

**Escape everything interpolated into `innerHTML`.** Usernames and join-request
messages are attacker-controlled. Use `escapeHtml()`.

---

## 7. Rolling this out to the rest of the app

`DESIGN_MIGRATION.md` is the plan: which screens to convert in what order and
what "done" means for a screen. Read it before converting anything outside group
chat.

**DAO is deliberately not in that migration** — the feature is not finalised, so
retrofitting it would be work done twice. The obligation that comes with the
exclusion: when DAO is finalised, build it from this document from the first
commit rather than shipping it and migrating it later. Its 308 bespoke CSS rules
exist because it was written without a component vocabulary to reach for. That
vocabulary now exists.

---

## 8. Looking at a screen

`dev/group-ui-harness.html` renders the real group modals — pulled out of
`index.html` at runtime, so they cannot drift from what ships — against fixture
data, with no network, wallet or sign-in. Each button across the top is one
state: healthy, catching up, needs attention, unrecoverable, invited, removed,
admin, non-admin.

It exists because most of these states are expensive to reach on a live
network, and two of them are supposed to be unreachable. Worth copying for any
other screen with states that are hard to produce on demand. Fixture addresses
must normalise to exactly 40 hex characters — see `normalizeAddress()`.

`dev/mls-selftest.html` is the separate protocol check: 27 assertions, also no
network or wallet.

---

## 9. Checklist

Before calling a screen done:

- [ ] No internal or protocol value is visible outside `ui-drawer` (§1.1)
- [ ] Nothing on screen says "everything is fine" (§1.2)
- [ ] A healthy state shows no diagnostics at all (§1.3)
- [ ] Every error state carries its own fix, in place (§1.4)
- [ ] No section duplicates a question another one answers (§1.5)
- [ ] No note apologises for missing UI (§1.6)
- [ ] Optional inputs are collapsed and state their default (§1.7)
- [ ] Every colour, size and font comes from a token (§3)
- [ ] Semantic colour carries meaning; the accent never does (§3)
- [ ] Any focused input uses `focus({ preventScroll: true })` (§6)
- [ ] `?v=` bumped on `app.js` and `styles.css` (§6)
- [ ] Every interpolated string is escaped (§6)
