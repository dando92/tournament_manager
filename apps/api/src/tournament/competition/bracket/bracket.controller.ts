import { Controller, Get } from '@nestjs/common';
import { BracketCommands } from '@bracket/bracket.commands';

/**
 * What the interface offers when somebody generates a bracket.
 *
 * Generating one is a command on Division, which is the aggregate a generated
 * structure belongs to, so what is left here is the list of systems.
 */
@Controller('bracket')
export class BracketController {
    constructor(
        private readonly bracketSystems: BracketCommands,
    ) {}

    @Get('bracket-types')
    getBracketTypes(): string[] {
        return this.bracketSystems.getAll();
    }
}
