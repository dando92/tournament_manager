import { useCallback, useEffect, useState } from 'react';
import { Song } from '@/features/song/model/types';
import { rollSongs } from '@/features/song/api/song.api';
import { formatRollLevels, parseRollLevels } from '@/features/song/model/rollLevels';
import { readSongDialogChoices, writeSongDialogChoice } from '@/shared/lib/songDialogPreferences';

/**
 * One card of a draw.
 *
 * The key is the card's own, kept across re-rolls, so React redraws the song
 * inside a card that stays where it is instead of replacing the card. A locked
 * card survives the next roll of the whole set; an empty one is a level the
 * pool had nothing left for, which is worth seeing rather than hiding.
 */
export type RollSlot = {
    key: string;
    level: number;
    song: Song | null;
    locked: boolean;
};

type UseSongRollOptions = {
    open: boolean;
    /** The pool a draw reaches, and what it counts as already played. */
    divisionId?: number;
    /** The match the draw is for, when it exists already. Its own songs are never drawn. */
    matchId?: number;
    /** Only the remembered preferences are keyed on it; the pool comes from the division. */
    tournamentId?: number;
    /** The packs the pool holds, which is what a remembered one is checked against. */
    songGroups: string[];
};

let nextKey = 0;

/**
 * A draw somebody watches happen.
 *
 * Rolling used to be part of the write that created the rounds: you asked for a
 * level and found out what you got once it was already the match. Here the draw
 * is a question — the server answers with one card per level and writes nothing
 * — and the dialog commits the song ids of the cards that are still on the
 * table. What you saw is what you get.
 *
 * The levels are one field because that is how people say them: `9-9-10-10` is
 * four cards, and the chips under the field are what was understood.
 */
export function useSongRoll({ open, divisionId, matchId, tournamentId, songGroups }: UseSongRollOptions) {
    const [levelsText, setLevelsText] = useState('');
    const [group, setGroup] = useState('');
    const [allowPlayed, setAllowPlayed] = useState(false);
    const [slots, setSlots] = useState<RollSlot[]>([]);
    const [rolling, setRolling] = useState(false);
    const [failure, setFailure] = useState<string | null>(null);

    const levels = parseRollLevels(levelsText);
    const drawnSongIds = slots.flatMap((slot) => (slot.song ? [slot.song.id] : []));

    /* Opening the dialog is what resets the draw: cards from the last one are
       not offers this one made. What the draw is asked over — the pack and
       whether played songs count — is the opposite: it is the same question
       every time, so it opens on the last answer. Both are read here rather
       than held as initial state, because the dialog outlives the tournament it
       was opened on. */
    useEffect(() => {
        if (!open) {
            return;
        }

        const choices = readSongDialogChoices(tournamentId);
        setLevelsText('');
        setSlots([]);
        setFailure(null);
        setRolling(false);
        setAllowPlayed(choices.allowPlayed);
        setGroup(choices.rollPack);
    }, [open, tournamentId]);

    /* The catalogue arrives after the dialog opens, so a remembered pack is
       checked when the packs are known rather than when it is read: one this
       pool no longer holds would narrow every draw to a pack nobody can see in
       the field. It hangs on the catalogue alone, so an opening the catalogue
       did not change never re-judges what was just read. */
    useEffect(() => {
        if (songGroups.length === 0) {
            return;
        }

        setGroup((current) => (current !== '' && !songGroups.includes(current) ? '' : current));
    }, [songGroups]);

    const chooseAllowPlayed = useCallback((value: boolean) => {
        setAllowPlayed(value);
        writeSongDialogChoice(tournamentId, 'allowPlayed', value);
    }, [tournamentId]);

    const chooseGroup = useCallback((value: string) => {
        setGroup(value);
        writeSongDialogChoice(tournamentId, 'rollPack', value);
    }, [tournamentId]);

    const draw = useCallback(async (request: { levels: number[]; excludeSongIds: number[] }) => {
        if (divisionId === undefined) {
            throw new Error('No division to draw from.');
        }

        return await rollSongs({
            divisionId,
            matchId,
            levels: request.levels,
            group: group || undefined,
            allowPlayed,
            excludeSongIds: request.excludeSongIds,
        });
    }, [allowPlayed, divisionId, group, matchId]);

    /**
     * Draws the whole set, keeping the cards that were locked.
     *
     * A locked card holds its place and its level, so what is asked for is the
     * levels of the cards that are not locked, and what the draw is told to
     * avoid is the songs the locked ones hold.
     */
    const rollAll = useCallback(async () => {
        const wanted = parseRollLevels(levelsText);
        if (wanted.length === 0) {
            return;
        }

        const kept = new Map<number, RollSlot>();
        slots.forEach((slot, index) => {
            if (slot.locked && slot.song && wanted[index] === slot.level) {
                kept.set(index, slot);
            }
        });

        const pending = wanted.map((level, index) => ({ level, index })).filter((entry) => !kept.has(entry.index));
        setRolling(true);
        setFailure(null);
        try {
            const drawn = pending.length > 0
                ? await draw({ levels: pending.map((entry) => entry.level), excludeSongIds: [...kept.values()].flatMap((slot) => (slot.song ? [slot.song.id] : [])) })
                : [];

            setSlots(wanted.map((level, index) => {
                const locked = kept.get(index);
                if (locked) {
                    return locked;
                }

                const position = pending.findIndex((entry) => entry.index === index);

                return { key: `slot-${nextKey++}`, level, song: drawn[position]?.song ?? null, locked: false };
            }));
        } catch (error) {
            setFailure(error instanceof Error ? error.message : 'Unable to roll the songs.');
        } finally {
            setRolling(false);
        }
    }, [draw, levelsText, slots]);

    /**
     * Draws one card again.
     *
     * The song it holds is excluded along with every other card on the table:
     * somebody pressing re-roll wants a different song, and being handed the
     * same one back reads as a fault rather than as chance. A level with
     * nothing else left keeps the card it has and says so.
     */
    const rerollSlot = useCallback(async (key: string) => {
        const slot = slots.find((candidate) => candidate.key === key);
        if (!slot) {
            return;
        }

        setRolling(true);
        setFailure(null);
        try {
            const [drawn] = await draw({ levels: [slot.level], excludeSongIds: drawnSongIds });
            if (!drawn?.song) {
                setFailure(`No other song of level ${slot.level} is available.`);

                return;
            }

            setSlots((current) => current.map((candidate) => (candidate.key === key ? { ...candidate, song: drawn.song } : candidate)));
        } catch (error) {
            setFailure(error instanceof Error ? error.message : 'Unable to roll the songs.');
        } finally {
            setRolling(false);
        }
    }, [draw, drawnSongIds, slots]);

    const toggleLock = useCallback((key: string) => {
        setSlots((current) => current.map((slot) => (slot.key === key ? { ...slot, locked: !slot.locked } : slot)));
    }, []);

    /* Taking a card out takes its level out of the draw with it, so the field
       and the cards under it never disagree about what was asked for. */
    const removeSlot = useCallback((key: string) => {
        setSlots((current) => {
            const remaining = current.filter((slot) => slot.key !== key);
            setLevelsText(formatRollLevels(remaining.map((slot) => slot.level)));

            return remaining;
        });
    }, []);

    return {
        levels,
        levelsText,
        group,
        allowPlayed,
        slots,
        rolling,
        failure,
        drawnSongIds,
        canRoll: divisionId !== undefined && levels.length > 0 && !rolling,
        setLevelsText,
        setGroup: chooseGroup,
        setAllowPlayed: chooseAllowPlayed,
        rollAll,
        rerollSlot,
        toggleLock,
        removeSlot,
    };
}

export type SongRollState = ReturnType<typeof useSongRoll>;
