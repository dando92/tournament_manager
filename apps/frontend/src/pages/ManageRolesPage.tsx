import { useEffect, useState } from "react";
import axios from "axios";
import { AdminAccount } from "@/features/player/types/Account";
import { toast } from "react-toastify";
import RoleAccountItem from "@/features/admin/components/RoleAccountItem";

export default function ManageRolesPage() {
  const [accounts, setAccounts] = useState<AdminAccount[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get<AdminAccount[]>("user").then((r) => {
      setAccounts(r.data);
    }).catch(() => {
      toast.error("Failed to load accounts.");
    }).finally(() => setLoading(false));
  }, []);

  async function handleFlagChange(accountId: string, flag: "isAdmin" | "isTournamentCreator", value: boolean) {
    try {
      const updated = await axios.patch<AdminAccount>(`user/${accountId}/flags`, { [flag]: value });
      setAccounts((prev) =>
        prev.map((a) => (a.id === accountId ? updated.data : a))
      );
      toast.success("Updated.");
    } catch {
      toast.error("Failed to update.");
    }
  }

  if (loading) return <p className="text-ui-text-mute">Loading...</p>;

  return (
    <div>
      <h1 className="text-3xl font-bold text-ui-text mb-6">Manage Roles</h1>
      <div className="flex flex-col gap-3">
        {accounts.map((account) => (
          <RoleAccountItem
            key={account.id}
            account={account}
            onFlagChange={(flag, value) => handleFlagChange(account.id, flag, value)}
          />
        ))}
        {accounts.length === 0 && (
          <p className="text-ui-text-mute">No accounts found.</p>
        )}
      </div>
    </div>
  );
}
