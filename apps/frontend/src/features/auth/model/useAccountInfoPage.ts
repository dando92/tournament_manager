import { useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";
import { useAuthContext } from "@/features/auth/context/AuthContext";
import { updateAccountProfile } from "@/features/auth/api/account.api";

/**
 * The signed-in account as its own page edits it.
 *
 * The picture is saved on its own the moment it is chosen, because there is no
 * useful draft state for an image: what you see after picking a file is already
 * what you are agreeing to. The three text fields are a draft with an explicit
 * save, and cancelling puts the account's values back.
 */
export function useAccountInfoPage() {
  const { state, actions } = useAuthContext();
  const { account } = state;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [editingProfile, setEditingProfile] = useState(false);
  const [playerName, setPlayerName] = useState(account?.player?.playerName ?? "");
  const [nationality, setNationality] = useState(account?.nationality ?? "");
  const [grooveStatsApi, setGrooveStatsApi] = useState(account?.grooveStatsApi ?? "");
  const [profilePicture, setProfilePicture] = useState(account?.profilePicture ?? "");
  const [saving, setSaving] = useState(false);
  const [savingPicture, setSavingPicture] = useState(false);

  useEffect(() => {
    if (editingProfile) return;
    setPlayerName(account?.player?.playerName ?? "");
    setNationality(account?.nationality ?? "");
    setGrooveStatsApi(account?.grooveStatsApi ?? "");
    setProfilePicture(account?.profilePicture ?? "");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account]);

  async function savePicture(base64: string) {
    if (!account) return;
    setSavingPicture(true);
    try {
      setProfilePicture(base64);
      await updateAccountProfile(account.id, { profilePicture: base64 });
      await actions.loadCurrentUser();
      toast.success("Profile picture updated.");
    } catch {
      toast.error("Failed to update profile picture.");
    } finally {
      setSavingPicture(false);
    }
  }

  async function saveProfile() {
    if (!account) return;
    setSaving(true);
    try {
      await updateAccountProfile(account.id, { playerName, nationality, grooveStatsApi });
      await actions.loadCurrentUser();
      toast.success("Profile updated.");
      setEditingProfile(false);
    } catch {
      toast.error("Failed to update profile.");
    } finally {
      setSaving(false);
    }
  }

  function cancelEdit() {
    setEditingProfile(false);
    setPlayerName(account?.player?.playerName ?? "");
    setNationality(account?.nationality ?? "");
    setGrooveStatsApi(account?.grooveStatsApi ?? "");
  }

  return {
    account,
    fileInputRef,
    editingProfile,
    playerName,
    nationality,
    grooveStatsApi,
    profilePicture,
    saving,
    savingPicture,
    setEditingProfile,
    setPlayerName,
    setNationality,
    setGrooveStatsApi,
    savePicture,
    saveProfile,
    cancelEdit,
  };
}
