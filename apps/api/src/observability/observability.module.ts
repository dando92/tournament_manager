import { Module } from '@nestjs/common';

import { QueryMetricsSubscriber } from './query-metrics.subscriber';

/**
 * Per-request timing and query counting, for a measured run.
 *
 * The whole thing is inert unless `REQUEST_TIMING_ENABLED` is exactly "true":
 * the timing handler is not bound in `main.ts` and the subscriber never
 * registers itself with the data source, so a deployment that was never asked
 * to measure pays nothing and prints nothing. It is the rule the local fixture
 * seed follows, for the same reason — a variable left set somewhere must not
 * change what a deployed service does silently.
 *
 * What it costs when it is on: one `AsyncLocalStorage` scope per request and
 * three additions per query. The load it measures is not the load it adds.
 */
@Module({
    providers: [QueryMetricsSubscriber],
})
export class ObservabilityModule {}
