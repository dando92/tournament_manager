import { Injectable } from '@nestjs/common';
import { DataSource, EntitySubscriberInterface, EventSubscriber } from 'typeorm';
import type { AfterQueryEvent } from 'typeorm';

import { currentRequestMetrics } from './request-metrics.store';
import { requestTimingEnabled } from './request-timing.settings';

/**
 * Attributes every statement to the request that issued it.
 *
 * TypeORM broadcasts `afterQuery` for every query a query runner executes,
 * with the time it took and its raw result, so a count, a duration and a row
 * total are available without wrapping a repository or overriding the logger —
 * which would displace the slow-query threshold `app.module.ts` already sets.
 *
 * Queries issued outside a request — the schedule reconciliation at startup,
 * a live-message handler — find no scope and are counted by nobody, which is
 * correct: they belong to no request.
 */
@Injectable()
@EventSubscriber()
export class QueryMetricsSubscriber implements EntitySubscriberInterface {
    constructor(dataSource: DataSource) {
        /* Registering costs every query a broadcast, so an unmeasured process
           never registers at all. */
        if (!requestTimingEnabled()) {
            return;
        }
        dataSource.subscribers.push(this);
    }

    afterQuery(event: AfterQueryEvent<unknown>): void {
        const metrics = currentRequestMetrics();
        if (!metrics) {
            return;
        }

        metrics.queries += 1;
        metrics.databaseMs += event.executionTime ?? 0;
        metrics.rows += rowsOf(event.rawResults);
    }
}

/**
 * How many rows came back. A `SELECT` answers with an array, a write answers
 * with a driver result object, and a statement that returns neither counts as
 * nothing rather than as a failure to measure.
 */
function rowsOf(rawResults: unknown): number {
    if (Array.isArray(rawResults)) {
        return rawResults.length;
    }
    if (rawResults && typeof rawResults === 'object' && Array.isArray((rawResults as { rows?: unknown[] }).rows)) {
        return (rawResults as { rows: unknown[] }).rows.length;
    }

    return 0;
}
