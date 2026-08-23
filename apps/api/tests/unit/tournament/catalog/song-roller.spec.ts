import { SongQueries } from '@tournament/catalog/song.queries';
import { SongRoller } from '@tournament/catalog/song-roller';

/**
 * What a roll picks, without a database.
 *
 * The rule the roller applies is now one query — the pool of the tournament
 * minus what the division has played — so what is left to test here is what it
 * does with the answer: one song per level asked for, nothing for a level with
 * no candidate, and never the same song twice in one match.
 */
describe('SongRoller', () => {
    const rollable = jest.fn();
    const queries = { rollable } as unknown as SongQueries;
    const roller = new SongRoller(queries);

    beforeEach(() => rollable.mockReset());

    it('asks the catalogue once however many levels are rolled', async () => {
        rollable.mockResolvedValue([
            { id: 1, difficulty: 5 },
            { id: 2, difficulty: 8 },
        ]);

        const picked = await roller.roll(7, 3, 'Pack A', '5,8');

        expect(picked).toEqual([1, 2]);
        expect(rollable).toHaveBeenCalledTimes(1);
        expect(rollable).toHaveBeenCalledWith(7, 3, 'Pack A');
    });

    it('leaves out a level nothing is available for', async () => {
        rollable.mockResolvedValue([{ id: 1, difficulty: 5 }]);

        expect(await roller.roll(7, 3, null, '5,9')).toEqual([1]);
    });

    it('never picks the same song for two levels of one match', async () => {
        rollable.mockResolvedValue([{ id: 1, difficulty: 5 }]);

        expect(await roller.roll(7, 3, null, '5,5')).toEqual([1]);
    });

    it('rolls nothing when no level is asked for', async () => {
        expect(await roller.roll(7, 3, null, '')).toEqual([]);
        expect(rollable).not.toHaveBeenCalled();
    });
});
