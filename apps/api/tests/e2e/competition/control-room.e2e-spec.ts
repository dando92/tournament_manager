import { INestApplication } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import * as request from "supertest";
import { Repository } from "typeorm";

import { AppModule } from "../../../src/app.module";
import { Account } from "@tournament-manager/persistence";
import { LIVE_EVENT_PUBLISHER } from "@tournament-manager/live-messaging";
import { TournamentSyncStartService } from "../../../src/tournament/syncstart/tournament-syncstart.service";
import { dropTestDatabase, getTestDatabaseName, resetMigratedTestDatabase } from "../../support/postgres-test-database";

const database = getTestDatabaseName("control_room");
process.env.DATABASE_NAME = database;

type MatchBody = {
    id: number;
    active: boolean;
    matchResult: unknown | null;
    rounds: Array<{ id: number }>;
    entrants: Array<{ participants: Array<{ player: { id: number } }> }>;
};

describe("Control Room (e2e)", () => {
    let app: INestApplication;
    let accessToken: string;
    let tournamentId: number;
    let divisionId: number;
    let poolId: number;
    let songId: number;
    const entrants: number[] = [];

    beforeAll(async () => {
        const migrations = await resetMigratedTestDatabase(database);
        await migrations.destroy();

        const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] })
            .overrideProvider(LIVE_EVENT_PUBLISHER)
            .useValue({ publish: () => Promise.resolve() })
            .overrideProvider(TournamentSyncStartService)
            .useValue({ configureTournament: jest.fn(), closeTournament: jest.fn() })
            .compile();
        app = moduleFixture.createNestApplication();
        await app.init();

        const accounts = moduleFixture.get<Repository<Account>>(getRepositoryToken(Account));
        const credentials = {
            username: "control-room-owner",
            email: "control-room@example.test",
            password: "ControlRoomPassword!",
            playerName: "Control Room Owner",
        };
        await request(app.getHttpServer()).post("/user").send(credentials).expect(201);
        const account = await accounts.findOneByOrFail({ username: credentials.username });
        account.isTournamentCreator = true;
        await accounts.save(account);
        const login = await request(app.getHttpServer())
            .post("/auth/login")
            .send({ username: credentials.username, password: credentials.password })
            .expect(201);
        accessToken = login.body.access_token;

        const tournament = await request(app.getHttpServer())
            .post("/tournaments")
            .set("Authorization", `Bearer ${accessToken}`)
            .send({ name: "Control Room Tournament" })
            .expect(201);
        tournamentId = tournament.body.id;
        const division = await request(app.getHttpServer()).post("/divisions").send({ name: "Main", tournamentId }).expect(201);
        divisionId = division.body.id;
        for (const name of ["Alpha", "Bravo", "Charlie", "Delta"]) {
            entrants.push(await addEntrant(name));
        }
        const phase = await request(app.getHttpServer()).post("/phases").send({ name: "Phase", divisionId }).expect(201);
        const pool = await request(app.getHttpServer()).post(`/phases/${phase.body.id}/phase-groups`).send({ name: "Pool" }).expect(201);
        poolId = pool.body.id;
        const song = await request(app.getHttpServer())
            .post("/songs")
            .send({
                title: "Control Song",
                artist: "Test",
                group: "Test",
                difficulty: 9,
                tournamentId,
            })
            .expect(201);
        songId = song.body.id;
    });

    afterAll(async () => {
        await app.close();
        await dropTestDatabase(database);
    });

    async function addEntrant(playerName: string): Promise<number> {
        const participant = await request(app.getHttpServer())
            .post(`/tournaments/${tournamentId}/participants`)
            .set("Authorization", `Bearer ${accessToken}`)
            .send({ playerName })
            .expect(201);
        const entrant = await request(app.getHttpServer()).post(`/divisions/${divisionId}/participants/${participant.body.id}`).expect(201);

        return entrant.body.id;
    }

    async function createMatch(name: string, entrantIds: number[]): Promise<MatchBody> {
        const created = await request(app.getHttpServer())
            .post("/matches")
            .send({
                name,
                phaseGroupId: poolId,
                scoringSystem: "PlacementPointsWithFailZero",
                entrantIds,
                songIds: [songId],
            })
            .expect(201);

        return readMatch(created.body.id);
    }

    async function readMatch(matchId: number): Promise<MatchBody> {
        return (await request(app.getHttpServer()).get(`/matches/${matchId}`).expect(200)).body;
    }

    async function createFlow(name: string, matchIds: number[]): Promise<number> {
        const created = await request(app.getHttpServer()).post(`/tournaments/${tournamentId}/control-room/flows`).send({ name }).expect(201);
        const flow = await request(app.getHttpServer()).get(`/control-room/flows/${created.body.id}`).expect(200);
        await request(app.getHttpServer()).put(`/control-room/flows/${created.body.id}/entries`).send({ version: flow.body.version, matchIds }).expect(204);

        return created.body.id;
    }

    async function score(match: MatchBody): Promise<void> {
        const current = await readMatch(match.id);
        const playerIds = current.entrants.map((entrant) => entrant.participants[0].player.id);
        for (const [index, playerId] of playerIds.entries()) {
            await request(app.getHttpServer())
                .put(`/rounds/${current.rounds[0].id}/scores/${playerId}`)
                .send({ percentage: 99 - index, isFailed: false })
                .expect(204);
        }
    }

    it("advances without committing and blocks manual activation", async () => {
        const first = await createMatch("First", entrants.slice(0, 2));
        const second = await createMatch("Second", entrants.slice(0, 2));
        const flowId = await createFlow("Cabinet 1", [first.id, second.id]);

        await request(app.getHttpServer()).post(`/control-room/flows/${flowId}/start`).expect(204);
        expect((await readMatch(first.id)).active).toBe(true);
        await request(app.getHttpServer()).put(`/matches/${second.id}/active`).send({ active: true }).expect(409);

        await score(first);
        const flow = await request(app.getHttpServer()).get(`/control-room/flows/${flowId}`).expect(200);
        expect(flow.body.status).toBe("running");
        expect(flow.body.currentEntryId).toBe(flow.body.entries[1].id);
        expect(await readMatch(first.id)).toMatchObject({ active: false, matchResult: null });
        expect((await readMatch(second.id)).active).toBe(true);
    });

    it("keeps a stale flow running and resumes when an entrant resolves it", async () => {
        const waiting = await createMatch("Waiting", [entrants[2]]);
        const flowId = await createFlow("Cabinet 2", [waiting.id]);
        await request(app.getHttpServer()).post(`/control-room/flows/${flowId}/start`).expect(204);

        let flow = await request(app.getHttpServer()).get(`/control-room/flows/${flowId}`).expect(200);
        expect(flow.body).toMatchObject({ status: "running", staleCode: "NOT_ENOUGH_ENTRANTS" });
        expect((await readMatch(waiting.id)).active).toBe(false);

        await request(app.getHttpServer())
            .patch(`/matches/${waiting.id}`)
            .send({ entrantIds: [entrants[2], entrants[3]] })
            .expect(204);
        flow = await request(app.getHttpServer()).get(`/control-room/flows/${flowId}`).expect(200);
        expect(flow.body).toMatchObject({ status: "running", staleCode: null });
        expect((await readMatch(waiting.id)).active).toBe(true);

        await request(app.getHttpServer()).post(`/control-room/flows/${flowId}/pause`).expect(204);
        await score(waiting);
        expect((await request(app.getHttpServer()).get(`/control-room/flows/${flowId}`).expect(200)).body.status).toBe("paused");
        expect((await readMatch(waiting.id)).active).toBe(true);

        await request(app.getHttpServer()).post(`/control-room/flows/${flowId}/resume`).expect(204);
        flow = await request(app.getHttpServer()).get(`/control-room/flows/${flowId}`).expect(200);
        expect(flow.body.status).toBe("completed");
        expect(await readMatch(waiting.id)).toMatchObject({ active: false, matchResult: null });

        await request(app.getHttpServer()).post(`/control-room/flows/${flowId}/archive`).expect(204);
        expect((await request(app.getHttpServer()).get(`/control-room/flows/${flowId}`).expect(200)).body.archivedAt).not.toBeNull();
        await request(app.getHttpServer()).delete(`/control-room/flows/${flowId}/archive`).expect(204);
    });

    it("requires confirmation before a rollback stops a running flow", async () => {
        const match = await createMatch("Rollback", entrants.slice(2, 4));
        const flowId = await createFlow("Rollback flow", [match.id]);
        await request(app.getHttpServer()).post(`/control-room/flows/${flowId}/start`).expect(204);

        await request(app.getHttpServer()).delete(`/rounds/${match.rounds[0].id}`).expect(409);
        await request(app.getHttpServer()).delete(`/rounds/${match.rounds[0].id}`).set("x-confirm-control-room-stop", "true").expect(204);
        expect((await request(app.getHttpServer()).get(`/control-room/flows/${flowId}`).expect(200)).body.status).toBe("inactive");
        expect((await readMatch(match.id)).active).toBe(false);
    });
});
