import { Controller, Get } from '@nestjs/common';
import { BracketManager } from '@bracket/bracket.manager';

@Controller('bracket')
export class BracketController {
    constructor(
        private readonly bracketManager: BracketManager,
    ) {}

    @Get('bracket-types')
    getBracketTypes(): string[] {
        return this.bracketManager.getBracketTypes();
    }
}
