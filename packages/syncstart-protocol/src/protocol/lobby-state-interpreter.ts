import type {
  LobbyCompletedScoreDto,
  LobbyJudgmentsDto,
  LobbyLivePlayerDto,
  LobbySongDto,
} from "./lobby-observer.interface";
import type { SyncStartLobbyPlayer, SyncStartLobbyStatePayload } from "./syncstart-protocol.types";

export type LobbyStateTransition =
  | { type: "song-selected"; song: LobbySongDto }
  | { type: "player-ready"; playerId: string; playerName: string; ready: boolean }
  | { type: "match-update"; song?: LobbySongDto; players: LobbyLivePlayerDto[] }
  | { type: "song-completed"; song: LobbySongDto; scores: LobbyCompletedScoreDto[] };

/** Converts volatile SyncStart snapshots into application-neutral transitions. */
export class LobbyStateInterpreter {
  private previousSongKey: string | null = null;
  private readonly readyByPlayerKey = new Map<string, boolean>();
  private readonly screenByPlayerKey = new Map<string, SyncStartLobbyPlayer["screenName"]>();
  private lastCompletedSignature: string | null = null;

  interpret(lobby: SyncStartLobbyStatePayload): LobbyStateTransition[] {
    const transitions: LobbyStateTransition[] = [];
    const song = this.song(lobby);
    const players = lobby.players.map((player) => ({ player, key: this.playerKey(player), previousScreen: this.screenByPlayerKey.get(this.playerKey(player)) }));
    if (song) {
      const key = `${song.songPath}|${song.title}`;
      if (key !== this.previousSongKey) {
        this.previousSongKey = key;
        this.lastCompletedSignature = null;
        transitions.push({ type: "song-selected", song });
      }
    }
    for (const { player, key } of players) {
      if (this.readyByPlayerKey.has(key) || this.screenByPlayerKey.has(key)) continue;
      this.readyByPlayerKey.set(key, false);
      transitions.push({ type: "player-ready", playerId: player.playerId, playerName: this.name(player.profileName), ready: false });
    }
    const gameplay = lobby.players.filter((player) => player.screenName === "ScreenGameplay");
    for (const player of gameplay) {
      const key = this.playerKey(player);
      if (this.readyByPlayerKey.get(key) !== player.ready) {
        this.readyByPlayerKey.set(key, player.ready);
        transitions.push({ type: "player-ready", playerId: player.playerId, playerName: this.name(player.profileName), ready: player.ready });
      }
    }
    if (gameplay.length) transitions.push({ type: "match-update", song, players: gameplay.map((player) => this.livePlayer(player)) });
    if (song && players.some(({ player, previousScreen }) => previousScreen === "ScreenGameplay" && this.evaluation(player.screenName))) {
      const scores = lobby.players.map((player) => this.score(player));
      const signature = JSON.stringify({ songPath: song.songPath, scores: scores.map(({ playerId, playerName, score, exScore, isFailed }) => ({ playerId, playerName, score, exScore, isFailed })).sort((a, b) => a.playerId.localeCompare(b.playerId)) });
      if (signature !== this.lastCompletedSignature) {
        this.lastCompletedSignature = signature;
        transitions.push({ type: "song-completed", song, scores });
      }
    }
    for (const { player, key } of players) this.screenByPlayerKey.set(key, player.screenName);
    return transitions;
  }

  private song(lobby: SyncStartLobbyStatePayload): LobbySongDto | undefined { return lobby.songInfo && { songPath: lobby.songInfo.songPath, title: lobby.songInfo.title, artist: lobby.songInfo.artist, songLength: lobby.songInfo.songLength }; }
  private livePlayer(player: SyncStartLobbyPlayer): LobbyLivePlayerDto { return { playerId: player.playerId, playerName: this.name(player.profileName), score: player.score ?? 0, exScore: player.exScore, isFailed: player.isFailed ?? false, songProgression: player.songProgression, judgments: this.judgments(player) }; }
  private score(player: SyncStartLobbyPlayer): LobbyCompletedScoreDto { return { playerId: player.playerId, playerName: this.name(player.profileName), score: player.score ?? 0, exScore: player.exScore, isFailed: player.isFailed ?? false }; }
  private judgments(player: SyncStartLobbyPlayer): LobbyJudgmentsDto | undefined { return player.judgments && { fantasticPlus: player.judgments.fantasticPlus, fantastics: player.judgments.fantastics, excellents: player.judgments.excellents, greats: player.judgments.greats, decents: player.judgments.decents ?? 0, wayOffs: player.judgments.wayOffs ?? 0, misses: player.judgments.misses, minesHit: player.judgments.minesHit, holdsHeld: player.judgments.holdsHeld, totalHolds: player.judgments.totalHolds }; }
  private name(name: string): string { return name.replace(/\[DS\]/g, "").replace(/\s+/g, " ").trim(); }
  private playerKey(player: SyncStartLobbyPlayer): string { return `${player.playerId}|${this.name(player.profileName)}`; }
  private evaluation(screen: SyncStartLobbyPlayer["screenName"]): boolean { return screen === "ScreenEvaluation" || screen === "ScreenEvaluationStage"; }
}
