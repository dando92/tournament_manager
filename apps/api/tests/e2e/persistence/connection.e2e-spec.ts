import { INestApplication } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { DataSource } from "typeorm";

import { AppModule } from "../../../src/app.module";
import { TournamentSyncStartService } from "../../../src/tournament/syncstart/tournament-syncstart.service";
import { dropTestDatabase, getTestDatabaseName, resetMigratedTestDatabase } from "../../support/postgres-test-database";

const database = getTestDatabaseName("connection");

/* The application reads its database from the environment, and `setup-env.ts`
   restores that name for every spec file, so claiming one here isolates this
   suite without reaching into another. */
process.env.DATABASE_NAME = database;

/**
 * What the API asks of every connection it opens.
 *
 * These are settings the driver forwards to PostgreSQL, so nothing in the
 * application fails when they are dropped: a query simply runs without a
 * timeout again, and an abandoned transaction holds its locks until the
 * process ends. The session is asked what it actually carries.
 */
describe("Database connection settings (e2e)", () => {
    let app: INestApplication;
    let dataSource: DataSource;

    beforeAll(async () => {
        const migrations = await resetMigratedTestDatabase(database);
        await migrations.destroy();

        const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] })
            .overrideProvider(TournamentSyncStartService)
            .useValue({
                configureTournament: jest.fn().mockResolvedValue(undefined),
                closeTournament: jest.fn().mockResolvedValue(undefined),
            })
            .compile();

        app = moduleFixture.createNestApplication();
        await app.init();
        dataSource = moduleFixture.get(DataSource);
    });

    afterAll(async () => {
        await app?.close();
        await dropTestDatabase(database);
    });

    it("bounds how long one statement and one open transaction may hold a connection", async () => {
        const [settings] = await dataSource.query(
            `SELECT current_setting('statement_timeout') AS "statementTimeout",
                    current_setting('idle_in_transaction_session_timeout') AS "idleTransactionTimeout",
                    current_setting('application_name') AS "applicationName"`,
        );

        expect(settings.statementTimeout).toBe("15s");
        expect(settings.idleTransactionTimeout).toBe("30s");
        expect(settings.applicationName).toBe("tournament-manager-api");
    });
});
