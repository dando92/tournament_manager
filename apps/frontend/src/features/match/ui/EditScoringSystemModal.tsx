import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import OkModal from "@/shared/components/ui/OkModal";
import Select from "@/shared/components/ui/Select";
import { listScoringSystems } from "@/features/match/api/match.api";
import { matchKeys } from "@/features/match/api/match.keys";
import { scoringSystemLabel } from "@/features/match/model/scoringSystem";
import type { Match } from "@/features/match/model/types";

type Props = {
    open: boolean;
    match: Match;
    onClose: () => void;
    onSave: (matchId: number, scoringSystem: string) => Promise<void>;
};

export default function EditScoringSystemModal({ open, match, onClose, onSave }: Props) {
    const [scoringSystem, setScoringSystem] = useState<string>(match.scoringSystem);
    const [saving, setSaving] = useState(false);
    const systemsQuery = useQuery({
        queryKey: matchKeys.scoringSystems(),
        queryFn: listScoringSystems,
        enabled: open,
    });

    useEffect(() => {
        if (open) {
            setScoringSystem(match.scoringSystem);
        }
    }, [match.scoringSystem, open]);

    const hasPlayedScores = match.rounds.some((round) => round.song !== null && round.standings.length > 0);

    async function save() {
        if (saving || scoringSystem === match.scoringSystem) {
            return;
        }
        setSaving(true);
        try {
            await onSave(match.id, scoringSystem);
            onClose();
        } finally {
            setSaving(false);
        }
    }

    return (
        <OkModal
            title={`Edit scoring for ${match.name}`}
            okText={saving ? "Saving..." : "Save"}
            okDisabled={saving || systemsQuery.isLoading || !scoringSystem || scoringSystem === match.scoringSystem}
            onClose={onClose}
            onOk={() => void save()}
            open={open}
        >
            <label className="flex flex-col gap-2 font-medium text-ui-text-soft">
                Scoring system
                <Select
                    value={scoringSystem}
                    onChange={(event) => setScoringSystem(event.target.value)}
                    disabled={saving || systemsQuery.isLoading}
                >
                    {(systemsQuery.data ?? [match.scoringSystem]).map((system) => (
                        <option key={system} value={system}>
                            {scoringSystemLabel(system)}
                        </option>
                    ))}
                </Select>
            </label>
            {hasPlayedScores && <p className="mt-3 text-xs text-state-pending">Saving will recalculate the points of every completed song round.</p>}
            {systemsQuery.isError && <p className="mt-3 text-xs text-state-error">Unable to load scoring systems.</p>}
        </OkModal>
    );
}
