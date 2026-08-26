# Advancement Rule Editor

## Approved editor behavior

Advancement rules are edited in a focused modal instead of inline inside a
match card or in place of the matches page. The underlying page remains visible
as context.

- The modal title identifies the complete source path.
- Desktop and mobile use a centered, content-sized dialog. Its height is capped
  to the viewport, with the rule list scrolling only when the content no longer
  fits.
- Every rule is one editable sentence: `1 place advances to phase / pool /
  match in slot 1`. Placements are deliberately cardinal rather than ordinal.
- Finishing place and target slot use the same compact native number control,
  including its increment and decrement arrows. The word `place` remains
  outside the number control.
- Editable values have no persistent field border. A compact neutral raised
  surface and the destination chevron distinguish them from the sentence
  around them.
- Target kind and hierarchical destination are one control. Its menu groups
  matches and pools while the stored draft still carries `targetKind` and
  `targetId` separately.
- Desktop keeps the sentence inline. On narrow screens the `in slot` clause and
  delete action share a dedicated second line.
- The destination uses the `phase / pool / match` path already used elsewhere
  in the interface.
- Add creates another individual rule. Delete removes only the unsaved draft.
- Cancel and Save rules remain visible below the independently scrolling rule
  list.
- `Add advancement` shares the footer row with Cancel and Save on desktop. On
  narrow screens it sits immediately above Save.
- Match cards do not repeat saved outgoing rules below their table. The future
  match tree will visualize those relationships.
- The persisted model and API remain unchanged: each saved item is one
  `AdvancementRuleInput`.
- A match or phase group is not offered as its own destination, and both the
  modal and API reject a source targeting itself.
- A finishing place can appear only once in a draft. Duplicate source
  placements block saving because the same finisher cannot advance to two
  different destinations.

## Deferred quick-rule mode

The quick-rule mode is approved as a future direction but is deliberately not
implemented in the current editor.

Its purpose is to create a common sequential mapping without making the user
add each rule separately. The proposed sentence is:

> Advance the top **N** finishers to **destination**, starting at **target slot
> S**.

For example, `N = 4` and `S = 1` produces this preview:

1. 1st place → target slot 1
2. 2nd place → target slot 2
3. 3rd place → target slot 3
4. 4th place → target slot 4

Applying a quick rule should expand it into ordinary individual draft rules.
After expansion, every generated rule remains independently editable and uses
the existing API. Quick rules must not introduce a second persisted rule model
or require the backend to understand ranges.

### Proposed interaction

1. `Add advancement` continues to add one ordinary rule.
2. A separate `Quick setup` action opens a compact builder inside the same
   modal.
3. The builder asks for the number of advancing finishers, destination kind,
   destination path, and first target slot.
4. A read-only preview lists every individual mapping before it is applied.
5. `Add generated rules` appends or replaces rules only after the user resolves
   any conflicts.

### Proposed validation rules

- The finisher count and first target slot must be positive integers.
- Every generated target slot must exist conceptually as a positive slot.
- The source cannot target itself.
- The preview must identify collisions with an existing rule using the same
  target and target slot.
- The resulting individual draft must pass the same validation as manually
  entered rules.
- Generation must never save automatically.

### Unresolved product decisions

These remain proposals until explicitly decided:

- Whether quick setup appends to existing rules or offers an explicit
  Append/Replace choice.
- Whether an existing rule for the same finishing place is a conflict or is
  replaced by the generated mapping.
- Whether the number of finishers should be capped from known source entrants,
  when that number is available.
- Whether a reverse sequence is useful, such as first place entering the last
  slot in a target range.
- Whether one quick operation may distribute finishers across multiple pools;
  this is outside the initial sequential single-destination proposal.
