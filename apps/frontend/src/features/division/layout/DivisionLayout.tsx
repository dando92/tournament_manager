import { Suspense } from "react";
import { Outlet } from "react-router-dom";
import { DivisionPageContextValue } from "@/features/division/context/DivisionPageContext";

/**
 * What wraps a division destination.
 *
 * There is nothing left here but the outlet. The tab bar that used to sit at
 * the top — Phases, Entrants, Seeding, Standings — was a second navigation
 * competing with the tree, and the tree won: every one of those is a node now.
 */
export default function DivisionLayout({ context }: { context: DivisionPageContextValue }) {
  return (
    <Suspense fallback={null}>
      <Outlet context={context} />
    </Suspense>
  );
}
