import type { TrainingProgramRecord, TrainingProgramStatus, TrainingProgramWriteInput } from "./trainingProgramDomain";

export interface TrainingProgramRepository {
  listPrograms(): Promise<TrainingProgramRecord[]>;
  findById(id: string): Promise<TrainingProgramRecord | null>;
  createProgram(input: TrainingProgramWriteInput & { id: string; createdByUserId: string; itemIds: string[] }): Promise<TrainingProgramRecord>;
  updateDraftProgram(id: string, expectedUpdatedAt: string, input: TrainingProgramWriteInput & { itemIds: string[] }): Promise<TrainingProgramRecord | null>;
  transitionProgram(id: string, from: TrainingProgramStatus, to: TrainingProgramStatus, expectedUpdatedAt?: string): Promise<TrainingProgramRecord | null>;
  deleteDraftProgram(id: string): Promise<boolean>;
}
