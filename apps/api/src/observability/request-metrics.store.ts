import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * What one request cost, accumulated while it is being served.
 *
 * The count is the number that matters. A route that issues thirty queries to
 * draw one page is the shape this repository keeps removing, and it is
 * invisible in a wall-clock timing: every one of those queries can be fast.
 */
export type RequestMetrics = {
    queries: number;
    databaseMs: number;
    rows: number;
};

/*
 * The store is a module-level singleton rather than an injectable, because the
 * subscriber that writes it is constructed once by the data source and the
 * middleware that opens it runs before Nest has resolved anything. Neither can
 * reach the other through the container.
 */
const storage = new AsyncLocalStorage<RequestMetrics>();

export function newRequestMetrics(): RequestMetrics {
    return { queries: 0, databaseMs: 0, rows: 0 };
}

/** Runs the request inside a scope every query it issues can find. */
export function withRequestMetrics<T>(metrics: RequestMetrics, run: () => T): T {
    return storage.run(metrics, run);
}

/** The metrics of the request being served, or nothing outside one. */
export function currentRequestMetrics(): RequestMetrics | undefined {
    return storage.getStore();
}
