# Design System and Design Decisions

The frontend uses Tailwind CSS. Colour values live in
`apps/frontend/src/styles/tokens.css` as CSS custom properties and are exposed
to Tailwind in `apps/frontend/tailwind.config.js`; recurring class combinations
live in `apps/frontend/src/styles/`.

## The rule that governs colour

**The interface has no colour. State does.**

Surfaces, borders, selection, text, buttons and navigation are all steps of one
neutral scale. Colour appears only where it reports what something is *doing* —
and even there it appears inside a glyph, never as a fill behind text.

Three consequences follow, and they are the whole system.

- **Emphasis carries hierarchy.** The primary button is a raised surface with a
  stronger border, not a block of colour. Ranking an action is not a meaning, so
  it never earns a hue.
- **Shape carries state alongside colour.** The status ring fills as a match
  moves forward — dashed, half, three quarters, solid. The list reads in
  greyscale; the colour confirms rather than informs.
- **Colour used only as a glyph answers to a 3:1 threshold**, not the 4.5:1 that
  text needs. This is what lets `state-running` be the brand colour `#1F8DDE` at
  full strength in the light theme instead of a darkened substitute. Put that
  colour behind text instead and the headroom disappears.

## Neutral scale

Hue 215, saturation held between 4% and 9%. A faint cool cast is what makes a
grey read as chosen rather than as the browser default; anything more saturated
reads as blue-grey. The dark values are Linear's published surfaces.

| Token | Light | Dark | Role |
| --- | --- | --- | --- |
| `ui-canvas` | `#FAFBFC` | `#08090A` | page ground, sidebar |
| `ui-surface` | `#FFFFFF` | `#0F1011` | panels, cards, top bar |
| `ui-raised` | `#F5F6F8` | `#161718` | panel headers, table headers, badges |
| `ui-selected` | `#E9EBEF` | `#23252A` | selected row, active nav item |
| `ui-border` | `#E2E5E9` | `#1C1E21` | borders and dividers |
| `ui-border-strong` | `#C6CBD2` | `#2F3237` | selection edge, primary button border |
| `ui-text` | `#181B21` | `#F7F8F8` | primary text |
| `ui-text-soft` | `#4F555F` | `#A7ACB4` | secondary text, links, actions |
| `ui-text-mute` | `#666F7A` | `#7B838E` | muted text, chrome icons, column headers |

`ui-text-mute` is the lightest text allowed. Nothing below it ever carries words
a user has to read.

## State scale

| Token | Light | Dark | Glyph | Means |
| --- | --- | --- | --- | --- |
| `state-idle` | `#8A929E` | `#7B838E` | dashed ring | not started, not active |
| `state-running` | `#1F8DDE` | `#3DA5E8` | ring half filled | in progress, active, connected |
| `state-pending` | `#C2761A` | `#E0A33C` | ring three quarters filled, breathing | waiting on a person |
| `state-done` | `#0E8A5F` | `#3CC98D` | solid with a check | completed, advanced |
| `state-failed` | `#D33A34` | `#EE6B63` | solid with a cross | failed, disconnected, destructive |

Drawn by `shared/components/ui/StatusIcon.tsx`. The badge that repeats a status
in words keeps a neutral surface and neutral text: the glyph inside it is the
only coloured thing, so a list of matches never becomes a row of coloured pills.

`state-failed` is the one state that also works as text — it clears 4.5:1 — which
is why error messages and destructive actions may use it directly. The other
four do not, and must stay inside a glyph or behind a tint.

## Which icons get colour

- **Coloured:** the icon that says what state a thing is in. Match status,
  active, lobby connection, advancement.
- **Neutral:** every icon that says only what a thing *is*. Navigation, actions,
  the pencil, the trash, the overflow menu. The trash is the tempting exception,
  but deleting is an action and not a state; colouring it costs `state-failed`
  its meaning. It turns red on hover, not at rest.

## Motion reports one thing: something is waiting for you

The **`pending`** glyph breathes — a slow opacity fade, nothing else. It is the
one state that is stuck until a person acts, and motion is the only channel that
reaches an eye which is not already pointed at it. A match being played asks
nothing of anybody, so `running` does not move; the blue half-filled ring says
active on its own.

Nothing else animates state. The moment a second thing pulses, neither one means
anything. The animation lives inside `StatusIcon`, on the state rather than on
the caller, so every place that draws `pending` moves and no component can
decide to be the exception. It is always wrapped in `motion-safe:`, so a device
asking for reduced movement gets the ring and the colour and no animation, which
still says waiting.

## The match row has two axes, not one

`active` and the progress of the result are independent facts, and a match can
be running while its result is nowhere near final. They therefore keep fixed
positions rather than sharing a mark: **active on the left, progress on the
right**. Reading is then positional, and no row has to be decoded.

Progress fills the ring in four steps, which is what the ring was drawn for:

| Progress | Glyph | Means |
| --- | --- | --- |
| `Empty` | dashed ring | no songs, no scores, no points |
| `In progress` | ring half filled | songs added, or some scores in |
| `Ready to commit` | ring three quarters filled | everything filled, waiting on a person |
| `Completed` | solid with a check | result committed |

`getMatchProgress` is the single source: the commit button derives from it, so
the badge a viewer reads and the button they press cannot disagree. The API
repeats the `Ready to commit` rule in one aggregate query
(`MatchService.countPendingByPhaseGroup`) so the sidebar can count without
loading matches; the two definitions have to be changed together.

Both read one rule — every round of the match is settled — and a match scored
by hand moves through the same four steps. In the table its round is a column
like any other, headed `By hand` instead of a song title, and its cells are the
points themselves rather than a percentage that ranks into points.

What settles a round is the one place the two kinds part company, and it is not
about where the data is kept. A round played on a song waits for every player,
because a missing score is a run nobody has entered yet. A hand-scored round
waits for nobody in particular: the points are stated, one to nothing is a
result, and a player nobody gave points to scored none. So it is settled as
soon as somebody has a point, and empty again if every point goes back to zero
— which is also when its column can be taken away again. See
[ScoringRefactoring.md](ScoringRefactoring.md).

## The tree inherits the state of what it contains

A branch of the sidebar shows the strongest state below it, pool to phase to
division to tournament. The pool is the bottom rung and the only node that can
see matches, so a match waiting on a person enters there and every node above
inherits it unchanged.

`pending` outranks `running` in that roll-up. During a tournament the sidebar's
job is not to say what is busy but to say what is stuck: a live match will
finish by itself, a match with every score in will not. Since `pending` is also
the state that breathes, a collapsed tree points at the branch that needs
somebody without being opened.

Pinned and recent tournaments live in separate labelled sections. The pin and
clock identify those sections once instead of repeating on every row. Only the
open tournament has structure loaded and can therefore carry a rolled-up status
glyph; other tournament rows need no identity icon of their own.

The row owns the **state** of a match and the card owns its **contents**, which
is why commit lives on the row rather than in the card. The right-hand slot is
one slot with three faces: the reason it cannot be committed yet while something
is missing, the commit button itself once it can be, and the completed badge
afterwards. What is left in the card header acts on the match — add a player,
add a song, the overflow menu — and nothing there reports status.

The right-hand state badge stays written out at every viewport width and sits
above the match text rather than taking horizontal space away from it. The text
fades beneath that badge; when it overflows, hovering with a pointer or tapping
the row on a touch device moves it far enough to reveal the hidden end. A
hand-scored round is always headed `By hand`, including on mobile, because it is
a different scoring mode rather than an abbreviated song title.

## Selection is greyscale

Selected rows and the active navigation item are `ui-selected` with a
`ui-border-strong` edge and heavier text. No brand tint.

An advancement-route highlight is not ordinary selection: it identifies the
source or destination of completed progression. Its row tint and card ring use
`state-done`, matching the route cells that triggered it.

This is the weakest point of the system in the light theme, and it is structural
rather than a tuning problem. Contrast is a ratio, so the same lightness step is
worth far more at the bottom of the scale: surface to selected is 1.24 in the
dark theme and 1.19 in the light one, and the light theme has to fit rest, hover
and selected into that. Selection in the light theme therefore always needs a
second signal — an edge, or text weight — and never leans on the grey alone.

## Creation is not a hue

An empty slot is marked by a **dashed outline**, never by a colour. The dash is a
shape signal, so it survives greyscale and colour blindness. `btnCreate` and
`btnCreateIcon` are neutral throughout.

## A hierarchical destination is a path

Division, phase and pool are one address, so they are drawn as one: a breadcrumb
the user can write, read left to right, with the same `/` the sidebar breadcrumb
uses. Three dependent dropdowns stacked as form fields say nothing about the
order they depend on each other in.

A filled segment is a raised surface; an empty one is the **dashed slot**
creation already uses, which is what says the path is unfinished without adding
a hue. A level nobody can use yet keeps its place and its dash and stops
responding, because removing it would move everything beside it.

On a narrow screen the path scrolls sideways rather than becoming a different
control. Its ends fade while there is more to see — the content is masked rather
than covered by a gradient, so the affordance is right on any background — and a
segment keeps a touch target larger than its label.

## Domain scales

These rank or identify a value and never report application state, so they sit
outside the system on purpose. Keep them namespaced so nobody harmonises them
away.

| Scale | Where | Why it is separate |
| --- | --- | --- |
| `judgment-*` | live score cards | the In The Groove palette — the colours a player reads off the cabinet |
| `difficulty-*` | song rows | ordinal scale over song difficulty |
| `score-*` | tournament stats badges | ordinal scale over result quality |
| banner gradients | `features/tournament/utils/tournamentBanner.ts` | decorative identity for a tournament without a logo |

### The live view is a dark surface in both themes

Tournament Manager is a service for In The Groove, so the judgment colours are
the game's own and are never adjusted for contrast: changing one would show a
player a colour that does not match the cabinet.

Legibility is therefore the background's job, and that palette is calibrated for
the near black of the game screen. On `live-screen` (`#0F1E2A`) every judgment
colour clears 4.5:1, Miss tightest at 4.61; on a mid-weight surface Miss and
Decent fall to about 3.1. So the live cards stay dark **even in the light
theme** — not as a style choice but as a consequence. A failing run keeps a dark
surface for the same reason: `live-failed` (`#2E0F14`, 4.79 at worst) plus a red
ring, because the ring sits behind no text. Never signal a state on the live
cards by fading the surface toward white.

## Themes

Every token is defined for both themes in `tokens.css`, so no component ever
names a theme. The choice is a device preference — it depends on where you are,
a laptop in the venue or a projector, not on who you are — and lives in
`shared/services/themePreference.ts` alongside the pool view mode.

Three settings, offered in the account page:

| Setting | What it does |
| --- | --- |
| Light | sets `data-theme="light"`, which beats a dark operating system |
| Dark | sets `data-theme="dark"`, which beats a light operating system |
| System | stores `"system"` and removes the attribute, so `prefers-color-scheme` decides and the page follows the OS live |

Two CSS blocks carry the dark values and both are needed: a
`@media (prefers-color-scheme: dark)` block guarded on
`:root:not([data-theme="light"])` for the System setting, and a
`:root[data-theme="dark"]` block for the explicit choice. They must stay
identical. The attribute block is last in the file, so at equal specificity it
wins.

`index.html` applies the stored attribute in an inline script before the bundle
loads. Without it a dark-theme device flashes the light theme on every load. The
script duplicates the storage key rather than importing it, because it has to
run before any module is fetched; keep the two in step.

### What the theme touches beyond the neutral scale

- **Score bands** invert. A dark band vanishes on a dark surface and a light one
  vanishes on white, so `--score-*` is defined per theme.
- **Elevation** is a token, not a hard-coded black: `--ui-shadow` and
  `--ui-shadow-alpha`. On light it is a soft cool shadow; on dark a deep black
  one, where the borders do most of the separating anyway.
- **react-select** cannot take Tailwind classes but does take any CSS value, so
  `selectStyles.ts` references the tokens as `rgb(var(--ui-surface))` rather than
  copying them.
- **The live view does not change.** Its surfaces and the judgment palette are
  fixed in both themes, for the reason given above.

## Product decisions

Lifecycle actions are shown in tournament configuration. Closed state uses a warning read-only notice; closing uses the existing danger-button treatment, while reopening uses the primary action treatment. The destructive confirmation must name the effective retention period and consequences rather than relying on a generic confirmation label.

Match cards separate state from action. The active state is shown by an informative status glyph to the left of the match name, never by a button, and it carries a tooltip that touch devices reveal by tapping it. Forward actions stay visible: the compact commit button sits in the match header next to the actions menu and is enabled only once every score is filled in. Reverse and rare actions, such as re-opening a committed match or toggling the active state, live in the match actions menu. Below the small breakpoint, controls that are visually compact keep a full touch target through a transparent expansion that does not affect layout.

## Match scoring editor

The match actions menu contains **Edit scoring system** for editable matches.
It opens a focused modal with one select field and a warning when the match has
played scores, because saving immediately recalculates completed song rounds.
Completed matches hide the action until they are reopened.
