import {
  BadRequestException,
  CanActivate,
  ConflictException,
  ExecutionContext,
  Injectable,
  NotFoundException,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { DataSource } from 'typeorm';

export type TournamentEntityReference =
  | 'tournament'
  | 'division'
  | 'phase'
  | 'phase-group'
  | 'match'
  | 'song'
  | 'advancement-source';

export interface TournamentMutationReference {
  entity: TournamentEntityReference;
  location: 'params' | 'body';
  field: string;
}

const TOURNAMENT_MUTATION_REFERENCE = 'tournamentMutationReference';

export const RequireOpenTournament = (reference: TournamentMutationReference) =>
  SetMetadata(TOURNAMENT_MUTATION_REFERENCE, reference);

@Injectable()
export class TournamentOpenGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly dataSource: DataSource,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const reference = this.reflector.get<TournamentMutationReference>(
      TOURNAMENT_MUTATION_REFERENCE,
      context.getHandler(),
    );
    if (!reference) return true;

    const request = context.switchToHttp().getRequest();
    const rawId = request[reference.location]?.[reference.field];
    const entityId = Number(rawId);
    if (!Number.isInteger(entityId)) {
      throw new BadRequestException(
        `Cannot resolve tournament from ${reference.location}.${reference.field}`,
      );
    }

    const tournamentId = await this.resolveTournamentId(
      reference.entity,
      entityId,
      request.params,
    );
    if (tournamentId === null) {
      throw new NotFoundException(
        `Cannot resolve a tournament for ${reference.entity} ${entityId}`,
      );
    }

    const rows: Array<{ status: string }> = await this.dataSource.query(
      `SELECT status FROM tournament WHERE id = $1`,
      [tournamentId],
    );
    if (rows.length === 0) {
      throw new NotFoundException(
        `Tournament with id ${tournamentId} not found`,
      );
    }
    if (rows[0].status === 'closed') {
      throw new ConflictException(
        `Tournament with id ${tournamentId} is closed and must be reopened before it can be modified`,
      );
    }
    request.tournamentId = tournamentId;
    return true;
  }

  private async resolveTournamentId(
    entity: TournamentEntityReference,
    entityId: number,
    params: Record<string, string>,
  ): Promise<number | null> {
    if (entity === 'tournament') return entityId;
    if (entity === 'advancement-source') {
      const sourceKind = params.sourceKind;
      if (sourceKind === 'match') return this.queryMatch(entityId);
      if (sourceKind === 'phase_group') return this.queryPhaseGroup(entityId);
      throw new BadRequestException(
        `Unsupported advancement source ${sourceKind}`,
      );
    }

    const queries: Record<
      Exclude<TournamentEntityReference, 'tournament' | 'advancement-source'>,
      string
    > = {
      division: `SELECT "tournamentId" AS id FROM division WHERE id = $1`,
      phase: `SELECT d."tournamentId" AS id FROM phase p JOIN division d ON d.id = p."divisionId" WHERE p.id = $1`,
      'phase-group': `SELECT d."tournamentId" AS id FROM phase_group pg JOIN phase p ON p.id = pg."phaseId" JOIN division d ON d.id = p."divisionId" WHERE pg.id = $1`,
      match: `SELECT d."tournamentId" AS id FROM "match" m JOIN phase_group pg ON pg.id = m."phaseGroupId" JOIN phase p ON p.id = pg."phaseId" JOIN division d ON d.id = p."divisionId" WHERE m.id = $1`,
      song: `SELECT "tournamentId" AS id FROM song WHERE id = $1`,
    };
    return this.queryId(queries[entity], entityId);
  }

  private queryMatch(id: number): Promise<number | null> {
    return this.resolveTournamentId('match', id, {});
  }

  private queryPhaseGroup(id: number): Promise<number | null> {
    return this.resolveTournamentId('phase-group', id, {});
  }

  private async queryId(query: string, id: number): Promise<number | null> {
    const rows: Array<{ id: number | null }> = await this.dataSource.query(
      query,
      [id],
    );
    return rows[0]?.id ?? null;
  }
}
