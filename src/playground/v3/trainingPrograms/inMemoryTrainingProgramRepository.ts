import type { TrainingProgramRecord, TrainingProgramStatus, TrainingProgramWriteInput } from "./trainingProgramDomain";
import type { TrainingProgramRepository } from "./trainingProgramRepository";

export class InMemoryTrainingProgramRepository implements TrainingProgramRepository {
  private readonly programs = new Map<string, TrainingProgramRecord>();
  private tick = 0;

  constructor(private readonly creators: Record<string, string> = {}) {}

  async listPrograms(): Promise<TrainingProgramRecord[]> {
    return [...this.programs.values()]
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id))
      .map(clone);
  }

  async findById(id: string): Promise<TrainingProgramRecord | null> {
    const program = this.programs.get(id);
    return program ? clone(program) : null;
  }

  async createProgram(input: TrainingProgramWriteInput & { id: string; createdByUserId: string; itemIds: string[] }): Promise<TrainingProgramRecord> {
    const now = this.timestamp();
    const program: TrainingProgramRecord = {
      id: input.id,
      name: input.name,
      description: input.description,
      status: "DRAFT",
      createdByUserId: input.createdByUserId,
      createdBy: { id: input.createdByUserId, displayName: this.creators[input.createdByUserId] ?? "Người quản lý" },
      createdAt: now,
      updatedAt: now,
      items: input.items.map((item, index) => ({
        id: input.itemIds[index], programId: input.id, ...item, createdAt: now, updatedAt: now
      }))
    };
    this.programs.set(program.id, program);
    return clone(program);
  }

  async updateDraftProgram(id: string, expectedUpdatedAt: string, input: TrainingProgramWriteInput & { itemIds: string[] }): Promise<TrainingProgramRecord | null> {
    const current = this.programs.get(id);
    if (!current || current.status !== "DRAFT" || current.updatedAt !== expectedUpdatedAt) return null;
    const updatedAt = this.timestamp();
    const next: TrainingProgramRecord = {
      ...current,
      name: input.name,
      description: input.description,
      updatedAt,
      items: input.items.map((item, index) => ({
        id: input.itemIds[index], programId: id, ...item, createdAt: updatedAt, updatedAt
      }))
    };
    this.programs.set(id, next);
    return clone(next);
  }

  async transitionProgram(id: string, from: TrainingProgramStatus, to: TrainingProgramStatus, expectedUpdatedAt?: string): Promise<TrainingProgramRecord | null> {
    const current = this.programs.get(id);
    if (!current || current.status !== from || (expectedUpdatedAt && current.updatedAt !== expectedUpdatedAt)) return null;
    const next = { ...current, status: to, updatedAt: this.timestamp() };
    this.programs.set(id, next);
    return clone(next);
  }

  async deleteDraftProgram(id: string): Promise<boolean> {
    const current = this.programs.get(id);
    if (!current || current.status !== "DRAFT") return false;
    return this.programs.delete(id);
  }

  private timestamp(): string {
    this.tick += 1;
    return new Date(Date.UTC(2026, 7, 21, 0, 0, 0, this.tick)).toISOString();
  }
}

function clone(program: TrainingProgramRecord): TrainingProgramRecord {
  return structuredClone(program);
}
