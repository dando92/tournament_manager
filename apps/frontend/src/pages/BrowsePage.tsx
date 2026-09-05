import Sidebar from "@/shared/components/layout/Sidebar";

/**
 * The tree as a page, for phones.
 *
 * It renders the same sidebar the desktop shows, so there is one tree to
 * maintain rather than a full one and a cut-down mobile copy. Choosing a
 * destination navigates away and this page unmounts itself, which is what
 * makes it a step in a journey rather than a panel that has to be dismissed.
 */
export default function BrowsePage() {
  /* `dvh` because `vh` is the viewport without the browser's chrome, and the
     last rows of the tree end up under it. The negative bottom margin cancels
     the padding the outlet keeps for the fixed bar, so the tree is the only
     scroller on the page rather than one nested in another. */
  return (
    <div className="-m-4 -mb-20 flex h-[calc(100dvh-3.5rem-env(safe-area-inset-bottom))] flex-col md:hidden">
      <Sidebar showFooter={false} />
    </div>
  );
}
