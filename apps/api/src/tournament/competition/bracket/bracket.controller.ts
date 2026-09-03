import { Controller, Get } from '@nestjs/common';
import type { BracketType } from '@tournament-manager/brackets';

import { BracketCommands } from '@bracket/bracket.commands';

/**
 * What the interface offers when somebody generates a bracket.
 *
 * Generating one is a command on Division, which is the aggregate a generated
 * structure belongs to, so what is left here is the list of shapes. It answers
 * with identifiers, not labels: the words a person reads belong to whoever is
 * drawing the list.
 */
@Controller('bracket')
export class BracketController {
    constructor(private readonly bracketSystems: BracketCommands) {}

    @Get('bracket-types')
    getBracketTypes(): BracketType[] {
        return this.bracketSystems.getAll();
    }
}
