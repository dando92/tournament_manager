import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faDice, faLock, faLockOpen, faRotateRight, faXmark } from '@fortawesome/free-solid-svg-icons';
import { chartDifficultyPresentation, meterColor } from '@/features/song/model/chartDifficultyPresentation';
import { displaySongTitle } from '@/features/song/model/songTitle';
import type { RollSlot, SongRollState } from '@/features/song/model/useSongRoll';
import Select from '@/shared/components/ui/Select';
import OverflowMarquee from '@/shared/components/ui/OverflowMarquee';
import { btnPrimary, focusRing } from '@/styles/buttonStyles';

type SongRollPanelProps = {
    roll: SongRollState;
    songGroups: string[];
};

/**
 * The draw, on the table.
 *
 * A roll used to be two fields and an act of faith: you named a pack and a
 * level, pressed confirm, and read afterwards what the tournament had decided
 * for you. Here the cards are dealt face up. Each one can be drawn again on its
 * own, or locked so the next roll of the whole set leaves it where it is, and
 * only what is still on the table when the dialog is confirmed becomes a round.
 *
 * The card is typographic rather than illustrated: what the pool holds about a
 * chart is its title, its artist, its meter and the slot it was written for, so
 * that is what a card says, in the badge language the song list already uses.
 */
export default function SongRollPanel({ roll, songGroups }: SongRollPanelProps) {
    /* Enter in the levels field rolls. The dialog around this panel confirms on
       Enter wherever it is pressed, and confirming a draw that has not happened
       yet is never what somebody finishing a level list meant. */
    const rollOnEnter = (event: ReactKeyboardEvent<HTMLInputElement>) => {
        if (event.key !== 'Enter' || !roll.canRoll) {
            return;
        }

        event.preventDefault();
        void roll.rollAll();
    };

    return (
        <div className="w-full">
            <div className="flex flex-wrap items-end gap-3 py-2">
                <label className="flex min-w-0 flex-1 flex-col gap-1 sm:flex-none">
                    <span className="text-xs font-semibold uppercase tracking-wider text-ui-text-mute">Pack</span>
                    <Select className="w-full sm:w-[240px]" value={roll.group} onChange={(event) => roll.setGroup(event.target.value)}>
                        <option value="">All packs</option>
                        {songGroups.map((group) => (
                            <option key={group} value={group}>{group}</option>
                        ))}
                    </Select>
                </label>

                <label className="flex min-w-0 flex-1 flex-col gap-1 sm:flex-none">
                    <span className="text-xs font-semibold uppercase tracking-wider text-ui-text-mute">Levels</span>
                    {/* `decimal` rather than `numeric`: a numeric keypad on a
                        phone offers digits and nothing else, so there was no way
                        to separate one level from the next. A decimal pad
                        carries the separator its locale uses, and the parser
                        takes whatever it is. */}
                    <input
                        value={roll.levelsText}
                        onChange={(event) => roll.setLevelsText(event.target.value)}
                        onKeyDown={rollOnEnter}
                        className={`w-full rounded border border-ui-border-strong bg-ui-surface px-3 py-2 text-sm text-ui-text sm:w-[220px] ${focusRing}`}
                        placeholder="9,9,10,10"
                        inputMode="decimal"
                    />
                </label>

                <button type="button" onClick={() => void roll.rollAll()} disabled={!roll.canRoll} className={`${btnPrimary} flex items-center gap-2`}>
                    <FontAwesomeIcon icon={faDice} />
                    {roll.slots.length > 0 ? 'Roll again' : 'Roll'}
                </button>
            </div>

            <div className="flex flex-wrap items-center gap-3 pb-2">
                {roll.levels.length > 0 && (
                    <p className="text-xs text-ui-text-mute">
                        {roll.levels.length} {roll.levels.length === 1 ? 'song' : 'songs'}: {roll.levels.join(' · ')}
                    </p>
                )}

                <label className="ml-auto flex items-center gap-2 text-sm text-ui-text-soft">
                    <input
                        type="checkbox"
                        checked={roll.allowPlayed}
                        onChange={(event) => roll.setAllowPlayed(event.target.checked)}
                    />
                    Allow songs already played in this division
                </label>
            </div>

            {roll.failure && <p className="py-1 text-sm text-state-failed">{roll.failure}</p>}

            {roll.slots.length === 0 ? (
                <p className="rounded border border-dashed border-ui-border-strong px-3 py-6 text-center text-sm text-ui-text-mute">
                    Type the levels to draw — <span className="font-semibold">9,9,10,10</span> draws four songs, and any
                    separator will do — then roll.
                </p>
            ) : (
                <ul className="flex flex-col gap-2">
                    {roll.slots.map((slot) => (
                        <SongRollCard
                            key={slot.key}
                            slot={slot}
                            busy={roll.rolling}
                            onReroll={() => void roll.rerollSlot(slot.key)}
                            onToggleLock={() => roll.toggleLock(slot.key)}
                            onRemove={() => roll.removeSlot(slot.key)}
                        />
                    ))}
                </ul>
            )}
        </div>
    );
}

/*
 * The card's own actions.
 *
 * They are not `btnSecondary` with a tighter padding: two conflicting Tailwind
 * paddings in one class list are settled by the order of the generated
 * stylesheet rather than by the order they are written in, so the small square
 * button states its own box, the way the trash button does.
 */
const CARD_ACTION = `inline-flex h-7 w-7 shrink-0 items-center justify-center rounded border border-ui-border text-ui-text-soft transition-colors hover:bg-ui-raised hover:text-ui-text disabled:opacity-40 ${focusRing}`;

type SongRollCardProps = {
    slot: RollSlot;
    busy: boolean;
    onReroll: () => void;
    onToggleLock: () => void;
    onRemove: () => void;
};

function SongRollCard({ slot, busy, onReroll, onToggleLock, onRemove }: SongRollCardProps) {
    const song = slot.song;
    const chart = song?.chartDifficulty ? chartDifficultyPresentation[song.chartDifficulty] : null;

    return (
        <li
            className={`flex items-center gap-3 rounded border px-3 py-2 transition-colors ${
                song ? 'border-ui-border bg-ui-surface' : 'border-dashed border-ui-border-strong bg-transparent'
            } ${slot.locked ? 'ring-1 ring-ui-accent' : ''}`}
        >
            {/* The meter is what a card is read by; the slot it was written for
                sits under it, small, because it is a detail of the same badge
                rather than a second column competing with the title. */}
            <span className="flex w-10 shrink-0 flex-col items-center gap-0.5">
                <span
                    className={`${chart ? chart.badge : meterColor(slot.level)} flex h-6 w-6 items-center justify-center rounded text-[11px] font-bold text-white`}
                    title={chart ? `${chart.label} ${slot.level}` : `Level ${slot.level}`}
                >
                    {slot.level}
                </span>

                {chart && (
                    <span className={`${chart.text} w-full truncate text-center text-[9px] font-semibold uppercase leading-none tracking-wide`}>
                        {chart.label}
                    </span>
                )}
            </span>

            {song ? (
                <span className="flex min-w-0 flex-1 flex-col">
                    <OverflowMarquee text={displaySongTitle(song.title)} className="text-sm text-ui-text" />
                    <span className="truncate text-xs text-ui-text-mute">{song.artist ? `${song.artist} · ${song.group}` : song.group}</span>
                </span>
            ) : (
                <span className="flex-1 text-sm text-ui-text-mute">Nothing of level {slot.level} left to draw.</span>
            )}

            <button
                type="button"
                onClick={onToggleLock}
                disabled={!song}
                title={slot.locked ? 'Unlock this card' : 'Keep this card through the next roll'}
                className={`${CARD_ACTION} ${slot.locked ? 'border-ui-accent text-ui-accent' : ''}`}
            >
                <FontAwesomeIcon icon={slot.locked ? faLock : faLockOpen} />
            </button>
            <button
                type="button"
                onClick={onReroll}
                disabled={busy || slot.locked}
                title="Draw another song for this level"
                className={CARD_ACTION}
            >
                <FontAwesomeIcon icon={faRotateRight} />
            </button>
            <button type="button" onClick={onRemove} title="Take this card out of the draw" className={CARD_ACTION}>
                <FontAwesomeIcon icon={faXmark} />
            </button>
        </li>
    );
}
