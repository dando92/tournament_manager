/**
 * Whether this process is being measured.
 *
 * Read from the environment rather than from `ConfigService`, because the
 * subscriber below is constructed by the data source and the middleware is
 * bound before anything can be injected into either. `ConfigModule` has
 * already put the env file into `process.env` by the time either runs.
 */
export function requestTimingEnabled(): boolean {
    return process.env.REQUEST_TIMING_ENABLED === 'true';
}
