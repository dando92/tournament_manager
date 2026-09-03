import { useRef } from 'react';
import type { Match } from '@/features/match/model/types';
import type { Player } from '@/features/participant/model/types';
import { byMatchStanding } from '@/features/match/model/matchPoints';

/**
 * The order the rows of a match hold while somebody is working on them.
 *
 * Standing order is right for reading a match and wrong for editing one: a
 * point stated by hand moves the row it was stated on, so the next click lands
 * on somebody else's line. The order is therefore taken at three moments — the
 * card opening, the field changing, the result being committed — and held
 * between them. Closing the card and opening it again is what puts the rows
 * back in standing order, which is what having closed it already meant.
 *
 * `byMatchStanding` still decides the order itself. What is kept here is only
 * when to ask it.
 */
export function useStandingOrder(match: Match, players: Player[]): Player[] {
    const roster = players.map((player) => player.id).sort((left, right) => left - right).join('-');
    const stamp = `${roster}|${match.matchResult ? 'committed' : 'open'}`;
    const frozen = useRef<{ stamp: string; order: number[] }>({ stamp: '', order: [] });

    if (frozen.current.stamp !== stamp) {
        frozen.current = { stamp, order: [...players].sort(byMatchStanding(match)).map((player) => player.id) };
    }

    const rank = new Map(frozen.current.order.map((playerId, index) => [playerId, index]));

    return [...players].sort((left, right) => (rank.get(left.id) ?? 0) - (rank.get(right.id) ?? 0));
}
