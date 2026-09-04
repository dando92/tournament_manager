import { ReactNode, createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { PageNotice, PageNoticeTone, withNotice, withoutNotice } from '@/shared/lib/pageNotices';

/**
 * What a page could not do.
 *
 * A write taken straight from a page — a score typed into a cell, a match
 * committed from its card, a connection opened from a toolbar — has no dialog
 * to hold the answer, so the failure is reported here and drawn in one slot at
 * the top of the content area. A page states what failed; it does not decide
 * where the sentence appears, the same way no dialog decides where its own
 * errors go.
 *
 * Nothing expires on a timer, which is the whole difference from a toast. A
 * notice leaves when it is closed, when the operation that raised it is tried
 * again and accepted, or when the route changes: a failure belongs to the page
 * it happened on.
 */

type ReportOptions = {
    detail?: string;
    tone?: PageNoticeTone;
    retry?: () => void;
};

type PageNoticeContextValue = {
    notices: PageNotice[];
    report: (message: string, options?: ReportOptions) => void;
    dismiss: (message: string) => void;
};

const PageNoticeContext = createContext<PageNoticeContextValue>({
    notices: [],
    report: () => {},
    dismiss: () => {},
});

export function PageNoticeProvider({ children }: { children: ReactNode }) {
    const { pathname } = useLocation();
    const [notices, setNotices] = useState<PageNotice[]>([]);

    useEffect(() => {
        setNotices((current) => (current.length === 0 ? current : []));
    }, [pathname]);

    const report = useCallback((message: string, options: ReportOptions = {}) => {
        setNotices((current) => withNotice(current, { tone: options.tone ?? 'failure', message, detail: options.detail, retry: options.retry }));
    }, []);

    const dismiss = useCallback((message: string) => {
        setNotices((current) => withoutNotice(current, message));
    }, []);

    const value = useMemo(() => ({ notices, report, dismiss }), [notices, report, dismiss]);

    return <PageNoticeContext.Provider value={value}>{children}</PageNoticeContext.Provider>;
}

export function usePageNotices() {
    return useContext(PageNoticeContext);
}
