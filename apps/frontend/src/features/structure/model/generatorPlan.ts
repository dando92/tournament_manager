import { BracketGeneratorProvider, type BracketPlan, type BracketType } from "@tournament-manager/brackets";
import type { PlanNode, PlanRoute, StructurePlan } from "@tournament-manager/contracts";

/**
 * A bracket, as a plan the canvas can draw and the applier can write.
 *
 * The generator is the same pure function the API runs, so the dashed column on
 * screen is not an illustration of what will be written — it is computed from
 * the same code, with the same inputs, and pressing Create sends it.
 */

export type GenerateRequest = {
    tournamentId: number;
    divisionId: number;
    structureVersion: number;
    /** The phase to build in, or a name for the one the bracket brings with it. */
    phaseId?: number;
    phaseName: string;
    poolName: string;
    bracketType: BracketType;
    playerPerMatch: number;
};

const generators = new BracketGeneratorProvider();

export function bracketTypes(): BracketType[] {
    return generators.getAll();
}

export function generateBracketPlan(request: GenerateRequest, entrantCount: number): { plan: StructurePlan; bracket: BracketPlan } | null {
    const generator = generators.getGenerator(request.bracketType);
    if (!generator) {
        return null;
    }

    const bracket = generator.generate({ entrantCount, playerPerMatch: request.playerPerMatch });
    const nodes: PlanNode[] = [];

    const divisionLocalId = "division";
    nodes.push({ localId: divisionLocalId, kind: "division", action: "link", localRowId: request.divisionId, name: "" });

    const phaseLocalId = "phase";
    nodes.push({
        localId: phaseLocalId,
        kind: "phase",
        parentLocalId: divisionLocalId,
        action: request.phaseId ? "link" : "create",
        localRowId: request.phaseId ?? null,
        name: request.phaseName,
    });

    const poolLocalId = "pool";
    nodes.push({
        localId: poolLocalId,
        kind: "phaseGroup",
        parentLocalId: phaseLocalId,
        action: "create",
        name: request.poolName,
        bracketType: request.bracketType,
    });

    for (const match of bracket.matches) {
        nodes.push({
            localId: match.localId,
            kind: "match",
            parentLocalId: poolLocalId,
            action: "create",
            name: match.name,
        });
    }

    const routes: PlanRoute[] = bracket.routes.map((route) => ({
        sourceLocalId: route.sourceMatchLocalId,
        sourcePlacement: route.sourcePlacement,
        targetLocalId: route.targetMatchLocalId,
        targetSlot: route.targetSlot,
    }));

    return {
        bracket,
        plan: {
            tournamentId: request.tournamentId,
            source: { kind: "generator", bracketType: request.bracketType, playerPerMatch: request.playerPerMatch },
            basedOn: [{ divisionId: request.divisionId, structureVersion: request.structureVersion }],
            nodes,
            routes,
        },
    };
}

/** A plan of one node, which is what a dashed slot makes. */
export function singleNodePlan(tournamentId: number, node: PlanNode, parents: PlanNode[] = []): StructurePlan {
    return {
        tournamentId,
        source: { kind: "manual" },
        basedOn: [],
        nodes: [...parents, node],
        routes: [],
    };
}

/** A plan carrying one route, which is what drawing one makes. */
export function routePlan(tournamentId: number, nodes: PlanNode[], route: PlanRoute): StructurePlan {
    return { tournamentId, source: { kind: "manual" }, basedOn: [], nodes, routes: [route] };
}
