import type { NextFunction, Request, RequestHandler, Response } from 'express';

import { newRequestMetrics, withRequestMetrics } from './request-metrics.store';

/**
 * One line per request, on stdout, as NDJSON:
 *
 *     {"metric":"request","method":"GET","route":"/tournaments/:id/schedules",
 *      "status":200,"ms":412,"queries":37,"databaseMs":390,"rows":8400}
 *
 * `queries` is what a load run is looking for. A route that issues thirty of
 * them to draw one page reads the same on a stopwatch as a route that issues
 * three, until the dataset grows; the count says so on the first request.
 *
 * It is bound in `main.ts` with `app.use` and no path, rather than through
 * `MiddlewareConsumer`, for two reasons: a scope opened here covers the guards
 * too, and authentication reads the database; and a path-less `app.use` needs
 * no wildcard pattern, which is the part of Express 5 that changed under Nest.
 */
export function requestTimingHandler(): RequestHandler {
    return (request: Request, response: Response, next: NextFunction) => {
        const metrics = newRequestMetrics();
        const startedAt = process.hrtime.bigint();

        response.on('finish', () => {
            const elapsedMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
            process.stdout.write(
                `${JSON.stringify({
                    metric: 'request',
                    method: request.method,
                    route: routeOf(request),
                    status: response.statusCode,
                    ms: Number(elapsedMs.toFixed(1)),
                    queries: metrics.queries,
                    databaseMs: Number(metrics.databaseMs.toFixed(1)),
                    rows: metrics.rows,
                })}\n`,
            );
        });

        withRequestMetrics(metrics, () => next());
    };
}

/**
 * The route pattern, so requests aggregate by endpoint instead of by id.
 *
 * A request that matched no route has no pattern, and its own path is the best
 * label available; those are the 404s, and they aggregate badly on purpose.
 */
function routeOf(request: Request): string {
    return `${request.baseUrl ?? ''}${request.route?.path ?? request.path}`;
}
