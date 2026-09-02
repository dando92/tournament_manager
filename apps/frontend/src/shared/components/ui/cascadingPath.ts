/**
 * The rules a cascading path follows, kept apart from the component that draws
 * it.
 *
 * A path is an array of choices, one per level, where every level offers the
 * options its ancestors allow: a phase belongs to a division, a pool belongs to
 * a phase. Three rules follow from that and they are the whole model.
 *
 * - A level that has no settled ancestor cannot be chosen, and everything below
 *   an unsettled level is empty rather than stale.
 * - A level with exactly one option is not a choice, so it settles itself. The
 *   next level then has an ancestor and may settle itself in turn, which is why
 *   the resolution is one pass over all of them rather than a per-level rule.
 * - A level that asked to stay out of the way while it is not a choice is
 *   settled all the same, and reported as one nobody has to be shown.
 * - What is not among the options is not a selection. An identifier that
 *   survives from an earlier parent is dropped by the same pass, so no caller
 *   has to remember to clear it.
 *
 * Everything here is pure and depth-agnostic, which is what lets the component
 * be a renderer and the tests be a table of paths.
 */

export type PathOption<TValue> = {
  value: TValue;
  label: string;
};

export type PathValue<TValue> = ReadonlyArray<TValue | null>;

export type PathLevel<TValue> = {
  /** Stable identity for the level, used as a React key and in tests. */
  key: string;
  /** What the level is called, and what its empty segment invites: "Division". */
  label: string;
  /**
   * The options this level allows under the choices already settled above it.
   * The array it receives holds one entry per ancestor level, in order.
   */
  getOptions: (ancestors: PathValue<TValue>) => PathOption<TValue>[];
  /**
   * Whether the level is worth drawing only when it offers a choice. A pool
   * asks for this: a phase holding one does not name it anywhere else either.
   */
  implicitWhenSingle?: boolean;
};

/** A level as it is drawn: what it offers, what it holds, whether it can be used. */
export type PathLevelView<TValue> = {
  key: string;
  label: string;
  enabled: boolean;
  /** False for a settled level that asked not to be drawn while it is not a choice. */
  visible: boolean;
  options: PathOption<TValue>[];
  selected: PathOption<TValue> | null;
};

/**
 * Reads the whole path in one pass, applying the three rules above.
 *
 * The options of a level are resolved against the choices this pass has already
 * settled, not against the value that came in, so an auto-selected division
 * immediately gives its phases something to hang from.
 */
export function describePath<TValue>(
  levels: ReadonlyArray<PathLevel<TValue>>,
  value: PathValue<TValue>,
): PathLevelView<TValue>[] {
  const views: PathLevelView<TValue>[] = [];
  const settled: (TValue | null)[] = [];
  let blocked = false;

  levels.forEach((level, index) => {
    const options = blocked ? [] : level.getOptions(settled);
    const current = value[index] ?? null;
    const selected =
      options.find((option) => option.value === current) ?? (options.length === 1 ? options[0] : null);

    views.push({
      key: level.key,
      label: level.label,
      enabled: !blocked && options.length > 0,
      visible: !level.implicitWhenSingle || options.length > 1,
      options,
      selected: selected ?? null,
    });

    settled.push(selected ? selected.value : null);
    if (!selected) blocked = true;
  });

  return views;
}

/** The path the rules settle on, which is what the picker reports upwards. */
export function resolvePath<TValue>(
  levels: ReadonlyArray<PathLevel<TValue>>,
  value: PathValue<TValue>,
): PathValue<TValue> {
  return describePath(levels, value).map((view) => view.selected?.value ?? null);
}

/**
 * Choosing at one level. Everything below it is cleared before the rules run
 * again: an option that happens to stay valid under the new parent is still a
 * choice made under the old one.
 */
export function selectAtLevel<TValue>(
  levels: ReadonlyArray<PathLevel<TValue>>,
  value: PathValue<TValue>,
  index: number,
  selected: TValue,
): PathValue<TValue> {
  const next = levels.map((_, level) => {
    if (level < index) return value[level] ?? null;
    return level === index ? selected : null;
  });

  return resolvePath(levels, next);
}

/** Whether every level holds a choice. */
export function isCompletePath<TValue>(value: PathValue<TValue>): value is ReadonlyArray<TValue> {
  return value.every((entry) => entry !== null);
}

/** Whether two paths say the same thing, which is what stops a resolution loop. */
export function samePath<TValue>(left: PathValue<TValue>, right: PathValue<TValue>): boolean {
  return left.length === right.length && left.every((entry, index) => entry === (right[index] ?? null));
}
