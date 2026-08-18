import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Round, Score, Standing } from '@persistence/entities';
import { CreateStandingDto, UpdateStandingDto } from './standing.dto';

@Injectable()
export class StandingService {
    constructor(
        @InjectRepository(Standing)
        private readonly standingRepo: Repository<Standing>,
        @InjectRepository(Score)
        private readonly scoreRepo: Repository<Score>,
        @InjectRepository(Round)
        private readonly roundRepo: Repository<Round>,
    ) {}

    async create(dto: CreateStandingDto): Promise<Standing> {
        const score = await this.scoreRepo.findOne({
            where: { id: dto.scoreId },
            relations: {
                player: true,
                song: true,
            },
        });
        if (!score) throw new NotFoundException(`Score with id ${dto.scoreId} not found. Insert standing failed`);

        const round = await this.roundRepo.findOneBy({ id: dto.roundId });
        if (!round) throw new NotFoundException(`Round with id ${dto.roundId} not found. Insert standing failed`);

        const newStanding = new Standing();
        newStanding.score = score;
        newStanding.round = round;
        newStanding.points = dto.points;

        await this.standingRepo.save(newStanding);
        return newStanding;
    }

    async update(id: number, dto: UpdateStandingDto): Promise<Standing> {
        const standing = await this.standingRepo.findOneBy({ id });
        if (!standing) throw new NotFoundException(`Standing with id ${id} not found. Update standing failed`);

        if (dto.scoreId) {
            const updatedScore = await this.scoreRepo.findOne({
                where: { id: dto.scoreId },
                relations: {
                    player: true,
                    song: true,
                },
            });
            if (!updatedScore) throw new NotFoundException(`Score with id ${dto.scoreId} not found. Update standing failed`);
            dto.score = updatedScore;
            delete dto.scoreId;
        }

        if (dto.roundId) {
            const updatedRound = await this.roundRepo.findOneBy({ id: dto.roundId });
            if (!updatedRound) throw new NotFoundException(`Round with id ${dto.roundId} not found. Update standing failed`);
            dto.round = updatedRound;
            delete dto.roundId;
        }

        this.standingRepo.merge(standing, dto);
        return await this.standingRepo.save(standing);
    }

    async delete(id: number): Promise<void> {
        await this.standingRepo.delete(id);
    }
}
