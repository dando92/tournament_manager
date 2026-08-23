# Legacy ITGmania SyncStart Bridge

## Purpose

Older ITGmania builds do not speak the SyncStart WebSocket protocol. They
broadcast UDP datagrams on port `53000`, which is how machines used to keep each
other in sync before a server existed. The bridge in
`tools/legacy-syncstart-bridge` listens to those datagrams and answers
Tournament Manager as if it were a SyncStart server, so a tournament can be run
on legacy cabinets without the application knowing that the game is legacy.

It is a compatibility adapter and not a second SyncStart implementation. It
reproduces the behaviour Tournament Manager observes and nothing else: no lobby
manager, no machine-to-machine song selection, no synchronized start.

Reference sources for the two ends it joins:

- `C:\repos\itgmania-bsys\src\SyncStartManager.cpp`, branch `premium-free`: the
  legacy broadcast protocol.
- `packages/syncstart-protocol/src/protocol/lobby-state-interpreter.ts`: what
  this application makes of a lobby snapshot.

## Scope

- One bridge instance represents one cabinet room and publishes one virtual
  lobby, whose code defaults to `BRDG`.
- `P1` and `P2` of that room are accumulated in the same lobby state.
- Several Tournament Manager connections may watch the same lobby.
- Several cabinets broadcasting on one segment are merged into that one lobby.
  This is a deliberate limitation of the current scope: with two cabinets
  playing at once, the second one's `P1` overwrites the first one's. Splitting
  lobbies by source address is the change to make if a venue needs it.
- Nothing is sent back to the cabinets. Tournament Manager never asks a lobby to
  change song — `SyncStartClient.ChangeSong` throws — so the bridge is a
  listener, and the legacy `SONG` and `START` opcodes it could broadcast are out
  of scope.

## Legacy UDP protocol

The first byte of a datagram is the opcode and the rest is UTF-8.

| Opcode | Meaning                 | Bridge behaviour                                                                                                |
| ------ | ----------------------- | --------------------------------------------------------------------------------------------------------------- |
| `0x00` | Song starting           | Opens a session for that song if one is not already open. No player becomes ready: the message names no player. |
| `0x01` | Song or course selected | Opens a new session, clears the previous players, publishes `songInfo`.                                         |
| `0x02` | Live score update       | Replaces that player's counters, publishes the lobby on `ScreenGameplay`.                                       |
| `0x03` | Marathon song loading   | Logged at debug and ignored.                                                                                    |
| `0x04` | Marathon song ready     | Logged at debug and ignored.                                                                                    |
| `0x05` | Final song score        | Records that player's final state and arms the completion.                                                      |
| `0x06` | Final course score      | The same, with the course identifier the cabinet sent.                                                          |

A score payload has exactly 26 `|`-separated fields — `ALL_ITEMS_LENGTH` on the
cabinet — in this order:

```text
song | playerNumber | playerName | actualDp | currentPossibleDp | possibleDp | percentage | life | failed
     | none | hitMine | avoidMine | checkpointMiss | miss | W5 | W4 | W3 | W2 | white | W1-white | checkpointHit
     | holdNone | holdLetGo | holdHeld | holdMissed | totalHolds
```

The profile name is taken up to `~ Team`, because the venue profiles carry the
team in the name and the roster holds the person.

Any other field count, an unparseable counter, an empty song or an empty player
name is dropped and logged. `playerNumber` is `0` for `P1` and `1` for `P2`,
which is `PlayerNumber.h`'s `PLAYER_1 = 0`. The earlier JavaScript prototype
reached the same mapping and it is now covered by a test.

### The two fantastic windows

`writeScoreMessage` walks `TapNoteScore` and, at `TNS_W2`, writes the white
count as an extra field and then writes `TNS_W1` minus that white count. So the
wire separates Fantastic+ from Fantastic even though the enum does not:

| Wire field            | Judgment        |
| --------------------- | --------------- |
| `white`               | `fantasticPlus` |
| `W1 - white`          | `fantastics`    |
| `W2`                  | `excellents`    |
| `W3`                  | `greats`        |
| `W4`                  | `decents`       |
| `W5`                  | `wayOffs`       |
| `miss`                | `misses`        |
| `hitMine`             | `minesHit`      |
| `hitMine + avoidMine` | `totalMines`    |
| `holdHeld`            | `holdsHeld`     |
| `totalHolds`          | `totalHolds`    |

`totalSteps` is the sum of the six judged arrow windows and the misses. Mines
and holds are not steps.

## What Tournament Manager actually reads

These were verified against this repository before the bridge was written, and
they are what its published snapshots are shaped by.

1. **`exScore` is the run.** `CompletedSongService.resolve` records
   `percentage: score.exScore`; a score without `exScore` is answered with
   `No EX score found for <name>` and nothing is saved. `score` is a display
   value on the live card only.
2. **The range is `0..100`.** The standing shows `percentage.toFixed(2)%`. The
   cabinet's own formatted percentage is already in that range.
3. **A song is matched by `songInfo.songPath`.** `SONG_OF_TOURNAMENT_BY_TITLE`
   compares it to `song.title` with exact equality, and the folder importer
   stores a title as `Pack/SongFolder` — the same shape `SongToString` writes on
   the cabinet. So the legacy identifier can be published unchanged. What
   happens when the pool does not hold it is FQ-021.
4. **Judgments consumed** are `fantasticPlus`, `fantastics`, `excellents`,
   `greats`, `decents`, `wayOffs`, `misses`, `minesHit`, `holdsHeld` and
   `totalHolds`. Rolls are not read, which is why the missing roll separation
   costs nothing today (FQ-026).
5. **`screenName` is load-bearing, not cosmetic.** `LobbyStateInterpreter`
   reports live scores only for players on `ScreenGameplay`, and reports a
   completed song only when a player it last saw on `ScreenGameplay` appears on
   `ScreenEvaluation` or `ScreenEvaluationStage`. A bridge that published final
   scores alone would never record anything.
6. **`ready` is telemetry.** It produces a `player-ready` event and drives no
   match state.
7. **`spectators` is not read.** It stays empty.
8. **A completion carries every player in the snapshot**, and the API
   de-duplicates on a completion id built from the song and each player's
   `exScore`. So a snapshot that turns one player to evaluation while another is
   still playing would record the second player's half-finished run, and record
   it again when they finish.

## Session lifecycle

1. `SONG`, or any score naming a song other than the open one, starts a session
   and clears the previous players.
2. A live score publishes the player on `ScreenGameplay`. `ready` turns true on
   the first judged item — an arrow, a mine or a hold — and not merely because a
   packet arrived, since the cabinet sends an all-zero update before the first
   arrow.
3. A final score records that player and arms the completion timer. While
   somebody the session has seen is still playing, the timer is
   `FINAL_TIMEOUT_MS`; once everybody it has seen has finished, it is the short
   `FINAL_GRACE_MS`, which is the window in which a cabinet that broadcasts no
   live scores still names its second player.
4. When the timer fires, anybody without a final score is left out of the
   completion rather than reported half-played, and the song is published as two
   snapshots in order: the players on `ScreenGameplay` carrying their final
   numbers, then the same players on `ScreenEvaluation`.
5. A repeated final datagram is ignored. A different final for the same song
   after a completion is a new play and starts a new session.

Snapshots are published only when they differ from the last one sent.

## WebSocket compatibility contract

| Incoming event  | Behaviour                                                                                                 |
| --------------- | --------------------------------------------------------------------------------------------------------- |
| `createLobby`   | Attaches the client to the virtual lobby and answers `lobbyState`. The machine in the request is ignored. |
| `spectateLobby` | Verifies code and password, attaches, answers `lobbyState`. Never creates a lobby.                        |
| `searchLobby`   | Answers `lobbySearched` with the one virtual lobby, so it can be picked from the lobby list.              |
| `lobbyState`    | Answers with the current snapshot.                                                                        |
| `leaveLobby`    | Detaches and answers `lobbyLeft`.                                                                         |
| anything else   | Answers `responseStatus` with `success: false`.                                                           |

Outgoing events are `lobbyState`, `lobbySearched`, `lobbyLeft` and
`responseStatus`. Connections are pinged on an interval and a client that has
not answered since the previous round is terminated. The payload size is capped
by `WS_MAX_PAYLOAD_BYTES`.

## Configuration

| Variable                   | Default | Meaning                                                             |
| -------------------------- | ------- | ------------------------------------------------------------------- |
| `SYNCSTART_UDP_PORT`       | `53000` | Legacy broadcast port to listen on.                                 |
| `WS_PORT`                  | `1337`  | WebSocket port Tournament Manager connects to.                      |
| `LOBBY_CODE`               | `BRDG`  | Code of the virtual lobby, 1 to 8 letters or digits.                |
| `LOBBY_PASSWORD`           | empty   | Password `spectateLobby` must present.                              |
| `UDP_ALLOWED_SOURCES`      | empty   | Comma-separated cabinet addresses; empty accepts the whole segment. |
| `FINAL_GRACE_MS`           | `1500`  | Wait after the last known player finished.                          |
| `FINAL_TIMEOUT_MS`         | `20000` | Wait for a player who started and never finished.                   |
| `WS_MAX_PAYLOAD_BYTES`     | `65536` | Maximum accepted client message.                                    |
| `WS_HEARTBEAT_INTERVAL_MS` | `30000` | Ping interval and dead-connection cutoff.                           |
| `LOG_LEVEL`                | `info`  | `debug`, `info`, `warn` or `error`.                                 |

An invalid value stops the process at startup rather than at the first packet.

## Networking

ITGmania sends to `INADDR_BROADCAST`, which is delivered on the local link and
never routed. The bridge must therefore run on the same network segment as the
cabinets, and the container must actually receive link-local broadcast:

- **Published port** (the checked-in default): the Docker host's forwarder binds
  `53000/udp` and hands datagrams to the container. This is the only mode that
  also keeps the bridge on the Compose network, where the SyncStart service
  reaches it as `ws://legacy-syncstart-bridge:1337`. Whether a given host
  forwards broadcast to a published UDP port has to be tested on that host; on
  Docker Desktop for Windows with WSL2 it depends on the networking mode, and
  `networkingMode=mirrored` in `.wslconfig` is the setting that makes the VM
  share the host's interfaces.
- **Host networking**: on a Linux Docker host, replacing the `ports` section
  with `network_mode: host` is the reliable mode. The bridge is then reachable
  at the host address instead of the service name.
- **On the host**: `npm run local_sync:bridge` runs the same bridge as a plain
  Node process outside Docker, and the tournament points at
  `ws://host.docker.internal:1337`. This is the fallback when neither container
  mode delivers broadcast.

The mode in use must be verified against a real cabinet: opcodes `0x01`, `0x02`
and `0x05` have to reach the service without manual forwarding.

## Testing

`npm run test --workspace=@tournament-manager/legacy-syncstart-bridge` covers the
parser, the score and judgment mapping, the session state machine and the
WebSocket contract, including the snapshot order a completed song depends on.
What unit tests cannot cover is delivery: a real cabinet on the venue LAN, and a
complete two-player song recorded as two standings.
