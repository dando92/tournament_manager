import { useState } from "react";
import { toast } from "react-toastify";
import { listDivisionEntrants } from "@/features/division/api/division.api";
import {
    createItgmaniaProfilesArchive,
    itgmaniaArchiveFileName,
    playersForItgmaniaProfiles,
} from "@/features/participant/model/itgmaniaProfiles";

type Options = {
    tournamentName: string;
    divisionIds: number[];
};

export function useItgmaniaProfileExport({ tournamentName, divisionIds }: Options) {
    const [exporting, setExporting] = useState(false);

    const exportProfiles = async () => {
        setExporting(true);
        try {
            const entrants = (await Promise.all(divisionIds.map(listDivisionEntrants))).flat();
            const players = playersForItgmaniaProfiles(entrants);
            const archive = await createItgmaniaProfilesArchive(players);
            downloadArchive(archive, itgmaniaArchiveFileName(tournamentName));
            toast.success(`Exported ${players.length} ITGmania profile${players.length === 1 ? "" : "s"}.`);
        } catch {
            toast.error("Failed to export ITGmania profiles.");
        } finally {
            setExporting(false);
        }
    };

    return { exporting, exportProfiles };
}

function downloadArchive(archive: Blob, fileName: string): void {
    const url = URL.createObjectURL(archive);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
}
