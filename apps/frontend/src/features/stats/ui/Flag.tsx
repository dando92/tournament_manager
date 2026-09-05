import { useState } from "react";

import { countryName } from "@/shared/lib/countries";

/**
 * Where a competitor is from, before their name.
 *
 * The flags are `flag-icons`' own SVGs, copied into `public/flags` at build time
 * rather than committed or pulled from a CDN — this application is
 * self-contained, and a page that loses its flags without internet would be the
 * one part of it that does. One small request per distinct flag, cached after
 * the first; the package's stylesheet is deliberately not used, because it
 * carries a rule per country and every visitor would download all of them.
 *
 * A player with no linked account has no nationality, so the slot is an empty
 * dashed square. That is the common case rather than the exception, and it is
 * drawn rather than collapsed so a column of names stays a column. A code with
 * no file falls back to the same square.
 */
export default function Flag({ nationality }: { nationality: string }) {
  const [missing, setMissing] = useState(false);
  const code = nationality.toLowerCase();

  if (!nationality || missing) {
    return <span className="inline-block h-[14px] w-[20px] shrink-0 rounded-[2px] border border-dashed border-ui-border-strong" title="No nationality" />;
  }

  return (
    <img
      src={`/flags/${code}.svg`}
      alt=""
      title={countryName(nationality)}
      onError={() => setMissing(true)}
      className="h-[14px] w-[20px] shrink-0 rounded-[2px] object-cover ring-1 ring-ui-text/15"
    />
  );
}
