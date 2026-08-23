import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTv } from "@fortawesome/free-solid-svg-icons";
import LobbyLiveScores from "@/features/live/ui/LobbyLiveScores";
import { LiveMatchStateDto } from "@tournament-manager/contracts";
import { btnPrimary } from "@/styles/buttonStyles";

type Props = {
  lobbyState: LiveMatchStateDto;
  showObsSource: boolean;
};

export default function LobbyLiveBlock({ lobbyState, showObsSource }: Props) {
  const obsUrl = `${window.location.origin}/obs/${lobbyState.lobbyId}?tournamentId=${lobbyState.tournamentId}`;
  const songName = lobbyState.songTitle || lobbyState.songPath;

  return (
    <div className="mb-6">
      <div className="flex items-stretch justify-between mb-2">
        <div className="flex flex-col justify-center">
          <span className="text-lg font-bold text-ui-text">{lobbyState.lobbyName}</span>
          {lobbyState.lobbyCode && (
            <span className="text-xs text-ui-text-mute">{lobbyState.lobbyCode}</span>
          )}
          {songName && (
            <span className="text-sm text-ui-text-mute">{songName}</span>
          )}
        </div>
        {showObsSource && (
          <a
            href={obsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={`flex items-center gap-2 text-sm ${btnPrimary}`}
          >
            <FontAwesomeIcon icon={faTv} />
            <span>OBS source</span>
          </a>
        )}
      </div>
      <LobbyLiveScores lobbyState={lobbyState} singleColumn />
    </div>
  );
}
