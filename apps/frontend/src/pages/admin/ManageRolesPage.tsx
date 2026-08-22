import { useManageRolesPage } from "@/features/auth/model/useManageRolesPage";
import RoleAccountItem from "@/features/auth/ui/RoleAccountItem";

export default function ManageRolesPage() {
  const { accounts, loading, changeFlag } = useManageRolesPage();

  if (loading) return <p className="text-ui-text-mute">Loading...</p>;

  return (
    <div>
      <h1 className="text-3xl font-bold text-ui-text mb-6">Manage Roles</h1>
      <div className="flex flex-col gap-3">
        {accounts.map((account) => (
          <RoleAccountItem
            key={account.id}
            account={account}
            onFlagChange={(flag, value) => changeFlag(account.id, flag, value)}
          />
        ))}
        {accounts.length === 0 && (
          <p className="text-ui-text-mute">No accounts found.</p>
        )}
      </div>
    </div>
  );
}
