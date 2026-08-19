import {
    BadRequestException,
    ForbiddenException,
    Injectable,
    Logger,
    NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import type { ScoringSystemType } from '@tournament-manager/scoring';
import {
    Division,
    Entrant,
    ExternalMapping,
    Match,
    MatchResult,
    Participant,
    Phase,
    PhaseGroup,
    Player,
    Tournament,
} from '@tournament-manager/persistence';
import { DivisionService } from '@tournament/services/division.service';
import { EntrantService } from '@tournament/services/entrant.service';
import { UiUpdatePublisher } from '@match/services/ui-update.publisher';
import { ParticipantService } from '@tournament/services/participant.service';
import { PhaseService } from '@tournament/services/phase.service';
import { PlayerService } from '@player/player.service';
import { TournamentService } from '@tournament/services/tournament.service';
import { CreateDivisionDto, CreatePhaseDto } from '@tournament/dtos';
import { AdvancementRuleService } from '@tournament/services/advancement-rule.service';
import { PhaseGroupService } from '@tournament/services/phase-group.service';
import {
    StartggClient,
    StartggBracketSetGameDataInput,
    StartggEntrantNode,
    StartggEventSnapshot,
    StartggPhaseGroupNode,
    StartggParticipantNode,
    StartggPhaseNode,
    StartggReportedSetNode,
    StartggSetNode,
} from '@tournament-manager/startgg';
import { StartggImportDto, StartggImportPreviewDto } from './startgg.dto';

type AuthUser = {
    id: string;
    isAdmin?: boolean;
};

type StartggMappingCache = {
    byExternalKey: Map<string, ExternalMapping>;
    dirtyByExternalKey: Map<string, ExternalMapping>;
};

type ImportedMatchSyncResult = {
    matchesBySetId: Map<string, Match>;
    touchedPhaseIds: Set<number>;
    touchedPhaseGroupIds: Set<number>;
};

@Injectable()
export class StartggService {
    private readonly logger = new Logger(StartggService.name);
    private readonly snapshotCacheTtlMs = 5 * 60 * 1000;
    private readonly snapshotCache = new Map<string, { snapshot: StartggEventSnapshot; expiresAt: number }>();
    private readonly bulkSaveChunkSize = 100;

    constructor(
        private readonly startggClient: StartggClient,
        private readonly tournamentService: TournamentService,
        private readonly divisionService: DivisionService,
        private readonly phaseService: PhaseService,
        private readonly participantService: ParticipantService,
        private readonly entrantService: EntrantService,
        private readonly playerService: PlayerService,
        private readonly uiUpdateGateway: UiUpdatePublisher,
        private readonly advancementRuleService: AdvancementRuleService,
        private readonly phaseGroupService: PhaseGroupService,
        @InjectRepository(Tournament)
        private readonly tournamentRepository: Repository<Tournament>,
        @InjectRepository(Division)
        private readonly divisionRepository: Repository<Division>,
        @InjectRepository(Phase)
        private readonly phaseRepository: Repository<Phase>,
        @InjectRepository(Participant)
        private readonly participantRepository: Repository<Participant>,
        @InjectRepository(Entrant)
        private readonly entrantRepository: Repository<Entrant>,
        @InjectRepository(Match)
        private readonly matchRepository: Repository<Match>,
        @InjectRepository(MatchResult)
        private readonly matchResultRepository: Repository<MatchResult>,
        @InjectRepository(ExternalMapping)
        private readonly externalMappingRepository: Repository<ExternalMapping>,
    ) {}

    async previewImport(dto: StartggImportPreviewDto, user?: AuthUser) {
        const previewStartedAt = Date.now();
        this.logger.log(`[timing] start previewImport eventSlug=${dto.eventSlug} targetTournamentId=${dto.targetTournamentId ?? 'none'}`);
        if (!dto.targetTournamentId) {
            throw new ForbiddenException('A target tournament is required for start.gg import.');
        }
        await this.timeOperation(
            `previewImport.assertCanEditTournament tournamentId=${dto.targetTournamentId}`,
            () => this.assertCanEditTournament(dto.targetTournamentId!, user),
        );
        const startggApiKey = await this.timeOperation(
            `previewImport.resolveStartggApiKey tournamentId=${dto.targetTournamentId}`,
            () => this.resolveStartggApiKey(dto.targetTournamentId!),
        );

        const snapshot = await this.timeOperation(
            `previewImport.buildEventSnapshot eventSlug=${dto.eventSlug}`,
            () => this.buildEventSnapshot(dto.eventSlug, startggApiKey),
        );
        const context = dto.targetTournamentId
            ? await this.timeOperation(
                `previewImport.buildLocalContext tournamentId=${dto.targetTournamentId}`,
                () => this.buildLocalContext(dto.targetTournamentId!),
            )
            : null;

        const remotePhases = this.timeSyncOperation('previewImport.getEffectiveRemotePhases', () => this.getEffectiveRemotePhases(snapshot));
        const seedByEntrantId = this.timeSyncOperation('previewImport.buildSeedMap', () => this.buildSeedMap(snapshot));
        const divisionMapping = context
            ? this.findMappingInList(context.mappings, 'division', 'event', snapshot.id)
            : null;
        const mappedDivision = divisionMapping
            ? context.divisionsById.get(Number(divisionMapping.localId)) ?? null
            : null;

        const participants = snapshot.entrants.flatMap((entrant) => entrant.participants);
        const uniqueParticipants = this.timeSyncOperation(
            'previewImport.uniqueParticipants',
            () => this.uniqueBy(participants, (participant) => participant.id),
        );

        const participantPlan = this.timeSyncOperation('previewImport.participantPlan', () => uniqueParticipants.map((participant) => {
            const mappedParticipant = context
                ? this.findMappedLocalEntity(context.mappings, 'participant', 'participant', participant.id, context.participantsById)
                : null;
            if (mappedParticipant) {
                return {
                    externalId: participant.id,
                    gamerTag: participant.gamerTag,
                    action: 'mapped',
                    localParticipantId: mappedParticipant.id,
                    localPlayerId: mappedParticipant.player?.id ?? null,
                };
            }

            const matchedPlayer = context?.playersByNormalizedName.get(this.normalizeName(participant.gamerTag)) ?? null;
            if (!context) {
                return {
                    externalId: participant.id,
                    gamerTag: participant.gamerTag,
                    action: 'unscoped-preview',
                    localParticipantId: null,
                    localPlayerId: matchedPlayer?.id ?? null,
                };
            }

            if (matchedPlayer) {
                const existingParticipant = Array.from(context.participantsById.values())
                    .find((candidate) => candidate.player?.id === matchedPlayer.id) ?? null;
                return {
                    externalId: participant.id,
                    gamerTag: participant.gamerTag,
                    action: existingParticipant ? 'match-existing-participant' : 'create-participant',
                    localParticipantId: existingParticipant?.id ?? null,
                    localPlayerId: matchedPlayer.id,
                };
            }

            return {
                externalId: participant.id,
                gamerTag: participant.gamerTag,
                action: 'create-player-and-participant',
                localParticipantId: null,
                localPlayerId: null,
            };
        }));

        const entrantPlan = this.timeSyncOperation('previewImport.entrantPlan', () => snapshot.entrants.map((entrant) => {
            const mappedEntrant = context
                ? this.findMappedLocalEntity(context.mappings, 'entrant', 'entrant', entrant.id, context.entrantsById)
                : null;
            const resolvedParticipants = entrant.participants.map((participant) =>
                participantPlan.find((plan) => plan.externalId === participant.id),
            );
            const isTeam = entrant.participants.length > 1;
            const existingSinglesEntrant = !mappedEntrant && mappedDivision && !isTeam && resolvedParticipants[0]?.localParticipantId
                ? (mappedDivision.entrants ?? []).find((candidate) =>
                    candidate.participants?.some((participant) => participant.id === resolvedParticipants[0].localParticipantId),
                ) ?? null
                : null;

            return {
                externalId: entrant.id,
                name: entrant.name,
                type: isTeam ? 'team' : 'player',
                seedNum: seedByEntrantId.get(entrant.id) ?? null,
                action: mappedEntrant
                    ? 'mapped'
                    : existingSinglesEntrant
                        ? 'match-existing-entrant'
                        : isTeam
                            ? 'create-team-entrant'
                            : 'create-entrant',
                localEntrantId: mappedEntrant?.id ?? existingSinglesEntrant?.id ?? null,
                participantExternalIds: entrant.participants.map((participant) => participant.id),
            };
        }));

        const phasePlan = this.timeSyncOperation('previewImport.phasePlan', () => remotePhases.map((phase) => {
            const mappedPhase = context
                ? this.findMappedLocalEntity(context.mappings, 'phase', 'phase', phase.id, context.phasesById)
                : null;
            return {
                externalId: phase.id,
                name: phase.name,
                action: mappedPhase ? 'mapped' : 'create-phase',
                localPhaseId: mappedPhase?.id ?? null,
            };
        }));

        const snapshotSets = this.timeSyncOperation('previewImport.flattenSets', () => this.getSnapshotSets(snapshot));
        const defaultPhaseId = remotePhases[0]?.id ?? `event:${snapshot.id}:default-phase`;
        const matchPlan = this.timeSyncOperation('previewImport.matchPlan', () => snapshotSets.map((set) => {
            const mappedMatch = context
                ? this.findMappedLocalEntity(context.mappings, 'match', 'set', set.id, context.matchesById)
                : null;
            return {
                externalId: set.id,
                name: this.buildMatchName(set),
                action: mappedMatch ? 'mapped' : 'create-match',
                localMatchId: mappedMatch?.id ?? null,
                phaseExternalId: set.phaseId ?? defaultPhaseId,
                entrantExternalIds: set.entrants.map((entrant) => entrant.id),
            };
        }));

        const result = {
            event: {
                id: snapshot.id,
                name: snapshot.name,
                slug: snapshot.slug,
                tournament: snapshot.tournament ?? null,
                phases: snapshot.phases.map((phase) => ({
                    id: phase.id,
                    name: phase.name,
                })),
            },
            targetTournamentId: dto.targetTournamentId ?? null,
            mode: dto.mode ?? 'create-division',
            division: {
                externalId: snapshot.id,
                name: snapshot.name,
                action: mappedDivision ? 'mapped' : 'create-division',
                localDivisionId: mappedDivision?.id ?? null,
            },
            counts: {
                participants: participantPlan.length,
                entrants: entrantPlan.length,
                phases: phasePlan.length,
                matches: matchPlan.length,
            },
            participants: participantPlan,
            entrants: entrantPlan,
            phases: phasePlan,
            matches: matchPlan,
        };

        this.logger.log(`[timing] complete previewImport eventSlug=${dto.eventSlug} durationMs=${Date.now() - previewStartedAt}`);
        return result;
    }

    async importEvent(dto: StartggImportDto, user?: AuthUser) {
        const importStartedAt = Date.now();
        this.logger.log(`[timing] start importEvent eventSlug=${dto.eventSlug} tournamentId=${dto.targetTournamentId}`);
        await this.timeOperation(
            `importEvent.assertCanEditTournament tournamentId=${dto.targetTournamentId}`,
            () => this.assertCanEditTournament(dto.targetTournamentId, user),
        );

        const tournament = await this.timeOperation(
            `importEvent.loadTournament tournamentId=${dto.targetTournamentId}`,
            () => this.tournamentRepository.findOneBy({ id: dto.targetTournamentId }),
        );
        if (!tournament) throw new NotFoundException(`Tournament ${dto.targetTournamentId} not found`);
        const startggApiKey = this.getConfiguredStartggApiKey(tournament);

        const snapshot = await this.timeOperation(
            `importEvent.buildEventSnapshot eventSlug=${dto.eventSlug}`,
            () => this.buildEventSnapshot(dto.eventSlug, startggApiKey),
        );

        const seedByEntrantId = this.timeSyncOperation('importEvent.buildSeedMap', () => this.buildSeedMap(snapshot));
        const remotePhases = this.timeSyncOperation('importEvent.getEffectiveRemotePhases', () => this.getEffectiveRemotePhases(snapshot));
        const snapshotSets = this.timeSyncOperation('importEvent.flattenSets', () => this.getSnapshotSets(snapshot));
        const [mappingCache, playersByNormalizedName] = await this.timeOperation(
            'importEvent.loadCaches',
            async () => {
                const [mappings, allPlayers] = await Promise.all([
                    this.externalMappingRepository.find({ where: { provider: 'startgg' } }),
                    this.playerService.findAll(),
                ]);

                return [
                    this.createMappingCache(mappings),
                    new Map<string, Player>(allPlayers.map((player) => [this.normalizeName(player.playerName), player])),
                ] as const;
            },
        );

        const division = await this.timeOperation(
            `importEvent.ensureDivision tournamentId=${tournament.id}`,
            () => this.ensureDivision(snapshot, tournament.id, mappingCache),
        );
        if (snapshot.tournament?.id) {
            this.timeSyncOperation(
                `importEvent.queueTournamentMapping tournamentId=${tournament.id}`,
                () => this.cacheMapping(mappingCache, {
                    provider: 'startgg',
                    localType: 'tournament',
                    localId: String(tournament.id),
                    externalType: 'tournament',
                    externalId: snapshot.tournament.id,
                    externalSlug: snapshot.tournament.slug ?? null,
                    metadata: { eventSlug: snapshot.slug },
                }),
            );
        }

        const participantByExternalId = new Map<string, Participant>();
        const uniqueParticipants = this.timeSyncOperation(
            'importEvent.uniqueParticipants',
            () => this.uniqueBy(snapshot.entrants.flatMap((entrant) => entrant.participants), (node) => node.id),
        );
        await this.timeOperation(`importEvent.ensureParticipants count=${uniqueParticipants.length}`, async () => {
            for (const participant of uniqueParticipants) {
                const localParticipant = await this.ensureParticipant(
                    dto.targetTournamentId,
                    participant,
                    mappingCache,
                    playersByNormalizedName,
                );
                participantByExternalId.set(participant.id, localParticipant);
            }
        });

        const entrantByExternalId = new Map<string, Entrant>();
        await this.timeOperation(`importEvent.ensureEntrants count=${snapshot.entrants.length}`, async () => {
            for (const entrant of snapshot.entrants) {
                const localEntrant = await this.ensureEntrant(
                    division.id,
                    entrant,
                    participantByExternalId,
                    mappingCache,
                );
                entrantByExternalId.set(entrant.id, localEntrant);
            }
        });

        const localPhases = new Map<string, Phase>();
        await this.timeOperation(`importEvent.ensurePhases count=${remotePhases.length}`, async () => {
            for (const phase of remotePhases) {
                const localPhase = await this.ensurePhase(division.id, phase, mappingCache);
                localPhases.set(phase.id, localPhase);
            }
        });

        const fallbackPhase = remotePhases[0]
            ? localPhases.get(remotePhases[0].id) ?? null
            : await this.timeOperation(
                'importEvent.ensureFallbackPhase',
                () => this.ensurePhase(division.id, {
                    id: `event:${snapshot.id}:default-phase`,
                    name: `${snapshot.name} Imported Phase`,
                    seeds: [],
                    phaseGroups: [],
                }, mappingCache),
            );
        if (!fallbackPhase) {
            throw new NotFoundException(`Could not resolve a local phase for imported event ${snapshot.id}`);
        }

        const localPhaseGroups = new Map<string, PhaseGroup>();
        await this.timeOperation(`importEvent.ensurePhaseGroups phaseCount=${remotePhases.length}`, async () => {
            for (const phase of remotePhases) {
                const localPhase = localPhases.get(phase.id);
                if (!localPhase) continue;
                for (const phaseGroup of phase.phaseGroups ?? []) {
                    const localPhaseGroup = await this.ensurePhaseGroup(localPhase, phaseGroup, mappingCache);
                    localPhaseGroups.set(phaseGroup.id, localPhaseGroup);

                    const groupEntrantIds = this.uniqueBy(
                        (phaseGroup.sets ?? []).flatMap((set) => set.entrants.map((entrant) => entrant.id)),
                        (id) => id,
                    );
                    const phaseSeedByEntrantId = new Map((phase.seeds ?? []).map((seed) => [seed.entrantId, seed.seedNum]));
                    const orderedEntrants = groupEntrantIds
                        .sort((left, right) =>
                            (phaseSeedByEntrantId.get(left) ?? Number.MAX_SAFE_INTEGER)
                            - (phaseSeedByEntrantId.get(right) ?? Number.MAX_SAFE_INTEGER),
                        )
                        .map((entrantId) => entrantByExternalId.get(entrantId))
                        .filter((entrant): entrant is Entrant => Boolean(entrant))
                    ;
                    await this.phaseGroupService.replaceEntrants(localPhaseGroup.id, orderedEntrants);
                }
            }
        });

        const { matchesBySetId: localMatches, touchedPhaseIds, touchedPhaseGroupIds } = await this.timeOperation(
            `importEvent.syncMatches count=${snapshotSets.length}`,
            () => this.syncImportedMatches(
                snapshotSets,
                remotePhases,
                localPhaseGroups,
                fallbackPhase,
                entrantByExternalId,
                mappingCache,
                tournament.defaultScoringSystem,
            ),
        );

        await this.timeOperation(
            `importEvent.flushMappings count=${mappingCache.dirtyByExternalKey.size}`,
            () => this.flushMappingCache(mappingCache),
        );

        await this.timeOperation(
            `importEvent.emitPhaseUpdates count=${touchedPhaseIds.size}`,
            () => Promise.all(Array.from(touchedPhaseIds).map((phaseId) => this.uiUpdateGateway.emitPhaseUpdateByPhaseId(phaseId))),
        );

        await this.timeOperation(
            `importEvent.emitPhaseGroupUpdates count=${touchedPhaseGroupIds.size}`,
            () => Promise.all(
                Array.from(touchedPhaseGroupIds).map((phaseGroupId) =>
                    this.uiUpdateGateway.emitPhaseGroupUpdateByPhaseGroupId(phaseGroupId),
                ),
            ),
        );

        const result = {
            tournamentId: tournament.id,
            divisionId: division.id,
            imported: {
                participants: participantByExternalId.size,
                entrants: entrantByExternalId.size,
                phases: localPhases.size || (fallbackPhase ? 1 : 0),
                matches: localMatches.size,
            },
        };

        this.logger.log(`[timing] complete importEvent eventSlug=${dto.eventSlug} tournamentId=${dto.targetTournamentId} durationMs=${Date.now() - importStartedAt}`);
        return result;
    }

    async reportCompletedMatch(matchId: number): Promise<StartggReportedSetNode[]> {
        const match = await this.matchRepository.findOne({
            where: { id: matchId },
            relations: {
                matchResult: true,
                rounds: {
                    standings: {
                        score: {
                            player: true,
                        },
                    },
                },
                entrants: { participants: { player: true } },
                phaseGroup: { phase: { division: { tournament: true } } },
            },
        });
        if (!match) throw new NotFoundException(`Match ${matchId} not found`);
        if (!match.matchResult) {
            throw new BadRequestException(`Match ${match.id} has no completed result to report to start.gg`);
        }

        const setMapping = await this.externalMappingRepository.findOne({
            where: {
                provider: 'startgg',
                localType: 'match',
                localId: String(match.id),
                externalType: 'set',
            },
        });
        if (!setMapping) {
            throw new BadRequestException(`Match ${match.id} is not mapped to a start.gg set`);
        }

        const winnerPlayerId = this.resolveWinnerPlayerId(match);
        const winnerEntrant = (match.entrants ?? []).find((entrant) =>
            (entrant.participants ?? []).some((participant) => participant.player?.id === winnerPlayerId),
        );
        if (!winnerEntrant) {
            throw new BadRequestException(`Unable to resolve winning entrant for match ${match.id}`);
        }

        const entrantMappings = await this.resolveStartggEntrantMappings(match);
        const winnerExternalEntrantId = entrantMappings.get(winnerEntrant.id);
        if (!winnerExternalEntrantId) {
            throw new BadRequestException(`Winning entrant ${winnerEntrant.id} is not mapped to a start.gg entrant`);
        }

        const tournament = match.phaseGroup?.phase?.division?.tournament;
        if (!tournament) {
            throw new BadRequestException(`Unable to resolve tournament for match ${match.id}`);
        }

        const startggApiKey = this.getConfiguredStartggApiKey(tournament);
        const result = await this.startggClient.reportBracketSet(
            setMapping.externalId,
            winnerExternalEntrantId,
            startggApiKey,
            this.buildStartggGameData(match, entrantMappings),
        );
        this.logger.log(
            `Reported match ${match.id} to start.gg set ${setMapping.externalId} with winner entrant ${winnerExternalEntrantId}`,
        );
        return result;
    }

    private async buildEventSnapshot(eventSlug: string, startggApiKey: string): Promise<StartggEventSnapshot> {
        const cacheKey = `${eventSlug}:${startggApiKey.slice(-8)}`;
        const cached = this.snapshotCache.get(cacheKey);
        if (cached && cached.expiresAt > Date.now()) {
            this.logger.log(`[timing] buildEventSnapshot cache-hit eventSlug=${eventSlug}`);
            return cached.snapshot;
        }

        const event = await this.timeOperation(
            `buildEventSnapshot.getEventBySlug eventSlug=${eventSlug}`,
            () => this.startggClient.getEventBySlug(eventSlug, startggApiKey),
        );
        const entrants = await this.timeOperation(
            `buildEventSnapshot.getEventEntrants eventId=${event.id}`,
            () => this.startggClient.getEventEntrants(event.id, startggApiKey),
        );

        const phaseRefs = event.phases ?? [];
        const phaseGroupLists = await this.timeOperation(
            `buildEventSnapshot.getPhaseGroups phaseCount=${phaseRefs.length}`,
            () => Promise.all(phaseRefs.map((phase) => this.startggClient.getPhaseGroups(phase.id, startggApiKey))),
        );
        const seedLists = await this.timeOperation(
            `buildEventSnapshot.getPhaseSeeds phaseCount=${phaseRefs.length}`,
            () => Promise.all(phaseRefs.map((phase) => this.startggClient.getPhaseSeeds(phase.id, startggApiKey))),
        );
        const phases = await this.timeOperation(
            `buildEventSnapshot.attachPhaseGroupsAndSeeds phaseCount=${phaseRefs.length}`,
            () => Promise.all(phaseRefs.map(async (phase, index) => {
                const phaseGroups = phaseGroupLists[index] ?? [];
                const setsByPhaseGroupId = await this.getSetsFromPhaseGroups(phaseGroups, startggApiKey);
                return {
                    id: phase.id,
                    name: phase.name,
                    seeds: seedLists[index] ?? [],
                    phaseGroups: phaseGroups.map((phaseGroup) => ({
                        ...phaseGroup,
                        sets: setsByPhaseGroupId.get(phaseGroup.id) ?? [],
                    })),
                };
            })),
        );

        const snapshot: StartggEventSnapshot = {
            id: event.id,
            name: event.name,
            slug: event.slug,
            tournament: event.tournament ?? null,
            entrants,
            phases,
        };

        this.snapshotCache.set(cacheKey, {
            snapshot,
            expiresAt: Date.now() + this.snapshotCacheTtlMs,
        });

        return snapshot;
    }

    private async buildLocalContext(tournamentId: number) {
        const [tournament, divisions, allPlayers, mappings] = await this.timeOperation(
            `buildLocalContext.loadBaseEntities tournamentId=${tournamentId}`,
            () => Promise.all([
                this.tournamentRepository.findOne({
                    where: { id: tournamentId },
                    relations: {
                        participants: {
                            player: true,
                            account: true,
                        },
                    },
                }),
                this.divisionRepository.find({
                    where: { tournament: { id: tournamentId } },
                    relations: {
                        entrants: {
                            participants: {
                                player: true,
                            },
                        },
                        phases: true,
                    },
                }),
                this.playerService.findAll(),
                this.externalMappingRepository.find({ where: { provider: 'startgg' } }),
            ]),
        );

        if (!tournament) throw new NotFoundException(`Tournament ${tournamentId} not found`);

        const participantsById = new Map<number, Participant>((tournament.participants ?? []).map((participant) => [participant.id, participant]));
        const entrants = divisions.flatMap((division) => division.entrants ?? []);
        const phases = divisions.flatMap((division) => division.phases ?? []);
        const matches = await this.timeOperation(
            `buildLocalContext.loadMatches tournamentId=${tournamentId}`,
            () => this.matchRepository.find({
                where: { phaseGroup: { phase: { division: { tournament: { id: tournamentId } } } } },
            }),
        );

        return {
            tournament,
            divisionsById: new Map<number, Division>(divisions.map((division) => [division.id, division])),
            phasesById: new Map<number, Phase>(phases.map((phase) => [phase.id, phase])),
            participantsById,
            entrantsById: new Map<number, Entrant>(entrants.map((entrant) => [entrant.id, entrant])),
            matchesById: new Map<number, Match>(matches.map((match) => [match.id, match])),
            playersByNormalizedName: new Map<string, Player>(allPlayers.map((player) => [this.normalizeName(player.playerName), player])),
            mappings,
        };
    }

    private async resolveStartggApiKey(tournamentId: number): Promise<string> {
        const tournament = await this.tournamentRepository.findOneBy({ id: tournamentId });
        if (!tournament) throw new NotFoundException(`Tournament ${tournamentId} not found`);
        return this.getConfiguredStartggApiKey(tournament);
    }

    private getConfiguredStartggApiKey(tournament: Tournament): string {
        const startggApiKey = tournament.startggApiKey?.trim();
        if (!startggApiKey) {
            throw new ForbiddenException('Configure the start.gg API key before using start.gg integration features.');
        }
        return startggApiKey;
    }

    private async ensureDivision(
        snapshot: StartggEventSnapshot,
        tournamentId: number,
        mappingCache: StartggMappingCache,
    ): Promise<Division> {
        const existingMapping = this.findMappingInCache(mappingCache, 'division', 'event', snapshot.id);

        let division = existingMapping
            ? await this.divisionRepository.findOne({
                where: { id: Number(existingMapping.localId) },
                relations: { tournament: true, entrants: true, phases: true },
            })
            : null;

        if (!division) {
            const dto = new CreateDivisionDto();
            dto.name = snapshot.name;
            dto.tournamentId = tournamentId;
            division = await this.divisionService.create(dto);
        }

        this.cacheMapping(mappingCache, {
            provider: 'startgg',
            localType: 'division',
            localId: String(division.id),
            externalType: 'event',
            externalId: snapshot.id,
            externalSlug: snapshot.slug,
            metadata: {
                tournamentId,
                startggTournamentId: snapshot.tournament?.id ?? null,
            },
        });

        return division;
    }

    private async ensureParticipant(
        tournamentId: number,
        participant: StartggParticipantNode,
        mappingCache: StartggMappingCache,
        playersByNormalizedName: Map<string, Player>,
    ): Promise<Participant> {
        const existingMapping = this.findMappingInCache(mappingCache, 'participant', 'participant', participant.id);

        let localParticipant = existingMapping
            ? await this.participantRepository.findOne({
                where: { id: Number(existingMapping.localId), tournament: { id: tournamentId } },
                relations: { player: true, tournament: true, account: true },
            })
            : null;

        if (!localParticipant) {
            const normalizedName = this.normalizeName(participant.gamerTag);
            const existingPlayer = playersByNormalizedName.get(normalizedName) ?? null;
            const player = existingPlayer ?? await this.playerService.create(participant.gamerTag);
            playersByNormalizedName.set(this.normalizeName(player.playerName), player);
            localParticipant = await this.participantService.ensureForPlayer(tournamentId, player.id, ['competitor']);
        }

        this.cacheMapping(mappingCache, {
            provider: 'startgg',
            localType: 'participant',
            localId: String(localParticipant.id),
            externalType: 'participant',
            externalId: participant.id,
            metadata: {
                gamerTag: participant.gamerTag,
                tournamentId,
            },
        });

        return localParticipant;
    }

    private async ensureEntrant(
        divisionId: number,
        entrant: StartggEntrantNode,
        participantByExternalId: Map<string, Participant>,
        mappingCache: StartggMappingCache,
    ): Promise<Entrant> {
        const existingMapping = this.findMappingInCache(mappingCache, 'entrant', 'entrant', entrant.id);

        let localEntrant = existingMapping
            ? await this.entrantRepository.findOne({
                where: { id: Number(existingMapping.localId), division: { id: divisionId } },
                relations: { participants: { player: true }, division: true },
            })
            : null;

        if (!localEntrant && entrant.participants.length === 1) {
            const participant = participantByExternalId.get(entrant.participants[0].id);
            if (!participant) {
                throw new NotFoundException(`No local participant resolved for start.gg participant ${entrant.participants[0].id}`);
            }
            localEntrant = await this.entrantService.addSinglesEntrant(divisionId, participant.id);
        }

        if (!localEntrant) {
            const division = await this.divisionRepository.findOneBy({ id: divisionId });
            if (!division) throw new NotFoundException(`Division ${divisionId} not found`);

            localEntrant = new Entrant();
            localEntrant.division = division;
            localEntrant.name = entrant.name;
            localEntrant.type = entrant.participants.length > 1 ? 'team' : 'player';
            localEntrant.status = 'active';
            localEntrant.participants = entrant.participants
                .map((participant) => participantByExternalId.get(participant.id))
                .filter(Boolean);
        } else {
            localEntrant.name = entrant.name;
            localEntrant.status = 'active';
            if (entrant.participants.length > 1) {
                localEntrant.type = 'team';
                localEntrant.participants = entrant.participants
                    .map((participant) => participantByExternalId.get(participant.id))
                    .filter(Boolean);
            }
        }

        localEntrant = await this.entrantRepository.save(localEntrant);

        this.cacheMapping(mappingCache, {
            provider: 'startgg',
            localType: 'entrant',
            localId: String(localEntrant.id),
            externalType: 'entrant',
            externalId: entrant.id,
            metadata: {
                divisionId,
                participantExternalIds: entrant.participants.map((participant) => participant.id),
            },
        });

        return localEntrant;
    }

    private async ensurePhase(
        divisionId: number,
        phase: StartggPhaseNode,
        mappingCache: StartggMappingCache,
    ): Promise<Phase> {
        const existingMapping = this.findMappingInCache(mappingCache, 'phase', 'phase', phase.id);

        let localPhase = existingMapping
            ? await this.phaseRepository.findOne({
                where: { id: Number(existingMapping.localId), division: { id: divisionId } },
                relations: { division: true },
            })
            : null;

        if (!localPhase) {
            const dto = new CreatePhaseDto();
            dto.name = phase.name;
            dto.divisionId = divisionId;
            localPhase = await this.phaseService.create(dto);
        }

        this.cacheMapping(mappingCache, {
            provider: 'startgg',
            localType: 'phase',
            localId: String(localPhase.id),
            externalType: 'phase',
            externalId: phase.id,
            metadata: {
                divisionId,
                name: phase.name,
            },
        });

        return localPhase;
    }

    private async ensurePhaseGroup(
        phase: Phase,
        phaseGroup: StartggPhaseGroupNode,
        mappingCache: StartggMappingCache,
    ): Promise<PhaseGroup> {
        const existingMapping = this.findMappingInCache(mappingCache, 'phaseGroup', 'phaseGroup', phaseGroup.id);

        let localPhaseGroup = existingMapping
            ? await this.phaseGroupService.findOne(Number(existingMapping.localId))
            : null;

        if (!localPhaseGroup) {
            localPhaseGroup = await this.phaseGroupService.createForPhase(phase.id, {
                name: phaseGroup.displayIdentifier ?? `Group ${phaseGroup.id}`,
                displayIdentifier: phaseGroup.displayIdentifier ?? null,
                bracketType: this.mapStartggBracketType(phaseGroup.bracketType),
            });
        } else {
            localPhaseGroup = await this.phaseGroupService.update(localPhaseGroup.id, {
                name: phaseGroup.displayIdentifier ?? localPhaseGroup.name,
                displayIdentifier: phaseGroup.displayIdentifier ?? null,
                bracketType: this.mapStartggBracketType(phaseGroup.bracketType),
            });
        }

        this.cacheMapping(mappingCache, {
            provider: 'startgg',
            localType: 'phaseGroup',
            localId: String(localPhaseGroup.id),
            externalType: 'phaseGroup',
            externalId: phaseGroup.id,
            metadata: {
                phaseId: phase.id,
                displayIdentifier: phaseGroup.displayIdentifier ?? null,
                bracketType: phaseGroup.bracketType ?? null,
            },
        });

        return localPhaseGroup;
    }

    private mapStartggBracketType(bracketType?: string | null): string | null {
        switch (bracketType) {
            case 'SINGLE_ELIMINATION':
                return 'SingleElimination';
            case 'DOUBLE_ELIMINATION':
                return 'DoubleElimination';
            case 'ROUND_ROBIN':
                return 'RoundRobin';
            case 'SWISS':
                return 'Swiss';
            case 'CUSTOM_SCHEDULE':
                return 'CustomSchedule';
            default:
                return null;
        }
    }

    private async syncImportedMatches(
        sets: StartggSetNode[],
        phases: StartggPhaseNode[],
        localPhaseGroups: Map<string, PhaseGroup>,
        fallbackPhase: Phase,
        entrantByExternalId: Map<string, Entrant>,
        mappingCache: StartggMappingCache,
        defaultScoringSystem: ScoringSystemType,
    ): Promise<ImportedMatchSyncResult> {
        const existingMatchIds = sets
            .map((set) => this.findMappingInCache(mappingCache, 'match', 'set', set.id)?.localId)
            .filter((id): id is string => Boolean(id))
            .map((id) => Number(id));
        const existingMatches = existingMatchIds.length > 0
            ? await this.matchRepository.find({
                where: { id: In(existingMatchIds) },
                relations: { matchResult: true },
            })
            : [];
        const existingMatchesById = new Map<number, Match>(existingMatches.map((match) => [match.id, match]));
        const matchesBySetId = new Map<string, Match>();
        const touchedPhaseIds = new Set<number>();
        const touchedPhaseGroupIds = new Set<number>();
        const needsFallbackPhaseGroup = sets.some((set) => !set.phaseGroupId || !localPhaseGroups.has(set.phaseGroupId));
        const fallbackPhaseGroup = needsFallbackPhaseGroup
            ? await this.resolveFallbackImportedPhaseGroup(fallbackPhase, localPhaseGroups)
            : null;

        const stagedMatches = await Promise.all(sets.map(async (set) => {
            const existingMapping = this.findMappingInCache(mappingCache, 'match', 'set', set.id);
            const existingMatch = existingMapping
                ? existingMatchesById.get(Number(existingMapping.localId)) ?? null
                : null;
            const targetPhaseGroup = (set.phaseGroupId ? localPhaseGroups.get(set.phaseGroupId) : null)
                ?? fallbackPhaseGroup;
            if (!targetPhaseGroup) {
                throw new NotFoundException(`Could not resolve a local phase group for imported start.gg set ${set.id}`);
            }
            const match = existingMatch ?? this.matchRepository.create();

            match.name = this.buildMatchName(set);
            match.subtitle = set.phaseGroupName ?? null;
            match.notes = `Imported from start.gg set ${set.id}`;
            match.scoringSystem = defaultScoringSystem;
            match.phaseGroup = targetPhaseGroup;
            match.entrants = set.entrants
                .map((entrant) => entrantByExternalId.get(entrant.id))
                .filter((entrant): entrant is Entrant => Boolean(entrant));
            touchedPhaseIds.add(targetPhaseGroup.phase.id);
            touchedPhaseGroupIds.add(targetPhaseGroup.id);
            matchesBySetId.set(set.id, match);
            return match;
        }));

        const savedMatches = await this.matchRepository.save(stagedMatches, { chunk: this.bulkSaveChunkSize });
        savedMatches.forEach((match, index) => matchesBySetId.set(sets[index].id, match));

        for (const set of sets) {
            const localMatch = matchesBySetId.get(set.id);
            if (!localMatch) continue;

            this.cacheMapping(mappingCache, {
                provider: 'startgg',
                localType: 'match',
                localId: String(localMatch.id),
                externalType: 'set',
                externalId: set.id,
                metadata: {
                    phaseExternalId: set.phaseId ?? null,
                    entrantExternalIds: set.entrants.map((entrant) => entrant.id),
                },
            });
        }

        const resultIdsToDelete = new Set<number>();
        const savedMatchIds = Array.from(matchesBySetId.values()).map((match) => match.id);
        for (const matchId of savedMatchIds) {
            await this.advancementRuleService.deleteBySource('match', matchId);
        }
        const savedPhaseGroupIds = Array.from(new Set(Array.from(localPhaseGroups.values()).map((phaseGroup) => phaseGroup.id)));
        for (const phaseGroupId of savedPhaseGroupIds) {
            await this.advancementRuleService.deleteBySource('phase_group', phaseGroupId);
        }
        await this.createPhaseGroupProgressionRules(phases, localPhaseGroups);

        for (const set of sets) {
            const localMatch = matchesBySetId.get(set.id);
            if (!localMatch) continue;

            for (const [slotIndex, slot] of (set.slots ?? []).entries()) {
                if (!slot.prereqType || !slot.prereqId) {
                    continue;
                }

                const sourcePlacement = slot.prereqPlacement ?? 1;
                if (sourcePlacement < 1) {
                    continue;
                }

                const normalizedPrereqType = this.normalizePrereqType(slot.prereqType);
                if (normalizedPrereqType === 'set') {
                    const sourceMatch = matchesBySetId.get(slot.prereqId);
                    if (!sourceMatch) continue;

                    await this.advancementRuleService.createMatchToMatchRule(
                        sourceMatch.id,
                        sourcePlacement,
                        localMatch.id,
                        slotIndex + 1,
                    );
                    continue;
                }

                if (normalizedPrereqType === 'phasegroup') {
                    const sourcePhaseGroup = localPhaseGroups.get(slot.prereqId);
                    if (!sourcePhaseGroup) continue;

                    await this.advancementRuleService.create({
                        sourceKind: 'phase_group',
                        sourceId: sourcePhaseGroup.id,
                        sourcePlacement,
                        targetKind: 'match',
                        targetId: localMatch.id,
                        targetSlot: slotIndex + 1,
                    });
                }
            }

            if (!this.isStartggSetCompleted(set)) {
                if (localMatch.matchResult?.id) {
                    resultIdsToDelete.add(localMatch.matchResult.id);
                }
                localMatch.matchResult = null;
                localMatch.active = false;
                continue;
            }

            const playerPoints = this.buildImportedPlayerPoints(set, entrantByExternalId);
            if (playerPoints.length === 0) {
                if (localMatch.matchResult?.id) {
                    resultIdsToDelete.add(localMatch.matchResult.id);
                }
                localMatch.matchResult = null;
                localMatch.active = false;
                continue;
            }

            const matchResult = localMatch.matchResult ?? this.matchResultRepository.create();
            matchResult.playerPoints = playerPoints;
            matchResult.match = localMatch;
            localMatch.matchResult = matchResult;
            localMatch.active = false;
        }

        await this.matchRepository.save(Array.from(matchesBySetId.values()), { chunk: this.bulkSaveChunkSize });

        if (resultIdsToDelete.size > 0) {
            await this.matchResultRepository.delete(Array.from(resultIdsToDelete));
        }

        return {
            matchesBySetId,
            touchedPhaseIds,
            touchedPhaseGroupIds,
        };
    }

    private async resolveFallbackImportedPhaseGroup(
        fallbackPhase: Phase,
        localPhaseGroups: Map<string, PhaseGroup>,
    ): Promise<PhaseGroup> {
        const fallbackKey = `fallback:${fallbackPhase.id}`;
        const cached = localPhaseGroups.get(fallbackKey);
        if (cached) return cached;

        const existing = await this.phaseGroupService.findDefaultForPhase(fallbackPhase.id);
        const phaseGroup = existing ?? await this.phaseGroupService.createForPhase(fallbackPhase.id, {
            name: `${fallbackPhase.name} Matches`,
            displayIdentifier: null,
            bracketType: null,
        });
        localPhaseGroups.set(fallbackKey, phaseGroup);
        return phaseGroup;
    }

    private async createPhaseGroupProgressionRules(
        phases: StartggPhaseNode[],
        localPhaseGroups: Map<string, PhaseGroup>,
    ): Promise<void> {
        const createdKeys = new Set<string>();

        for (const phase of phases) {
            for (const seed of phase.seeds ?? []) {
                const source = seed.progressionSource;
                if (!source?.originPhaseGroupId || !source.originPlacement || !seed.phaseGroupId) {
                    continue;
                }

                const sourcePhaseGroup = localPhaseGroups.get(source.originPhaseGroupId);
                const targetPhaseGroup = localPhaseGroups.get(seed.phaseGroupId);
                const targetSlot = seed.groupSeedNum ?? seed.seedNum;
                if (!sourcePhaseGroup || !targetPhaseGroup || !targetSlot) {
                    continue;
                }

                const key = `${sourcePhaseGroup.id}:${source.originPlacement}:${targetPhaseGroup.id}:${targetSlot}`;
                if (createdKeys.has(key)) {
                    continue;
                }
                createdKeys.add(key);

                await this.advancementRuleService.create({
                    sourceKind: 'phase_group',
                    sourceId: sourcePhaseGroup.id,
                    sourcePlacement: source.originPlacement,
                    targetKind: 'phase_group',
                    targetId: targetPhaseGroup.id,
                    targetSlot,
                });
            }
        }
    }

    private buildImportedPlayerPoints(
        set: StartggSetNode,
        entrantByExternalId: Map<string, Entrant>,
    ): Array<{ playerId: number; points: number }> {
        return (set.slots ?? [])
            .filter((slot) => slot.entrant?.id)
            .map((slot) => {
                const localEntrant = entrantByExternalId.get(slot.entrant!.id);
                const playerId = localEntrant?.participants?.[0]?.player?.id;
                if (!playerId) {
                    return null;
                }

                return {
                    playerId,
                    points: slot.standing?.score ?? 0,
                    placement: slot.standing?.placement ?? Number.MAX_SAFE_INTEGER,
                };
            })
            .filter((entry): entry is { playerId: number; points: number; placement: number } => Boolean(entry))
            .sort((left, right) => left.placement - right.placement || right.points - left.points || left.playerId - right.playerId)
            .map(({ playerId, points }) => ({ playerId, points }));
    }

    private resolveWinnerPlayerId(match: Match): number {
        const winner = [...(match.matchResult?.playerPoints ?? [])]
            .sort((left, right) => right.points - left.points || left.playerId - right.playerId)[0];
        if (!winner?.playerId) {
            throw new BadRequestException(`Match ${match.id} result does not contain a winner`);
        }

        return winner.playerId;
    }

    private async resolveStartggEntrantMappings(match: Match): Promise<Map<number, string>> {
        const mappings = new Map<number, string>();

        for (const entrant of match.entrants ?? []) {
            const mapping = await this.externalMappingRepository.findOne({
                where: {
                    provider: 'startgg',
                    localType: 'entrant',
                    localId: String(entrant.id),
                    externalType: 'entrant',
                },
            });
            if (mapping) {
                mappings.set(entrant.id, mapping.externalId);
            }
        }

        return mappings;
    }

    private buildStartggGameData(
        match: Match,
        entrantMappings: Map<number, string>,
    ): StartggBracketSetGameDataInput[] | undefined {
        const entrants = match.entrants ?? [];
        if (entrants.length !== 2 || (match.rounds?.length ?? 0) === 0) {
            return undefined;
        }

        const entrantInfos = entrants.map((entrant) => ({
            entrant,
            playerId: entrant.participants?.[0]?.player?.id,
            externalEntrantId: entrantMappings.get(entrant.id),
        }));
        if (entrantInfos.some((info) => !info.playerId || !info.externalEntrantId)) {
            throw new BadRequestException(`Match ${match.id} cannot report game data because entrant mappings are incomplete`);
        }

        return [...(match.rounds ?? [])]
            .sort((left, right) => left.id - right.id)
            .map((round, index) => {
                const entrant1Score = this.getRoundPointsForPlayer(round, entrantInfos[0].playerId!);
                const entrant2Score = this.getRoundPointsForPlayer(round, entrantInfos[1].playerId!);
                const winnerId = entrant1Score >= entrant2Score
                    ? entrantInfos[0].externalEntrantId!
                    : entrantInfos[1].externalEntrantId!;

                return {
                    winnerId,
                    gameNum: index + 1,
                    entrant1Score,
                    entrant2Score,
                };
            });
    }

    private getRoundPointsForPlayer(round: Match['rounds'][number], playerId: number): number {
        const standing = (round.standings ?? []).find((candidate) => candidate.score?.player?.id === playerId);
        return Number(standing?.points ?? 0);
    }

    private isStartggSetCompleted(set: StartggSetNode): boolean {
        return set.state === 3
            || set.state === 'COMPLETED'
            || typeof set.completedAt === 'number'
            || Boolean(set.winnerId);
    }

    private normalizePrereqType(prereqType: string): string {
        return prereqType.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    }

    private async getSetsFromPhaseGroups(phaseGroups: StartggPhaseGroupNode[], startggApiKey: string): Promise<Map<string, StartggSetNode[]>> {
        const setLists = await Promise.all(
            phaseGroups.map((phaseGroup) =>
                this.timeOperation(
                    `getSetsFromPhaseGroups phaseGroupId=${phaseGroup.id}`,
                    () => this.startggClient.getPhaseGroupSets(phaseGroup, startggApiKey),
                ),
            ),
        );

        return new Map<string, StartggSetNode[]>(
            phaseGroups.map((phaseGroup, index) => [
                phaseGroup.id,
                this.uniqueBy(setLists[index] ?? [], (set) => set.id),
            ]),
        );
    }

    private buildSeedMap(snapshot: StartggEventSnapshot): Map<string, number> {
        const seedByEntrantId = new Map<string, number>();
        for (const phase of snapshot.phases) {
            for (const seed of phase.seeds) {
                const entrantId = seed.entrantId;
                if (!entrantId) continue;
                const existing = seedByEntrantId.get(entrantId);
                if (existing === undefined || seed.seedNum < existing) {
                    seedByEntrantId.set(entrantId, seed.seedNum);
                }
            }
        }
        return seedByEntrantId;
    }

    private getSnapshotSets(snapshot: StartggEventSnapshot): StartggSetNode[] {
        return snapshot.phases.flatMap((phase) =>
            phase.phaseGroups.flatMap((phaseGroup) => phaseGroup.sets ?? []),
        );
    }

    private getEffectiveRemotePhases(snapshot: StartggEventSnapshot): StartggPhaseNode[] {
        const phases = [...snapshot.phases];
        const knownIds = new Set(phases.map((phase) => phase.id));

        for (const set of this.getSnapshotSets(snapshot)) {
            if (set.phaseId && !knownIds.has(set.phaseId)) {
                phases.push({
                    id: set.phaseId,
                    name: set.phaseName ?? `Phase ${set.phaseId}`,
                    seeds: [],
                    phaseGroups: [],
                });
                knownIds.add(set.phaseId);
            }
        }

        if (phases.length === 0) {
            phases.push({
                id: `event:${snapshot.id}:default-phase`,
                name: `${snapshot.name} Imported Phase`,
                seeds: [],
                phaseGroups: [],
            });
        }

        return phases;
    }

    private buildMatchName(set: StartggSetNode): string {
        return set.fullRoundText?.trim() || `start.gg Set ${set.id}`;
    }

    private createMappingCache(mappings: ExternalMapping[]): StartggMappingCache {
        const byExternalKey = new Map<string, ExternalMapping>();

        for (const mapping of mappings) {
            byExternalKey.set(this.getMappingExternalKey(mapping.localType, mapping.externalType, mapping.externalId), mapping);
        }

        return {
            byExternalKey,
            dirtyByExternalKey: new Map<string, ExternalMapping>(),
        };
    }

    private findMappingInCache(
        mappingCache: StartggMappingCache,
        localType: ExternalMapping['localType'],
        externalType: ExternalMapping['externalType'],
        externalId: string,
    ): ExternalMapping | null {
        return mappingCache.byExternalKey.get(this.getMappingExternalKey(localType, externalType, externalId)) ?? null;
    }

    private cacheMapping(mappingCache: StartggMappingCache, partial: Partial<ExternalMapping>): ExternalMapping {
        if (!partial.provider || !partial.localType || !partial.localId || !partial.externalType || !partial.externalId) {
            throw new NotFoundException('Cannot cache external mapping without provider, types, and ids');
        }

        const key = this.getMappingExternalKey(partial.localType, partial.externalType, partial.externalId);
        const existing = mappingCache.byExternalKey.get(key) ?? null;

        const mapping = existing
            ? Object.assign(existing, {
                localId: partial.localId,
                externalSlug: partial.externalSlug ?? existing.externalSlug ?? null,
                metadata: {
                    ...(existing.metadata ?? {}),
                    ...(partial.metadata ?? {}),
                },
            })
            : this.externalMappingRepository.create({
                provider: partial.provider,
                localType: partial.localType,
                localId: partial.localId,
                externalType: partial.externalType,
                externalId: partial.externalId,
                externalSlug: partial.externalSlug ?? null,
                metadata: partial.metadata ?? null,
            });

        mappingCache.byExternalKey.set(key, mapping);
        mappingCache.dirtyByExternalKey.set(key, mapping);
        return mapping;
    }

    private async flushMappingCache(mappingCache: StartggMappingCache): Promise<void> {
        if (mappingCache.dirtyByExternalKey.size === 0) {
            return;
        }

        await this.externalMappingRepository.save(Array.from(mappingCache.dirtyByExternalKey.values()));
        mappingCache.dirtyByExternalKey.clear();
    }

    private getMappingExternalKey(
        localType: ExternalMapping['localType'],
        externalType: ExternalMapping['externalType'],
        externalId: string,
    ): string {
        return `${localType}:${externalType}:${externalId}`;
    }

    private findMappingInList(
        mappings: ExternalMapping[],
        localType: ExternalMapping['localType'],
        externalType: ExternalMapping['externalType'],
        externalId: string,
    ): ExternalMapping | null {
        return mappings.find((mapping) =>
            mapping.localType === localType &&
            mapping.externalType === externalType &&
            mapping.externalId === externalId,
        ) ?? null;
    }

    private findMappedLocalEntity<T extends { id: number }>(
        mappings: ExternalMapping[],
        localType: ExternalMapping['localType'],
        externalType: ExternalMapping['externalType'],
        externalId: string,
        entities: Map<number, T>,
    ): T | null {
        const mapping = this.findMappingInList(mappings, localType, externalType, externalId);
        if (!mapping) return null;
        return entities.get(Number(mapping.localId)) ?? null;
    }

    private uniqueBy<T>(items: T[], keyFn: (item: T) => string): T[] {
        const seen = new Set<string>();
        const result: T[] = [];

        for (const item of items) {
            const key = keyFn(item);
            if (seen.has(key)) continue;
            seen.add(key);
            result.push(item);
        }

        return result;
    }

    private async timeOperation<T>(label: string, operation: () => Promise<T>): Promise<T> {
        const startedAt = Date.now();
        this.logger.log(`[timing] start ${label}`);
        try {
            const result = await operation();
            this.logger.log(`[timing] complete ${label} durationMs=${Date.now() - startedAt}`);
            return result;
        } catch (error) {
            this.logger.error(
                `[timing] failed ${label} durationMs=${Date.now() - startedAt}`,
                error instanceof Error ? error.stack : undefined,
            );
            throw error;
        }
    }

    private timeSyncOperation<T>(label: string, operation: () => T): T {
        const startedAt = Date.now();
        const result = operation();
        this.logger.log(`[timing] complete ${label} durationMs=${Date.now() - startedAt}`);
        return result;
    }

    private normalizeName(value: string): string {
        return value.trim().toLowerCase();
    }

    private async assertCanEditTournament(tournamentId: number, user?: AuthUser): Promise<void> {
        if (!user?.id) {
            throw new ForbiddenException('Authentication required');
        }
        if (user.isAdmin) return;

        const canEdit = await this.participantService.canEdit(tournamentId, user.id);
        if (!canEdit) {
            throw new ForbiddenException(`Account ${user.id} cannot edit tournament ${tournamentId}`);
        }
    }
}
