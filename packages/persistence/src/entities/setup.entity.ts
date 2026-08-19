import { 
  Entity, 
  Column,
  PrimaryGeneratedColumn, 
  OneToMany } from 'typeorm';

import { MatchAssignment } from './match_assignment.entity';


@Entity()
export class Setup {
  @PrimaryGeneratedColumn()
  id: number;
  
  @Column()
  name:string;

  @Column()
  cabinetName:string;

  @Column()
  position:number;

  @OneToMany(() => MatchAssignment, (matchAssignment) => matchAssignment.setup, { eager: true })
  matchAssignments:MatchAssignment[];
}