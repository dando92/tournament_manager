/**
 * What the applier said, and which cards it said it about.
 *
 * A refused plan comes back as a list of reasons written in local ids, because
 * a local id is the one name a plan and a database both know. Nobody reads
 * `phase:-2`, so a reason is broken into the words around its nodes and the
 * nodes themselves: the page spells the nodes with their own names, points at
 * them, and the canvas marks the same ones in the same colour.
 *
 * A local id is `kind:id`, and a drafted row has a negative one — which is why
 * the number is signed here and why the same string keys a card on the canvas.
 */

const REF = /\b((?:phase|pool|match|division):-?\d+)\b/;

/** One piece of a reason: words, or a node the reader can be sent to. */
export type ReasonPiece = { text: string; ref?: string };

export function refsIn(reason: string): string[] {
    return spellReason(reason).flatMap((piece) => (piece.ref ? [piece.ref] : []));
}

export function spellReason(reason: string): ReasonPiece[] {
    /* A capturing split alternates: words, node, words, node, words. */
    return reason
        .split(new RegExp(REF.source, "g"))
        .map((piece, index) => (index % 2 === 1 ? { text: piece, ref: piece } : { text: piece }))
        .filter((piece) => piece.ref !== undefined || piece.text.length > 0);
}
