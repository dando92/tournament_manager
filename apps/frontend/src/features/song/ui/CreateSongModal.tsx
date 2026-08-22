import { useEffect, useState } from "react";
import BaseModal from "@/shared/components/ui/BaseModal";
import { btnPrimary } from "@/styles/buttonStyles";

type Props = {
  open: boolean;
  onClose: () => void;
  /** Pre-filled and locked — "add to existing group" mode. Omit for "new group" mode. */
  initialGroup?: string;
  existingGroups?: string[];
  onCreate: (title: string, difficulty: number, group: string, artist?: string) => void;
};

export default function CreateSongModal({
  open,
  onClose,
  initialGroup,
  existingGroups = [],
  onCreate,
}: Props) {
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [group, setGroup] = useState("");
  const [groupError, setGroupError] = useState<string | null>(null);

  const isNewGroup = initialGroup === undefined;

  useEffect(() => {
    if (open) {
      setTitle("");
      setArtist("");
      setDifficulty("");
      setGroup(initialGroup ?? "");
      setGroupError(null);
    }
  }, [open, initialGroup]);

  const handleClose = () => {
    onClose();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !difficulty.trim()) return;
    const diff = Number(difficulty);
    if (isNaN(diff) || diff < 1) return;
    const resolvedGroup = isNewGroup ? group.trim() : initialGroup!;
    if (!resolvedGroup) return;
    if (isNewGroup && existingGroups.includes(resolvedGroup)) {
      setGroupError("Group already exists.");
      return;
    }
    onCreate(title.trim(), diff, resolvedGroup, artist.trim() || undefined);
    onClose();
  };

  return (
    <BaseModal
      open={open}
      onClose={handleClose}
      title={isNewGroup ? "Add Song in New Group" : `Add Song to "${initialGroup}"`}
      maxWidth="max-w-sm"
      footer={
        <div className="flex justify-end gap-2">
          <button type="button" onClick={handleClose} className="px-3 py-1.5 text-sm text-ui-text-mute hover:underline">
            Cancel
          </button>
          <button type="submit" form="create-song-form" className={`text-sm ${btnPrimary}`}>
            Add Song
          </button>
        </div>
      }
    >
      <form id="create-song-form" onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div>
          <label className="block text-sm font-medium text-ui-text-soft mb-1">Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full border rounded px-3 py-1.5 text-sm"
            placeholder="Song title"
            autoFocus
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-ui-text-soft mb-1">Artist <span className="text-ui-text-mute font-normal">(optional)</span></label>
          <input
            type="text"
            value={artist}
            onChange={(e) => setArtist(e.target.value)}
            className="w-full border rounded px-3 py-1.5 text-sm"
            placeholder="Artist name"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-ui-text-soft mb-1">Difficulty</label>
          <input
            type="number"
            min={1}
            value={difficulty}
            onChange={(e) => setDifficulty(e.target.value)}
            className="w-full border rounded px-3 py-1.5 text-sm"
            placeholder="e.g. 8"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-ui-text-soft mb-1">Pack</label>
          <input
            type="text"
            value={group}
            onChange={(e) => { setGroup(e.target.value); setGroupError(null); }}
            className="w-full border rounded px-3 py-1.5 text-sm disabled:bg-ui-raised disabled:text-ui-text-mute"
            placeholder="e.g. Pack A"
            required
            disabled={!isNewGroup}
          />
          {!isNewGroup && (
            <p className="text-xs text-ui-text-mute mt-1">Pack is preselected for this action.</p>
          )}
          {groupError && <p className="text-state-failed text-xs mt-1">{groupError}</p>}
        </div>
      </form>
    </BaseModal>
  );
}
