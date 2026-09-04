import { useCallback, useEffect, useState } from 'react';
import { applyAccentColor, readAccentColor, writeAccentColor } from '@/shared/lib/accentColor';

/**
 * Reads and writes the device accent colour, applying it as it changes.
 *
 * Like the theme, the initial value is read rather than applied: index.html has
 * already put the custom properties on the document before the first paint, so
 * a chosen accent never flashes the default one while the bundle loads.
 */
export function useAccentColor(): [string, (next: string) => void] {
    const [accent, setAccent] = useState<string>(readAccentColor);

    const choose = useCallback((next: string) => {
        setAccent(next);
        writeAccentColor(next);
        applyAccentColor(next);
    }, []);

    // Another tab may change the accent; follow it so the two stay in step.
    useEffect(() => {
        function onStorage() {
            const stored = readAccentColor();
            setAccent(stored);
            applyAccentColor(stored);
        }
        window.addEventListener('storage', onStorage);
        return () => window.removeEventListener('storage', onStorage);
    }, []);

    return [accent, choose];
}
