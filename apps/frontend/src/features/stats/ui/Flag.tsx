import { countryFlag, countryName } from "@/shared/lib/countries";

/**
 * Where a competitor is from, before their name.
 *
 * The flag is the regional indicator pair of the country code, so it needs no
 * asset and no dependency. Platforms that draw flags draw one; Windows draws the
 * two letters instead, which is a legible answer rather than a broken image.
 * Replacing this with an SVG set is a decision with a cost — around two hundred
 * and fifty files — and is not made here.
 *
 * A player with no linked account has no nationality, so the slot is an empty
 * dashed square. That is the common case rather than the exception, and it is
 * drawn rather than collapsed so a column of names stays a column.
 */
export default function Flag({ nationality }: { nationality: string }) {
  if (!nationality) {
    return <span className="inline-block h-[14px] w-[20px] shrink-0 rounded-[2px] border border-dashed border-ui-border-strong" title="No nationality" />;
  }

  return (
    <span
      className="inline-flex h-[14px] w-[20px] shrink-0 items-center justify-center overflow-hidden rounded-[2px] text-[13px] leading-none ring-1 ring-ui-text/15"
      title={countryName(nationality)}
    >
      {countryFlag(nationality)}
    </span>
  );
}
