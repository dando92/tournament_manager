import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiErrorMessage } from '@/shared/lib/apiError';
import { usePageNotices } from '@/shared/context/PageNoticeContext';
import { Division } from '@/features/division/model/types';
import { Entrant, Participant } from '@/features/participant/model/types';
import {
    addParticipantsToDivision,
    listAvailableParticipantsForDivision,
    removeParticipantsFromDivision,
} from '@/features/participant/api/participant.api';

type UsePlayersTabOptions = {
    division: Division;
    entrants: Entrant[];
};

/** The default is the order the participants were registered in; name order wins over it when chosen. */
export type RosterOrder = 'added' | 'name';

/** Which half of the roster is on screen. The counts are the reason it exists: they answer "how many so far". */
export type RosterFilter = 'all' | 'entrants' | 'others';

/**
 * Who is competing in the division right now.
 *
 * The roster itself arrives through the query cache: admitting or withdrawing
 * somebody publishes a division event, which stales the roster and the counts
 * the tree draws. What is left here is the list of people who are available to
 * add, which is read for this tab alone.
 *
 * Removing somebody withdraws their entrant rather than deleting it, so the
 * roster keeps the row and states its status. A withdrawn entrant is not
 * somebody the division holds: counting it made a removed person keep their
 * Remove button, while the division they had left went on holding their seat.
 */
function competing(entrants: Entrant[]): Participant[] {
    return entrants
        .filter((entrant) => entrant.status === 'active')
        .flatMap((entrant) => entrant.participants ?? [])
        .filter(Boolean);
}

/**
 * The roster tab: one list of everybody in the tournament, saying who competes.
 *
 * The two lists it merges — the division's own entrants and everybody still
 * available — are one list here on purpose. They used to be shown one after the
 * other, so admitting somebody moved their row from the bottom half to the top
 * half and the list reordered itself under the pointer that had just clicked
 * it. Merged and sorted by one rule, a row changes state where it stands.
 *
 * A participant id is the order somebody was registered in, which is what the
 * default order sorts by. Name order sorts the whole list, entrants included:
 * whoever asked for names wants names, and the entrants chip is the way back to
 * seeing the roster on its own.
 */
export function usePlayersTab({ division, entrants }: UsePlayersTabOptions) {
    const { report } = usePageNotices();
    const [divisionParticipants, setDivisionParticipants] = useState<Participant[]>(competing(entrants));
    const [availableParticipants, setAvailableParticipants] = useState<Participant[]>([]);
    const [search, setSearch] = useState('');
    const [order, setOrder] = useState<RosterOrder>('added');
    const [filter, setFilter] = useState<RosterFilter>('all');
    const [selecting, setSelecting] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
    /* The row a range extends from: shift picks everybody between it and the row that was shift-clicked. */
    const [anchorId, setAnchorId] = useState<number | null>(null);
    const [pendingRemoval, setPendingRemoval] = useState<Participant[]>([]);
    const [saving, setSaving] = useState(false);

    const loadAvailableParticipants = useCallback(async () => {
        const participants = await listAvailableParticipantsForDivision(division.id);
        setAvailableParticipants(participants);
    }, [division.id]);

    useEffect(() => {
        loadAvailableParticipants().catch(() => {});
    }, [loadAvailableParticipants]);

    useEffect(() => {
        setDivisionParticipants(competing(entrants));
    }, [entrants]);

    const divisionParticipantIds = useMemo(
        () => new Set(divisionParticipants.map((participant) => participant.id)),
        [divisionParticipants],
    );

    const everybody = useMemo(
        () => {
            const participants = [...divisionParticipants, ...availableParticipants].filter(
                (participant, index, all) => all.findIndex((candidate) => candidate.id === participant.id) === index,
            );

            return order === 'name'
                ? [...participants].sort((a, b) => a.player.playerName.localeCompare(b.player.playerName))
                : [...participants].sort((a, b) => a.id - b.id);
        },
        [availableParticipants, divisionParticipants, order],
    );

    const lowerSearch = search.trim().toLowerCase();
    const searched = useMemo(
        () => everybody.filter((participant) => participant.player.playerName.toLowerCase().includes(lowerSearch)),
        [everybody, lowerSearch],
    );

    /* The counts describe what the search left, so a chip and the list it opens can never disagree. */
    const counts = useMemo(
        () => {
            const entrantCount = searched.filter((participant) => divisionParticipantIds.has(participant.id)).length;

            return { all: searched.length, entrants: entrantCount, others: searched.length - entrantCount };
        },
        [divisionParticipantIds, searched],
    );

    const visibleParticipants = useMemo(
        () => {
            if (filter === 'entrants') {
                return searched.filter((participant) => divisionParticipantIds.has(participant.id));
            }
            if (filter === 'others') {
                return searched.filter((participant) => !divisionParticipantIds.has(participant.id));
            }

            return searched;
        },
        [divisionParticipantIds, filter, searched],
    );

    /* The line above the list counts the whole roster, not the search: it is the state of the division, not of the query. */
    const summary = useMemo(
        () => ({ entrants: divisionParticipants.length, participants: everybody.length }),
        [divisionParticipants.length, everybody.length],
    );

    const selected = useMemo(
        () => everybody.filter((participant) => selectedIds.has(participant.id)),
        [everybody, selectedIds],
    );
    const selectedToAdd = useMemo(
        () => selected.filter((participant) => !divisionParticipantIds.has(participant.id)),
        [divisionParticipantIds, selected],
    );
    const selectedToRemove = useMemo(
        () => selected.filter((participant) => divisionParticipantIds.has(participant.id)),
        [divisionParticipantIds, selected],
    );
    const allVisibleSelected = visibleParticipants.length > 0 && visibleParticipants.every((participant) => selectedIds.has(participant.id));

    const clearSelection = useCallback(() => {
        setSelectedIds(new Set());
        setAnchorId(null);
    }, []);

    const stopSelecting = useCallback(() => {
        setSelecting(false);
        clearSelection();
    }, [clearSelection]);

    const admit = useCallback(
        async (participants: Participant[]) => {
            if (participants.length === 0) {
                return;
            }

            const ids = participants.map((participant) => participant.id);
            const idSet = new Set(ids);
            setSaving(true);
            setDivisionParticipants((current) => [...current, ...participants.filter((participant) => !current.some((entry) => entry.id === participant.id))]);
            setAvailableParticipants((current) => current.filter((entry) => !idSet.has(entry.id)));

            try {
                await addParticipantsToDivision(division.id, ids);
                await loadAvailableParticipants();
            } catch (error) {
                setDivisionParticipants((current) => current.filter((entry) => !idSet.has(entry.id)));
                setAvailableParticipants((current) => [...current, ...participants]);
                /* Admitting somebody is done without a dialog, so the failure has no dialog to appear in either. */
                report(apiErrorMessage(error, 'They could not be added to the division.'));
                throw error;
            } finally {
                setSaving(false);
            }
        },
        [division.id, loadAvailableParticipants, report],
    );

    const withdraw = useCallback(
        async (participants: Participant[]) => {
            if (participants.length === 0) {
                return;
            }

            const ids = participants.map((participant) => participant.id);
            const idSet = new Set(ids);
            setSaving(true);
            setDivisionParticipants((current) => current.filter((entry) => !idSet.has(entry.id)));
            setAvailableParticipants((current) => [...current, ...participants.filter((participant) => !current.some((entry) => entry.id === participant.id))]);

            try {
                await removeParticipantsFromDivision(division.id, ids);
                await loadAvailableParticipants();
            } catch (error) {
                setDivisionParticipants((current) => [...current, ...participants]);
                setAvailableParticipants((current) => current.filter((entry) => !idSet.has(entry.id)));
                throw error;
            } finally {
                setSaving(false);
            }
        },
        [division.id, loadAvailableParticipants],
    );

    /* Adding is done the moment it is asked for; withdrawing goes through the dialog, one dialog for the whole list. */
    const askToRemove = useCallback((participants: Participant[]) => setPendingRemoval(participants), []);
    const cancelRemoval = useCallback(() => setPendingRemoval([]), []);
    const confirmRemoval = useCallback(
        async () => {
            await withdraw(pendingRemoval);
            setPendingRemoval([]);
            clearSelection();
        },
        [clearSelection, pendingRemoval, withdraw],
    );

    const select = useCallback(
        (participant: Participant, extend: boolean) => {
            setSelecting(true);
            setSelectedIds((current) => {
                const next = new Set(current);
                if (extend && anchorId !== null) {
                    const from = visibleParticipants.findIndex((candidate) => candidate.id === anchorId);
                    const to = visibleParticipants.findIndex((candidate) => candidate.id === participant.id);
                    if (from !== -1 && to !== -1) {
                        const range = visibleParticipants.slice(Math.min(from, to), Math.max(from, to) + 1);
                        range.forEach((entry) => next.add(entry.id));

                        return next;
                    }
                }

                if (next.has(participant.id)) {
                    next.delete(participant.id);
                } else {
                    next.add(participant.id);
                }

                return next;
            });
            setAnchorId(participant.id);
        },
        [anchorId, visibleParticipants],
    );

    const toggleAllVisible = useCallback(() => {
        setSelectedIds((current) => {
            const next = new Set(current);
            const all = visibleParticipants.every((participant) => next.has(participant.id));
            visibleParticipants.forEach((participant) => (all ? next.delete(participant.id) : next.add(participant.id)));

            return next;
        });
        setAnchorId(null);
    }, [visibleParticipants]);

    /**
     * What a click on a row does.
     *
     * Outside a selection it is the change itself, which is what makes admitting
     * one person one gesture. Shift enters a selection instead, so a run of
     * names is picked without reaching for the toolbar first.
     */
    const activate = useCallback(
        (participant: Participant, extend: boolean) => {
            if (selecting || extend) {
                select(participant, extend);

                return;
            }

            setAnchorId(participant.id);
            if (divisionParticipantIds.has(participant.id)) {
                askToRemove([participant]);

                return;
            }

            admit([participant]).catch(() => {});
        },
        [admit, askToRemove, divisionParticipantIds, select, selecting],
    );

    /* A search that leaves one name answers to Enter, which is how a list of names on paper is typed in. */
    const activateOnlyMatch = useCallback(() => {
        if (selecting || lowerSearch === '' || visibleParticipants.length !== 1) {
            return;
        }

        activate(visibleParticipants[0], false);
        setSearch('');
    }, [activate, lowerSearch, selecting, visibleParticipants]);

    const addSelected = useCallback(
        async () => {
            await admit(selectedToAdd);
            clearSelection();
        },
        [admit, clearSelection, selectedToAdd],
    );

    return {
        search,
        order,
        filter,
        counts,
        summary,
        visibleParticipants,
        divisionParticipantIds,
        selecting,
        selectedIds,
        selectedToAdd,
        selectedToRemove,
        allVisibleSelected,
        pendingRemoval,
        saving,
        setSearch,
        setOrder,
        setFilter,
        startSelecting: () => setSelecting(true),
        stopSelecting,
        toggleAllVisible,
        activate,
        activateOnlyMatch,
        addSelected,
        askToRemove,
        cancelRemoval,
        confirmRemoval,
    };
}
