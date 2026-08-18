import { Phase } from "@/features/division/types/Phase";
import { Entrant } from "@/features/entrant/types/Entrant";

export interface Division {
  id: number;
  name: string;
  phases: Phase[];
  entrants: Entrant[];
}
