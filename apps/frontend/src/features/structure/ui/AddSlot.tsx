import { useEffect, useRef, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus } from "@fortawesome/free-solid-svg-icons";

import { btnCreate, focusRing } from "@/styles/buttonStyles";

type AddSlotProps = {
  /** What is being added, which is also the word on the resting slot. */
  noun: string;
  suggestedName: string;
  disabled?: boolean;
  onCreate: (name: string, keepGoing: boolean) => Promise<void>;
  className?: string;
  style?: React.CSSProperties;
};

/**
 * One slot, five nouns.
 *
 * A division, a phase, a pool, a match and a route are all added the same way:
 * a dashed outline that becomes a field with a name already suggested and
 * selected, and Enter creates it. Shift+Enter leaves the next slot open, so
 * four pools is four keystrokes rather than four dialogs.
 *
 * The dash is the design system's mark for something that is not there yet, so
 * the control says what it is without a colour and survives greyscale.
 */
export default function AddSlot({ noun, suggestedName, disabled, onCreate, className = "", style }: AddSlotProps) {
  const [naming, setNaming] = useState(false);
  const [value, setValue] = useState(suggestedName);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!naming) return;
    setValue(suggestedName);
    /* The suggestion is selected rather than merely present: a name that suits
       is one keystroke, and a name that does not is typed straight over it. */
    requestAnimationFrame(() => input.current?.select());
  }, [naming, suggestedName]);

  async function commit(keepGoing: boolean): Promise<void> {
    const name = value.trim();
    if (!name) {
      setNaming(false);
      return;
    }

    setBusy(true);
    try {
      await onCreate(name, keepGoing);
      setNaming(keepGoing);
    } finally {
      setBusy(false);
    }
  }

  if (!naming) {
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={() => setNaming(true)}
        style={style}
        className={`${btnCreate} flex w-full items-center justify-center gap-2 rounded-lg border text-xs font-semibold ${className}`}
      >
        <FontAwesomeIcon icon={faPlus} className="text-[10px]" />
        {noun}
      </button>
    );
  }

  return (
    <div style={style} className={`flex w-full items-center rounded-lg border border-ui-border-strong bg-ui-surface px-2 ${className}`}>
      <input
        ref={input}
        autoFocus
        disabled={busy}
        value={value}
        aria-label={`Name of the new ${noun.toLowerCase()}`}
        onChange={(event) => setValue(event.target.value)}
        onBlur={() => setNaming(false)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            void commit(event.shiftKey);
          }
          if (event.key === "Escape") {
            event.preventDefault();
            setNaming(false);
          }
        }}
        className={`w-full bg-transparent py-1 text-sm font-semibold text-ui-text outline-none ${focusRing}`}
      />
    </div>
  );
}
