import type { ReactNode } from 'react';

/**
 * One question the page answers, with its own heading and its own emptiness.
 *
 * A section that failed says so where it sits rather than replacing the page:
 * three reads answer three questions, and two of them being available is worth
 * more than a single error message.
 */
export default function StatsSection({
    title,
    description,
    loading,
    error,
    empty,
    emptyMessage = 'Nothing recorded yet.',
    children,
}: {
    title: string;
    description?: string;
    loading?: boolean;
    error?: boolean;
    empty?: boolean;
    emptyMessage?: string;
    children: ReactNode;
}) {
    return (
        <section className="flex flex-col gap-3">
            <div className="flex flex-col gap-0.5">
                <h2 className="text-sm font-semibold text-ui-text">{title}</h2>
                {description ? <p className="text-xs text-ui-text-mute">{description}</p> : null}
            </div>
            {loading ? <p className="text-sm text-ui-text-mute">Loading…</p> : null}
            {!loading && error ? <p className="text-sm text-state-failed">This could not be read.</p> : null}
            {!loading && !error && empty ? <p className="text-sm italic text-ui-text-mute">{emptyMessage}</p> : null}
            {!loading && !error && !empty ? children : null}
        </section>
    );
}
