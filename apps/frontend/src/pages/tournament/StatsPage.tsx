import { useTournamentPageContext } from '@/features/tournament/model/TournamentPageContext';
import { useTournamentStats } from '@/features/stats/model/useTournamentStats';
import DifficultyScatter from '@/features/stats/ui/DifficultyScatter';
import PlacementsTable from '@/features/stats/ui/PlacementsTable';
import PlayerStatsTable from '@/features/stats/ui/PlayerStatsTable';
import SongStatsTable from '@/features/stats/ui/SongStatsTable';
import StatsSection from '@/features/stats/ui/StatsSection';

/**
 * The tournament's numbers, read once it has happened.
 *
 * FQ-016 held this page empty until somebody had asked a question, and these are
 * the three that were asked: where everybody finished, what each player did, and
 * how the pool of songs actually played. Nothing here is live — the answers are
 * for competitors and organisers after the event, which is also why no read on
 * this page subscribes to updates.
 */
export default function StatsPage() {
    const { tournamentId } = useTournamentPageContext();
    const { placements, players, songs } = useTournamentStats(tournamentId);

    return (
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 py-2">
            <StatsSection
                title="Final placements"
                description="Read back off the advancement rules. Entrants the tournament never separated share a place."
                loading={placements.isLoading}
                error={placements.isError}
                empty={placements.data?.length === 0}
            >
                <div className="flex flex-col gap-6">
                    {(placements.data ?? []).map((division) => (
                        <div key={division.divisionId} className="flex flex-col gap-2">
                            <h3 className="text-xs font-semibold uppercase tracking-wide text-ui-text-mute">{division.divisionName}</h3>
                            <PlacementsTable division={division} />
                        </div>
                    ))}
                </div>
            </StatsSection>

            <StatsSection
                title="Players"
                description="Every run recorded in this tournament, by the person who played it."
                loading={players.isLoading}
                error={players.isError}
                empty={players.data?.length === 0}
            >
                <PlayerStatsTable rows={players.data ?? []} />
            </StatsSection>

            <StatsSection
                title="Songs"
                description="What the pool was worth: the difficulty each song declares against how the field actually scored on it."
                loading={songs.isLoading}
                error={songs.isError}
                empty={songs.data?.length === 0}
            >
                <div className="flex flex-col gap-4">
                    <DifficultyScatter rows={songs.data ?? []} />
                    <SongStatsTable rows={songs.data ?? []} />
                </div>
            </StatsSection>
        </div>
    );
}
