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
  return (
    <div className="-m-4 flex h-[calc(100vh-3.5rem)] flex-col md:hidden">
      <Sidebar showFooter={false} />
    </div>
  );
}
