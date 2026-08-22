import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { AdminAccount } from "@/features/player/types/Account";
import { listAccounts, updateAccountFlags } from "@/features/auth/api/account.api";

type AccountFlag = "isAdmin" | "isTournamentCreator";

/** Every account and the two flags an administrator may set on it. */
export function useManageRolesPage() {
  const [accounts, setAccounts] = useState<AdminAccount[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listAccounts()
      .then(setAccounts)
      .catch(() => toast.error("Failed to load accounts."))
      .finally(() => setLoading(false));
  }, []);

  async function changeFlag(accountId: string, flag: AccountFlag, value: boolean) {
    try {
      const updated = await updateAccountFlags(accountId, { [flag]: value });
      setAccounts((current) => current.map((account) => (account.id === accountId ? updated : account)));
      toast.success("Updated.");
    } catch {
      toast.error("Failed to update.");
    }
  }

  return { accounts, loading, changeFlag };
}
