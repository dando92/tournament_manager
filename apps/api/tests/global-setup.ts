// TypeORM issues several queries concurrently on the client held by a
// transaction, which pg has deprecated since 8.19.0. The warning is harmless
// today and is tracked as debt in .ai/QueryAndSchemaOptimization.md; drop only
// this message so the suite prints test results and nothing else.
//
// The filter belongs here rather than in a setup file: Jest hands each test
// sandbox a copy of `process`, while `util.deprecate` emits on the real one,
// which only the global setup shares. The suite runs in band (`maxWorkers: 1`),
// so no worker process escapes the patch.
const PG_CONCURRENT_QUERY_WARNING = "Calling client.query() when the client is already executing a query is deprecated";

export default async function suppressKnownWarnings(): Promise<void> {
    const emitWarning = process.emitWarning.bind(process) as (...args: unknown[]) => void;

    process.emitWarning = ((warning: string | Error, ...rest: unknown[]): void => {
        const message = typeof warning === "string" ? warning : warning.message;
        if (message.startsWith(PG_CONCURRENT_QUERY_WARNING)) {
            return;
        }
        emitWarning(warning, ...rest);
    }) as typeof process.emitWarning;
}
