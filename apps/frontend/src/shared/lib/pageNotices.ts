/**
 * The rules a list of page notices follows.
 *
 * The sentence is the identity: the same failure reported again counts up
 * rather than stacking a second copy of itself, and the operation that raised
 * it takes it back by that same sentence when it later succeeds. The newest is
 * first, and beyond three the oldest drops — a failing network must not be
 * able to push the page off the screen.
 */

export type PageNoticeTone = 'failure' | 'warning';

export type PageNotice = {
    tone: PageNoticeTone;
    message: string;
    detail?: string;
    /** Repeats the operation that failed, for the failures worth offering twice. */
    retry?: () => void;
    count: number;
};

export const MAX_PAGE_NOTICES = 3;

export function withNotice(current: PageNotice[], reported: Omit<PageNotice, 'count'>): PageNotice[] {
    if (current.some((notice) => notice.message === reported.message)) {
        return current.map((notice) => (notice.message === reported.message ? { ...notice, count: notice.count + 1 } : notice));
    }

    return [{ ...reported, count: 1 }, ...current].slice(0, MAX_PAGE_NOTICES);
}

export function withoutNotice(current: PageNotice[], message: string): PageNotice[] {
    return current.filter((notice) => notice.message !== message);
}
