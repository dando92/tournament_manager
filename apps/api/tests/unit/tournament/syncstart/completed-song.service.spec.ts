import { CompletedSongRequest } from '@tournament-manager/contracts';

import { MatchCommands } from '@match/match.commands';
import { MatchQueries } from '@match/match.queries';
import { UiUpdatePublisher } from '@tournament/shared/ui-update.publisher';
import { SongQueries } from '@tournament/catalog/song.queries';
import { ScoreStore } from '@tournament/competition/score.store';
import { ParticipantQueries } from '@tournament/registration/participants.queries';
import { CompletedSongService } from '@tournament/syncstart/completed-song.service';

/**
 * What the ingestion makes of what a lobby reports.
 *
 * The writes it produces belong to the match and to the score catalogue and are
 * exercised against a database elsewhere. What is decided here is which of them
 * happen: who each name is, whether a run reaches a round, and what is said
 * about a run that reaches nobody.
 */
describe('CompletedSongService', () => {
    const idByTitle = jest.fn();
    const playerIdsByNames = jest.fn();
    const liveTargetsForSong = jest.fn();
    const applyCompletedSong = jest.fn();
    const record = jest.fn();
    const emitWarning = jest.fn();

    const service = () => new CompletedSongService(
        { idByTitle } as unknown as SongQueries,
        { playerIdsByNames } as unknown as ParticipantQueries,
        { liveTargetsForSong } as unknown as MatchQueries,
        { applyCompletedSong } as unknown as MatchCommands,
        { record } as unknown as ScoreStore,
        { emitWarning } as unknown as UiUpdatePublisher,
    );

    const request = (scores: CompletedSongRequest['scores']): CompletedSongRequest => ({
        completionId: 'completion-1',
        tournamentId: 7,
        lobbyId: 'lobby-1',
        lobbyName: 'Lobby',
        lobbyCode: 'ABCD',
        song: { songPath: 'Songs/Anthem', title: 'Anthem', artist: 'Someone', songLength: 120 },
        scores,
    });

    const played = { playerId: 'p1', playerName: 'Ann', score: 990000, exScore: 98.5, isFailed: false };

    beforeEach(() => {
        [idByTitle, playerIdsByNames, liveTargetsForSong, applyCompletedSong, record, emitWarning]
            .forEach((mock) => mock.mockReset());
        idByTitle.mockResolvedValue(11);
        playerIdsByNames.mockResolvedValue(new Map([['ann', 21]]));
        liveTargetsForSong.mockResolvedValue([]);
        record.mockImplementation((runs: unknown[]) => Promise.resolve(runs.map((_, index) => ({ id: 100 + index }))));
        emitWarning.mockResolvedValue(undefined);
        applyCompletedSong.mockResolvedValue(undefined);
    });

    it('writes each match once, with every run of the lobby that was waiting in it', async () => {
        playerIdsByNames.mockResolvedValue(new Map([['ann', 21], ['bob', 22]]));
        liveTargetsForSong.mockResolvedValue([
            { matchId: 5, roundId: 51, playerId: 21 },
            { matchId: 5, roundId: 51, playerId: 22 },
        ]);

        await service().submit(request([played, { ...played, playerId: 'p2', playerName: 'Bob', exScore: 97 }]));

        expect(liveTargetsForSong).toHaveBeenCalledTimes(1);
        expect(liveTargetsForSong).toHaveBeenCalledWith(7, 11, [21, 22]);
        expect(applyCompletedSong).toHaveBeenCalledTimes(1);
        expect(applyCompletedSong).toHaveBeenCalledWith(5, [
            { roundId: 51, playerId: 21, scoreId: 100 },
            { roundId: 51, playerId: 22, scoreId: 101 },
        ]);
    });

    it('records a run no round was waiting for, and tells no match about it', async () => {
        await service().submit(request([played]));

        expect(record).toHaveBeenCalledWith([{ playerId: 21, songId: 11, percentage: 98.5, isFailed: false }]);
        expect(applyCompletedSong).not.toHaveBeenCalled();
    });

    it('matches a lobby player name without case sensitivity', async () => {
        await service().submit(request([{ ...played, playerName: 'ANN' }]));

        expect(playerIdsByNames).toHaveBeenCalledWith(7, ['ANN']);
        expect(record).toHaveBeenCalledWith([{ playerId: 21, songId: 11, percentage: 98.5, isFailed: false }]);
    });

    it('warns instead of saving when the cabinet reported no EX score', async () => {
        await service().submit(request([{ ...played, exScore: undefined }]));

        expect(emitWarning).toHaveBeenCalledWith(7, expect.stringContaining('No EX score found for Ann'));
        expect(record).toHaveBeenCalledWith([]);
    });

    it('warns for a name the tournament does not know', async () => {
        playerIdsByNames.mockResolvedValue(new Map());

        await service().submit(request([played]));

        expect(emitWarning).toHaveBeenCalledWith(7, expect.stringContaining('No database player-song found for Ann'));
        expect(record).toHaveBeenCalledWith([]);
    });

    it('warns for every score when the song is not in the pool, and asks for no names', async () => {
        idByTitle.mockResolvedValue(null);

        await service().submit(request([played, { ...played, playerName: 'Bob' }]));

        expect(emitWarning).toHaveBeenCalledTimes(2);
        expect(playerIdsByNames).not.toHaveBeenCalled();
    });

    it('scores a completion once, however often SyncStart resends it', async () => {
        const ingestion = service();

        await ingestion.submit(request([played]));
        await ingestion.submit(request([played]));

        expect(record).toHaveBeenCalledTimes(1);
    });
});
