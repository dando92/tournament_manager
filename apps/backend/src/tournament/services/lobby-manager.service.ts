import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tournament } from '@persistence/entities';
import { ILobbyObserver, LobbyConnectionDto, SyncStartConnector } from '@syncstart/index';
import { StandingManager } from '../standing/standing.manager';
import { LiveMatchGateway } from '../gateways/live-match.gateway';
import { LobbyGateway } from '../gateways/lobby.gateway';

interface LobbyMeta {
    tournamentId: number;
    lobbyId: string;
    lobbyName: string;
    isActive: boolean;
    isConnected: boolean;
}

export type TournamentLobbyStatusDto = {
    id: string;
    name: string;
    lobbyCode: string;
    isPasswordProtected: boolean;
    playerCount: number;
    spectatorCount: number;
};

export type TournamentLobbiesDto = {
    status: {
        isActive: boolean;
        isConnected: boolean;
    };
    lobbies: TournamentLobbyStatusDto[];
};

@Injectable()
export class LobbyManager implements OnModuleInit, ILobbyObserver {
    // One SyncStartConnector per tournament
    private connectors = new Map<number, SyncStartConnector>();

    // lobbyCode → lobby metadata (lobbyId is the lobbyCode)
    private lobbyCodeMeta = new Map<string, LobbyMeta>();

    constructor(
        @InjectRepository(Tournament)
        private readonly tournamentRepository: Repository<Tournament>,
        private readonly standingManager: StandingManager,
        private readonly lobbyGateway: LobbyGateway,
        private readonly liveMatchGateway: LiveMatchGateway,
    ) {}

    async onModuleInit(): Promise<void> {
        const tournaments = await this.tournamentRepository.find();
        for (const tournament of tournaments) {
            if (tournament.syncstartUrl) {
                this._createConnector(tournament.id, tournament.syncstartUrl);
                console.log(`[LobbyManager] Created connector for tournament=${tournament.id} url=${tournament.syncstartUrl}`);
            }
        }
    }

    async ConnectLobby(tournamentId: number, name: string, lobbyCode: string, password: string): Promise<string> {
        const connector = this.connectors.get(tournamentId);
        if (!connector) {
            throw new Error(`No SyncStart connector for tournament=${tournamentId}. Ensure the tournament has a syncstartUrl set.`);
        }
        const normalizedLobbyCode = lobbyCode.toUpperCase();
        if (this.lobbyCodeMeta.get(normalizedLobbyCode)?.isActive) {
            throw new Error(`Lobby ${normalizedLobbyCode} is already active`);
        }

        try {
            const { lobbyCode: resolvedLobbyCode } = await connector.SpectateLobby({
                tournamentId,
                lobbyName: name,
                lobbyCode: normalizedLobbyCode,
                password,
            });
            const lobbyId = resolvedLobbyCode;
            this.lobbyCodeMeta.set(resolvedLobbyCode, {
                tournamentId,
                lobbyId,
                lobbyName: name,
                isActive: true,
                isConnected: true,
            });
            console.log(`[LobbyManager] ConnectLobby succeeded (tournament=${tournamentId} lobbyCode=${resolvedLobbyCode} lobbyId=${lobbyId})`);
            return lobbyId;
        } catch (err) {
            this.lobbyCodeMeta.delete(normalizedLobbyCode);
            this.lobbyGateway.OnDisconnection({
                tournamentId,
                lobbyId: normalizedLobbyCode,
                lobbyName: name || normalizedLobbyCode,
                lobbyCode: normalizedLobbyCode,
                isActive: false,
                isConnected: false,
            });
            console.error(`[LobbyManager] ConnectLobby failed (tournament=${tournamentId} lobbyCode=${normalizedLobbyCode}): ${err?.message ?? err}`);
            throw err;
        }
    }

    async CreateLobby(tournamentId: number, name: string, password: string): Promise<{ lobbyId: string; lobbyCode: string }> {
        const connector = this.connectors.get(tournamentId);
        if (!connector) {
            throw new Error(`No SyncStart connector for tournament=${tournamentId}. Ensure the tournament has a syncstartUrl set.`);
        }

        const lobbyName = name || undefined;
        const { lobbyCode } = await connector.CreateLobby({
            tournamentId,
            lobbyName,
            password,
        });
        const lobbyId = lobbyCode;
        this.lobbyCodeMeta.set(lobbyCode, {
            tournamentId,
            lobbyId,
            lobbyName: lobbyName || lobbyCode,
            isActive: true,
            isConnected: true,
        });
        console.log(`[LobbyManager] CreateLobby succeeded (tournament=${tournamentId} lobbyCode=${lobbyCode} lobbyId=${lobbyId})`);
        return { lobbyId, lobbyCode };
    }

    DisconnectLobby(tournamentId: number, lobbyId: string): void {
        const lobbyCode = lobbyId.toUpperCase();
        const meta = this.lobbyCodeMeta.get(lobbyCode);
        if (!meta || meta.tournamentId !== tournamentId) return;

        const connector = this.connectors.get(tournamentId);
        connector?.LeaveLobby(lobbyCode);
        this.lobbyCodeMeta.delete(lobbyCode);
    }

    OnTournamentCreated(tournamentId: number, syncstartUrl: string): void {
        this._createConnector(tournamentId, syncstartUrl);
        console.log(`[LobbyManager] Created connector for new tournament=${tournamentId} url=${syncstartUrl}`);
    }

    OnTournamentUrlChanged(tournamentId: number, newUrl: string): void {
        this._disconnectAllForTournament(tournamentId);
        this._createConnector(tournamentId, newUrl);
        console.log(`[LobbyManager] URL changed for tournament=${tournamentId}, new connector created (no lobbies connected)`);
    }

    async GetLobbies(tournamentId: number): Promise<TournamentLobbiesDto> {
        const connector = this.connectors.get(tournamentId);
        const status = {
            isActive: connector?.IsActive() ?? false,
            isConnected: connector?.IsConnected() ?? false,
        };
        const availableLobbies = connector && status.isConnected ? await connector.SearchLobbies() : [];
        const result = new Map<string, TournamentLobbyStatusDto>();

        for (const lobby of availableLobbies) {
            const lobbyCode = lobby.code.toUpperCase();
            const meta = this.lobbyCodeMeta.get(lobbyCode);
            result.set(lobbyCode, {
                id: lobbyCode,
                name: meta?.lobbyName ?? lobbyCode,
                lobbyCode,
                isPasswordProtected: lobby.isPasswordProtected,
                playerCount: lobby.playerCount,
                spectatorCount: lobby.spectatorCount,
            });
        }

        for (const [lobbyCode, meta] of this.lobbyCodeMeta) {
            if (meta.tournamentId !== tournamentId) continue;
            const existing = result.get(lobbyCode);
            result.set(lobbyCode, {
                id: meta.lobbyId,
                name: meta.lobbyName,
                lobbyCode,
                isPasswordProtected: existing?.isPasswordProtected ?? false,
                playerCount: existing?.playerCount ?? 0,
                spectatorCount: existing?.spectatorCount ?? 0,
            });
        }
        return {
            status,
            lobbies: Array.from(result.values()).sort((a, b) => a.lobbyCode.localeCompare(b.lobbyCode)),
        };
    }

    async ConnectSyncStartServer(tournamentId: number): Promise<{ isActive: boolean; isConnected: boolean }> {
        const connector = this.connectors.get(tournamentId);
        if (!connector) {
            throw new Error(`No SyncStart connector for tournament=${tournamentId}. Ensure the tournament has a syncstartUrl set.`);
        }
        return connector.ConnectToServer(tournamentId);
    }

    DisconnectSyncStartServer(tournamentId: number): { isActive: boolean; isConnected: boolean } {
        const connector = this.connectors.get(tournamentId);
        if (!connector) {
            throw new Error(`No SyncStart connector for tournament=${tournamentId}. Ensure the tournament has a syncstartUrl set.`);
        }
        return connector.DisconnectFromServer();
    }

    private _createConnector(tournamentId: number, syncstartUrl: string): void {
        const connector = new SyncStartConnector(
            syncstartUrl,
            [this, this.standingManager, this.lobbyGateway, this.liveMatchGateway],
        );
        this.connectors.set(tournamentId, connector);
    }

    OnConnectionActive(event: LobbyConnectionDto): void {
        this.lobbyCodeMeta.set(event.lobbyCode, {
            tournamentId: event.tournamentId,
            lobbyId: event.lobbyId,
            lobbyName: event.lobbyName,
            isActive: event.isActive,
            isConnected: event.isConnected,
        });
    }

    OnSyncStartConnectionStatus(): void {}

    OnConnected(event: LobbyConnectionDto): void {
        this.lobbyCodeMeta.set(event.lobbyCode, {
            tournamentId: event.tournamentId,
            lobbyId: event.lobbyId,
            lobbyName: event.lobbyName,
            isActive: event.isActive,
            isConnected: event.isConnected,
        });
    }

    OnDisconnection(event: LobbyConnectionDto): void {
        const meta = this.lobbyCodeMeta.get(event.lobbyCode);
        if (!meta) return;
        if (!event.isActive) {
            this.lobbyCodeMeta.delete(event.lobbyCode);
            return;
        }
        this.lobbyCodeMeta.set(event.lobbyCode, {
            ...meta,
            isActive: event.isActive,
            isConnected: event.isConnected,
        });
        console.log(`[LobbyManager] Disconnection for lobbyCode=${event.lobbyCode} tournament=${event.tournamentId}`);
    }

    private _disconnectAllForTournament(tournamentId: number): void {
        const connector = this.connectors.get(tournamentId);
        if (!connector) return;

        connector.DisconnectAll();
        for (const [lobbyCode, meta] of this.lobbyCodeMeta) {
            if (meta.tournamentId !== tournamentId) continue;
            this.lobbyCodeMeta.delete(lobbyCode);
        }
        this.connectors.delete(tournamentId);
    }

}
