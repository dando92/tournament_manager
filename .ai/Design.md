# Design System and Design Decisions

The frontend uses Tailwind CSS. The design system and other frontend design decisions have not been defined yet.

Lifecycle actions are shown in tournament configuration. Closed state uses an amber read-only notice; closing uses the existing danger-button treatment, while reopening uses the primary action treatment. The destructive confirmation must name the effective retention period and consequences rather than relying on a generic confirmation label.

Match cards separate state from action. The active state is shown by an informative status dot to the left of the match name, never by a button, and the dot carries a tooltip that touch devices reveal by tapping it. Forward actions stay visible: the compact commit button sits in the match header next to the actions menu and is enabled only once every score is filled in. Reverse and rare actions, such as re-opening a committed match or toggling the active state, live in the match actions menu. Below the small breakpoint, controls that are visually compact keep a full touch target through a transparent expansion that does not affect layout.
