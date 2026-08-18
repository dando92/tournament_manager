import { Tournament } from "@/features/tournament/types/Tournament";

type TournamentCardProps = {
  tournament: Tournament;
  onClick: () => void;
};

const BANNER_COLORS = [
  "from-red-700 to-red-900",
  "from-blue-700 to-blue-900",
  "from-purple-700 to-purple-900",
  "from-emerald-700 to-emerald-900",
  "from-orange-600 to-red-800",
  "from-cyan-700 to-blue-900",
];

function getBannerColor(id: number) {
  return BANNER_COLORS[id % BANNER_COLORS.length];
}

export default function TournamentCard({ tournament, onClick }: TournamentCardProps) {
  const initial = tournament.name.charAt(0).toUpperCase();
  const gradient = getBannerColor(tournament.id);

  return (
    <div
      onClick={onClick}
      className="flex flex-col rounded-lg overflow-hidden border border-gray-200 shadow-sm hover:shadow-md cursor-pointer transition-shadow bg-white"
    >
      {/* Banner */}
      <div className={`bg-gradient-to-br ${gradient} h-32 flex items-center justify-center`}>
        <span className="text-white text-5xl font-black opacity-30 select-none">{initial}</span>
      </div>

      {/* Info */}
      <div className="p-3 flex flex-col gap-1">
        <h3 className="font-bold text-gray-900 text-sm leading-tight line-clamp-2">
          {tournament.name}
        </h3>
      </div>
    </div>
  );
}
