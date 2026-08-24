import type { SimulationMode } from "../simulationSession";

export const TRAINING_PROGRAM_STATUSES = ["DRAFT", "PUBLISHED", "ARCHIVED"] as const;
export type TrainingProgramStatus = typeof TRAINING_PROGRAM_STATUSES[number];

export interface TrainingProgramItemInput {
  personaId: string;
  scenarioId: string;
  personaVersionId?: string;
  scenarioVersionId?: string;
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
  personaVersionId?: string;
  personaVersion?: number;
  scenarioVersionId?: string;
  scenarioVersion?: number;
}

export interface TrainingProgramCatalog {
  resolve(personaId: string, scenarioId: string, personaVersionId?: string | null, scenarioVersionId?: string | null): TrainingProgramCatalogSelection | null | Promise<TrainingProgramCatalogSelection | null>;
}
