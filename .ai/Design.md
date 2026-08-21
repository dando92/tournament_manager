# Design System and Design Decisions

The frontend uses Tailwind CSS. Colour tokens are declared in
`apps/frontend/tailwind.config.js`; recurring class combinations live in
`apps/frontend/src/styles/`.

## The rule that governs colour

**Hue carries meaning. Emphasis carries hierarchy.**

A hue answers *"what is going on?"* — this is destructive, this needs attention,
this succeeded. Emphasis (filled, then outlined, then ghost) answers *"how
important is this control here?"*. An action never earns a hue of its own just
for being a different kind of action, which is why creating something is not
green and confirming something is not a second shade of blue.

Two consequences follow.

- **A UI supports four to six hues before hue stops being a signal.** The
  semantic palette is closed at five: brand, success, danger, warning, neutral.
  Adding a sixth requires a genuinely new *meaning*, not a new kind of action.
- **Never encode a state by hue alone.** Shape, position, weight, and text carry
  the state too, so it survives greyscale and colour blindness.

## Semantic palette

| Role | Scale | Communicates | Examples |
| --- | --- | --- | --- |
| `brand` | brand (206°) | navigation, selection, the current or in-progress thing | active tab, selected pool, active match, highlighted match |
| success | `emerald` | a positive outcome that already happened | committed match, advancement route, connected lobby, round-robin win |
| danger | `red` | destructive actions and negative outcomes | delete, close tournament, validation error, disconnected, round-robin loss |
| warning | `amber` | reversible attention: something is pending or held | pending commit, closed-tournament notice, match notes |
| neutral | `gray` | everything else | text, borders, surfaces |

`green` and `yellow` are not used: `emerald` and `amber` are the single scales
for their roles. A second blue is never introduced — every blue in the product
is a step of the `brand` scale.

### Brand scale

One hue at 206°, so every step reads as the same colour at a different weight.
This is what keeps chrome, table headers, and interactive text in harmony: they
differ by weight, never by hue.

| Step | Hex | Contrast vs white | Role |
| --- | --- | --- | --- |
| `brand-50` | `#F1F8FE` | — | selected-row and hover tint |
| `brand-100` | `#D9EDFC` | — | informational badge fill |
| `brand-200` | `#B6DBF7` | — | badge and selection borders |
| `brand-300` | `#84BEEB` | — | highlight rings, accent text on dark surfaces |
| `brand-400` | `#50A3E2` | — | selection borders on cards |
| `brand-500` | `#1F8CE0` | 3.57 | brand identity; accent **on dark surfaces only**, never text on white |
| `brand-600` | `#1571B7` | 5.15 | focus rings, form focus borders |
| `brand-700` | `#135D96` | 6.92 | interactive text and icons, coloured content headers |
| `brand-800` | `#134C77` | 9.02 | strong text on brand tints |
| `brand-900` | `#153D5B` | 11.35 | dark chrome: sidebar, live cards |
| `brand-950` | `#0F1E2A` | 16.94 | reserve for darker surfaces |

Unused steps are expected: a scale is a ramp, not an inventory. This is not the
same defect as the removed `lower` / `middle` / `upper` tokens, which were three
arbitrary one-off colours belonging to no scale.

Surface hierarchy: chrome is `brand-900`, coloured content headers carrying
white text are `brand-700`, tints are `brand-50`/`brand-100`.

### Neutral scale

| Step | Role |
| --- | --- |
| `gray-900` / `gray-800` | primary text |
| `gray-700` | strong secondary text |
| `gray-600` / `gray-500` | muted secondary text — `gray-500` is the lightest text allowed |
| `gray-400` | disabled text, decorative icons |
| `gray-300` | borders, dividers, decorative separators |
| `gray-200` / `gray-100` / `gray-50` | borders and surfaces |

`gray-400` and lighter never carry text a user has to read: at 2.54 against
white it is below the AA threshold.

## Creation is not a hue

An empty slot to fill is marked by a **dashed outline**, not by a colour. The
dashed border is a shape signal, so it survives greyscale; the brand tint on the
label only says the slot is interactive. Green for "add" is not used, because it
steals meaning from success.

Creation takes the hierarchy level it deserves in its context:

| Context | Treatment |
| --- | --- |
| the only action of an empty state | `btnPrimary` |
| an empty slot inside a list of content | `btnCreate` — dashed neutral border, brand label |
| an icon-only `+` in a dense row | `btnCreateIcon` |
| a menu entry | `text-brand-700 hover:bg-brand-50` |

## Selection and highlight

Selection and highlight sit on the same axis — which item is current — so both
stay in the brand scale and differ by treatment, not hue:

- **selected** (the user clicked it): brand border plus `brand-50` fill.
- **highlighted** (the user was routed here): the same, plus `ring-2
  ring-brand-300`. The ring is the emphasis; it needs no colour of its own.

## Domain scales

These rank or identify a value; they never report application state, so they sit
outside the semantic palette on purpose and no semantic rule applies to them.
Keep them namespaced so nobody "harmonises" them away.

| Scale | Where | Why it is separate |
| --- | --- | --- |
| `judgment-*` | live score cards | the In The Groove palette — the colours a player already reads off the cabinet |
| `difficulty-*` | song rows | ordinal scale over song difficulty |
| `score-*` | tournament stats badges | ordinal scale over result quality |
| banner gradients | `features/tournament/utils/tournamentBanner.ts` | decorative identity for a tournament without a logo |

### The live view is a dark surface

Tournament Manager is a service for In The Groove, so the judgment colours on
the live score cards are the game's own. They are never adjusted for contrast:
changing one would mean showing a player a colour that does not match the
cabinet.

Legibility is therefore the background's job. The judgment palette is calibrated
for the near black of the game screen, and only a background of that weight
holds it: on `live-screen` (`#0F1E2A`) every judgment colour clears 4.5:1, with
Miss the tightest at 4.61. On a mid-weight surface such as `brand-900`, Miss and
Decent fall to about 3.1 and become unreadable.

A failing run keeps a dark surface for the same reason. It is marked by
`live-failed` (`#2E0F14`, still 4.79:1 at worst) plus a red ring: the ring sits
behind no text, so the state is unmistakable without dimming the numbers. Never
signal a state on the live cards by fading the surface toward white.

## Contrast

Text and interactive controls meet WCAG AA: 4.5:1 for text, 3:1 for large text
and non-text UI. When a token pair is chosen, verify it rather than assume it.
The known traps are `brand-500` (3.57 — dark surfaces only) and `gray-400`
(2.54 — never body text).

## Product decisions

Lifecycle actions are shown in tournament configuration. Closed state uses an amber read-only notice; closing uses the existing danger-button treatment, while reopening uses the primary action treatment. The destructive confirmation must name the effective retention period and consequences rather than relying on a generic confirmation label.

Match cards separate state from action. The active state is shown by an informative status dot to the left of the match name, never by a button, and the dot carries a tooltip that touch devices reveal by tapping it. Forward actions stay visible: the compact commit button sits in the match header next to the actions menu and is enabled only once every score is filled in. Reverse and rare actions, such as re-opening a committed match or toggling the active state, live in the match actions menu. Below the small breakpoint, controls that are visually compact keep a full touch target through a transparent expansion that does not affect layout.
