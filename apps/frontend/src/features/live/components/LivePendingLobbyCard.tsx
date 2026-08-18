type Props = {
  lobbyName: string;
};

export default function LivePendingLobbyCard({ lobbyName }: Props) {
  return (
    <div className="p-4 rounded-md bg-gray-700 text-gray-400">
      <span className="font-semibold">{lobbyName}</span>
      <span className="ml-2 text-sm">Waiting for gameplay...</span>
    </div>
  );
}
