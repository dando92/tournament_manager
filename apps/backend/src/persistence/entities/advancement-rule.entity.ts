import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

export type AdvancementCompetitionKind = 'match' | 'phase_group';

@Entity()
export class AdvancementRule {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar' })
  sourceKind: AdvancementCompetitionKind;

  @Column()
  sourceId: number;

  @Column()
  sourcePlacement: number;

  @Column({ type: 'varchar' })
  targetKind: AdvancementCompetitionKind;

  @Column()
  targetId: number;

  @Column()
  targetSlot: number;
}
