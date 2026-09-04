import { Type } from 'class-transformer';
import { IsArray, IsInt, IsObject, IsOptional, ValidateNested } from 'class-validator';
import type { PlanBasis, PlanNode, PlanRoute, PlanSlot, PlanSource, StructurePlan } from '@tournament-manager/contracts';

/**
 * The envelope of a plan, checked by the pipe.
 *
 * What is inside a node is not: a plan is a graph, and the reasons it can be
 * wrong are relationships between nodes rather than the shape of one field.
 * Those are `validateStructurePlan`, which answers with every reason at once
 * instead of the first property the pipe happened to reach.
 */
export class ApplyStructurePlanDto implements StructurePlan {
    @IsInt()
    tournamentId: number;

    @IsObject()
    source: PlanSource;

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => Object)
    basedOn: PlanBasis[];

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => Object)
    nodes: PlanNode[];

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => Object)
    routes: PlanRoute[];

    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => Object)
    clearedSlots?: PlanSlot[];
}
