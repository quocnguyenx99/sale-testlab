import { Prisma, PrismaClient } from "@prisma/client";
import type { TrainingProgramRecord, TrainingProgramStatus, TrainingProgramWriteInput } from "./trainingProgramDomain";
import type { TrainingProgramRepository } from "./trainingProgramRepository";

const includeProgram = {
  createdBy: { select: { id: true, displayName: true } },
  items: { orderBy: [{ sortOrder: "asc" as const }, { id: "asc" as const }] }
} satisfies Prisma.TrainingProgramInclude;

type StoredProgram = Prisma.TrainingProgramGetPayload<{ include: typeof includeProgram }>;

export class DatabaseTrainingProgramRepository implements TrainingProgramRepository {
  constructor(private readonly client: PrismaClient) {}

  async listPrograms(): Promise<TrainingProgramRecord[]> {
    const programs = await this.client.trainingProgram.findMany({
      include: includeProgram,
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }]
    });
    return programs.map(toRecord);
  }

  async findById(id: string): Promise<TrainingProgramRecord | null> {
    const program = await this.client.trainingProgram.findUnique({ where: { id }, include: includeProgram });
    return program ? toRecord(program) : null;
  }

  async createProgram(input: TrainingProgramWriteInput & { id: string; createdByUserId: string; itemIds: string[] }): Promise<TrainingProgramRecord> {
    const program = await this.client.trainingProgram.create({
      data: {
        id: input.id,
        name: input.name,
        description: input.description,
        createdByUserId: input.createdByUserId,
        items: {
          create: input.items.map((item, index) => ({ id: input.itemIds[index], ...item }))
        }
      },
      include: includeProgram
    });
    return toRecord(program);
  }

  async updateDraftProgram(id: string, expectedUpdatedAt: string, input: TrainingProgramWriteInput & { itemIds: string[] }): Promise<TrainingProgramRecord | null> {
    return this.client.$transaction(async (transaction) => {
      const updated = await transaction.trainingProgram.updateMany({
        where: { id, status: "DRAFT", updatedAt: new Date(expectedUpdatedAt) },
        data: { name: input.name, description: input.description }
      });
      if (updated.count !== 1) return null;
      await transaction.trainingProgramItem.deleteMany({ where: { programId: id } });
      if (input.items.length > 0) {
        await transaction.trainingProgramItem.createMany({
          data: input.items.map((item, index) => ({ id: input.itemIds[index], programId: id, ...item }))
        });
      }
      const program = await transaction.trainingProgram.findUnique({ where: { id }, include: includeProgram });
      return program ? toRecord(program) : null;
    });
  }

  async transitionProgram(id: string, from: TrainingProgramStatus, to: TrainingProgramStatus, expectedUpdatedAt?: string): Promise<TrainingProgramRecord | null> {
    const updated = await this.client.trainingProgram.updateMany({
      where: { id, status: from, ...(expectedUpdatedAt ? { updatedAt: new Date(expectedUpdatedAt) } : {}) },
      data: { status: to }
    });
    return updated.count === 1 ? this.findById(id) : null;
  }

  async deleteDraftProgram(id: string): Promise<boolean> {
    const deleted = await this.client.trainingProgram.deleteMany({ where: { id, status: "DRAFT" } });
    return deleted.count === 1;
  }
}

function toRecord(program: StoredProgram): TrainingProgramRecord {
  return {
    id: program.id,
    name: program.name,
    description: program.description,
    status: program.status,
    createdByUserId: program.createdByUserId,
    createdBy: { id: program.createdBy.id, displayName: program.createdBy.displayName },
    createdAt: program.createdAt.toISOString(),
    updatedAt: program.updatedAt.toISOString(),
    items: program.items.map((item) => ({
      id: item.id,
      programId: item.programId,
      personaId: item.personaId,
      scenarioId: item.scenarioId,
      mode: item.mode,
      sortOrder: item.sortOrder,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString()
    }))
  };
}
