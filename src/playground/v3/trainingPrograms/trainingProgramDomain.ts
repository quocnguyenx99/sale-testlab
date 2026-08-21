import type { SimulationMode } from "../simulationSession";

export const TRAINING_PROGRAM_STATUSES = ["DRAFT", "PUBLISHED", "ARCHIVED"] as const;
export type TrainingProgramStatus = typeof TRAINING_PROGRAM_STATUSES[number];

export interface TrainingProgramItemInput {
  personaId: string;
  scenarioId: string;
  mode: SimulationMode;
  sortOrder: number;
}

export interface TrainingProgramItemRecord extends TrainingProgramItemInput {
  id: string;
  programId: string;
  createdAt: string;
  updatedAt: string;
}

export interface TrainingProgramRecord {
  id: string;
  name: string;
  description: string | null;
  status: TrainingProgramStatus;
  createdByUserId: string;
  createdBy: { id: string; displayName: string };
  createdAt: string;
  updatedAt: string;
  items: TrainingProgramItemRecord[];
}

export interface TrainingProgramWriteInput {
  name: string;
  description: string | null;
  items: TrainingProgramItemInput[];
}

export interface TrainingProgramCatalogSelection {
  personaId: string;
  personaLabel: string;
  scenarioId: string;
  scenarioLabel: string;
}

export interface TrainingProgramCatalog {
  resolve(personaId: string, scenarioId: string): TrainingProgramCatalogSelection | null;
}
