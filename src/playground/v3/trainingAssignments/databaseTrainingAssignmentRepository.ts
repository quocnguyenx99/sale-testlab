import { Prisma, PrismaClient } from "@prisma/client";
import type {
  AssignmentProgramItemRecord,
  TrainingAssigneeRecord,
  TrainingAssignmentRecord
} from "./trainingAssignmentDomain";
import type { TrainingAssignmentRepository } from "./trainingAssignmentRepository";

const assignmentInclude = {
  program: {
    select: {
      id: true,
      name: true,
      description: true,
      status: true,
      items: {
        select: { id: true, personaId: true, scenarioId: true, mode: true, sortOrder: true },
        orderBy: [{ sortOrder: "asc" as const }, { id: "asc" as const }]
      }
    }
  },
  assignedTo: { select: { id: true, displayName: true, email: true, role: true, status: true } },
  assignedBy: { select: { id: true, displayName: true, email: true } },
  sessions: {
    select: { id: true, userId: true, trainingAssignmentId: true, trainingProgramItemId: true, status: true },
    orderBy: [{ createdAt: "asc" as const }, { id: "asc" as const }]
  }
} satisfies Prisma.TrainingAssignmentInclude;

type StoredAssignment = Prisma.TrainingAssignmentGetPayload<{ include: typeof assignmentInclude }>;

export class DatabaseTrainingAssignmentRepository implements TrainingAssignmentRepository {
  constructor(private readonly client: PrismaClient) {}

  async listManagedAssignments(): Promise<TrainingAssignmentRecord[]> {
    return (await this.client.trainingAssignment.findMany({
      include: assignmentInclude,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }]
    })).map(toRecord);
  }

  async listAssignmentsForUser(userId: string): Promise<TrainingAssignmentRecord[]> {
    return (await this.client.trainingAssignment.findMany({
      where: { assignedToUserId: userId },
      include: assignmentInclude,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }]
    })).map(toRecord);
  }

  async findById(id: string): Promise<TrainingAssignmentRecord | null> {
    const assignment = await this.client.trainingAssignment.findUnique({ where: { id }, include: assignmentInclude });
    return assignment ? toRecord(assignment) : null;
  }

  async findByIdForUser(id: string, userId: string): Promise<TrainingAssignmentRecord | null> {
    const assignment = await this.client.trainingAssignment.findFirst({
      where: { id, assignedToUserId: userId },
      include: assignmentInclude
    });
    return assignment ? toRecord(assignment) : null;
  }

  async findActiveDuplicate(programId: string, assignedToUserId: string): Promise<TrainingAssignmentRecord | null> {
    const assignment = await this.client.trainingAssignment.findFirst({
      where: { programId, assignedToUserId, cancelledAt: null },
      include: assignmentInclude,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }]
    });
    return assignment ? toRecord(assignment) : null;
  }

  async findProgramById(id: string) {
    const program = await this.client.trainingProgram.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        description: true,
        status: true,
        items: {
          select: { id: true, personaId: true, scenarioId: true, mode: true, sortOrder: true },
          orderBy: [{ sortOrder: "asc" }, { id: "asc" }]
        }
      }
    });
    return program ? { ...program, items: program.items.map((item) => ({ ...item })) } : null;
  }

  async findUserById(id: string): Promise<TrainingAssigneeRecord | null> {
    return this.client.user.findUnique({
      where: { id },
      select: { id: true, displayName: true, email: true, role: true, status: true }
    });
  }

  async listAssignableSaleUsers(): Promise<TrainingAssigneeRecord[]> {
    return this.client.user.findMany({
      where: { role: "SALE", status: "ACTIVE" },
      select: { id: true, displayName: true, email: true, role: true, status: true },
      orderBy: [{ displayName: "asc" }, { email: "asc" }, { id: "asc" }]
    });
  }

  async createAssignment(input: {
    id: string;
    programId: string;
    assignedToUserId: string;
    assignedByUserId: string;
    dueAt: string | null;
  }): Promise<TrainingAssignmentRecord> {
    return toRecord(await this.client.trainingAssignment.create({
      data: {
        id: input.id,
        programId: input.programId,
        assignedToUserId: input.assignedToUserId,
        assignedByUserId: input.assignedByUserId,
        dueAt: input.dueAt ? new Date(input.dueAt) : null
      },
      include: assignmentInclude
    }));
  }

  async cancelAssignment(id: string, cancelledAt: string, expectedUpdatedAt: string): Promise<TrainingAssignmentRecord | null> {
    const updated = await this.client.trainingAssignment.updateMany({
      where: { id, cancelledAt: null, updatedAt: new Date(expectedUpdatedAt) },
      data: { cancelledAt: new Date(cancelledAt) }
    });
    return updated.count === 1 ? this.findById(id) : null;
  }
}

function toRecord(assignment: StoredAssignment): TrainingAssignmentRecord {
  return {
    id: assignment.id,
    programId: assignment.programId,
    assignedToUserId: assignment.assignedToUserId,
    assignedByUserId: assignment.assignedByUserId,
    dueAt: assignment.dueAt?.toISOString() ?? null,
    cancelledAt: assignment.cancelledAt?.toISOString() ?? null,
    createdAt: assignment.createdAt.toISOString(),
    updatedAt: assignment.updatedAt.toISOString(),
    program: {
      id: assignment.program.id,
      name: assignment.program.name,
      description: assignment.program.description,
      status: assignment.program.status,
      items: assignment.program.items.map((item): AssignmentProgramItemRecord => ({ ...item }))
    },
    assignedTo: { ...assignment.assignedTo },
    assignedBy: { ...assignment.assignedBy },
    sessions: assignment.sessions
      .filter((session): session is typeof session & { trainingAssignmentId: string; trainingProgramItemId: string } =>
        Boolean(session.trainingAssignmentId && session.trainingProgramItemId)
      )
      .map((session) => ({
        ...session,
        trainingAssignmentId: session.trainingAssignmentId,
        trainingProgramItemId: session.trainingProgramItemId
      }))
  };
}
