# Frontend Architecture and Coding Rules

## Technologies

- Node.js 22
- TypeScript
- React 18
- Vite 5
- Tailwind CSS 3
- TanStack Query

## Location

The frontend is located in `apps/frontend` and is an npm workspace. It communicates with the API through HTTP and with `apps/realtime` through browser WebSockets.

Vite loads build-time development defaults from the repository root. Container deployments inject public endpoints through `/runtime-config.js` at startup so one immutable image works in every environment.

## Realtime Recovery

- Treat HTTP snapshots as authoritative view state.
- Treat WebSocket messages as incremental updates.
- Reconnect automatically after transport interruption.
- Reload the relevant snapshot after reconnecting or detecting a sequence gap.
- Do not require replay of replaceable high-frequency live events.
- Configure the browser WebSocket and realtime snapshot origin independently with `PUBLIC_REALTIME_URL`; `PUBLIC_API_URL` remains the authoritative application API. The `VITE_*` values are development fallbacks only.
- Keep the legacy path-specific message handlers during the migration, but route them through the shared reconnecting and sequence-aware client.

## Tournament Lifecycle

- Tournament lifecycle state comes from the authoritative HTTP response.
- Closed tournaments expose read views but suppress mutation controls. Configuration remains available to authorized staff so the tournament can be reopened.
- Closing requires an explicit confirmation that states the configured retention period, read-only behavior, lobby disconnection, and permanent transport-data deletion.
- Reopening restores mutation controls but does not imply that previously purged transport history can be reconstructed.

## Navigation

The tournament tree in the sidebar is the application's only navigation. Keep it
that way: a second control that reaches the same destination is what made the
previous layout hard to follow.

- Every node the tree can select is an address. A branch (division, phase, pool)
  opens the same flat match list at a different depth; the open match is a
  `?match=` search parameter, because it is a sub-state of the list rather than
  another destination.
- A pool's sticky list header opens every match in that pool as raw cards below
  the list. A search opens every matching card across the division; selecting a
  match row returns the lower panel to its single-card detail view.
- Editors see one lobby-control card below the match cards instead of the live
  view. Its lobby selector remains explicit even when the legacy deployment has
  one lobby, and its song selector contains the distinct song paths assigned to
  active matches anywhere in the tournament. Read-only viewers continue to see
  the live view in that position.
- Match Control is a tournament-level destination for staff. It presents
  persisted match flows, their current or waiting match, queue, lifecycle
  actions, and an independent lobby-control card. Flow editing is available
  only while a flow is inactive; Unassigned exists only inside that editor.
  Completed flows are immutable and may be archived from the control room. See
  [MatchControl.md](MatchControl.md).
- `TournamentUpdatesProvider` and `TournamentTreeProvider` are mounted in
  `MainLayout`, above both the sidebar and the page outlet. The tree draws state
  derived from the same data the pages show, so it has to sit beside them, not
  inside them.
- Tournament structure — divisions, phases, pools — belongs to
  `TournamentTreeProvider` alone, together with every operation that changes it.
  Pages read it from there rather than fetching it again.
- Creation, renaming and deletion of structure act on a node, so they live in
  that node's context menu. A page header carries only what applies to the page
  it heads.
- Destinations a viewer cannot reach are omitted from the tree, not disabled.
- Tree expansion, recent tournaments and pinned tournaments persist in
  localStorage. Sidebar width does not: it is a momentary adjustment, not a
  setting.
- The tournament list groups pinned and recent tournaments under separate
  headings. The pin and clock identify their section once rather than repeating
  on every tournament row; a tournament still appears in only one section. Both
  sections are collapsible and remember their state on the device.
- A tournament row expands or collapses its structure without navigating. The
  sidebar previews at most one tournament structure outside the current page;
  navigation begins at the destinations inside that structure.
- The sidebar's new-tournament action opens its modal in place. Only successful
  creation navigates, landing on the new tournament overview.

## Song Import

The browser owns the folder a person picked, so the browser reads it. The
importer opens a directory picker, walks the handles it is given, parses the
simfiles it finds, and sends one payload of charts to `POST /songs/import`;
the API validates that payload and writes it in one transaction.

- Never upload a `Songs` folder to reproduce the parsing on a server.
- Keep the parsing pure. `songImport/stepmaniaParser.ts` takes text and gives
  values, `songImport/scan.ts` takes directory handles, and both are testable
  without a browser.
- The discovery rules come from `itgmania-songs-to-json.mjs` and are not to be
  reinvented: the picked folder is one pack when any direct child holds a
  simfile, folders starting with `.` are ignored, `.ssc` wins over `.sm`,
  `dance-single` is the only step type imported, and `highest` is the highest
  meter.
- A folder is read once. Choosing between every difficulty and the highest one
  filters the parsed result in memory; it does not go back to the disk.
- The difficulty slot is read from the simfile, never derived from the meter.
  A slot the application does not know is skipped and reported.
- The `chart-*` colours are the cabinet's, like `judgment`. They are data:
  never realign one to the semantic palette.

## Cascading Path Picker

A hierarchical destination is chosen as one path, not as one dropdown per level.
`shared/components/ui/CascadingPathPicker.tsx` draws it and
`shared/components/ui/cascadingPath.ts` holds the rules, which are pure and
depth-agnostic so they can be read as a table of paths in
`tests/unit/cascading-path.test.ts`.

- The depth is fixed. Changing a level never removes the levels below it: they
  become empty slots, so the layout does not move while a path is completed.
- A level offers what its ancestors allow, and a level whose ancestors are not
  settled cannot be used.
- Choosing a level clears everything below it. A value that is not among the
  options of its level is not a selection and is dropped by the same pass, so no
  caller has to remember to clear one.
- A level offering exactly one option settles itself, and the level below it may
  then settle in turn. A person is never asked for a choice they do not have.
- The path is owned by the form, not by the picker: the picker reports the
  settled path and the form derives completeness from it. Never keep a second
  piece of state saying whether the path is complete — `isCompleteMatchPath` is
  a type guard over the value itself.
- The options panel is positioned inside the picker rather than portalled. It
  has to escape the horizontal scroller, not the page, and a portalled panel
  inside a dialog reads as a click outside that dialog.

Additional frontend architectural and coding rules remain intentionally minimal.

## API Modules and Shared Contracts

- Import `axios` only from a feature's `api/` module. `app/providers.tsx` is the sole bootstrap exception because it configures the shared client.
- Browser-gateway DTOs shared with Realtime belong in `@tournament-manager/contracts`; frontend features import them rather than redeclaring flattened transport shapes.

## View and Logic Boundaries

- Logic that is inherently tied to rendering may stay in the component that
  owns the relevant DOM. This includes element measurement, focus, scrolling,
  hover and touch interaction, transient animation state, portals, and other
  behavior that cannot be meaningfully evaluated without the rendered view.
- Logic that is not inherently tied to rendering must live outside the view in
  a model function, hook, service, or API module appropriate to its
  responsibility. This includes domain and product rules, data transformations,
  filtering, grouping, sorting, persistence, request orchestration, and state
  shared by more than one view.
- Prefer pure functions for non-rendering transformations so they can be tested
  without mounting React. A component may compose their results, but it must not
  become their only implementation.
- Do not extract rendering-specific behavior merely to make a component appear
  smaller. Extract it when it is reused, independently testable, or obscures the
  component's rendering responsibility.
