import type {
  AssignmentProgramRecord,
  AssignmentSessionRecord,
  TrainingAssigneeRecord,
  TrainingAssignmentRecord
} from "./trainingAssignmentDomain";
import type { TrainingAssignmentRepository } from "./trainingAssignmentRepository";

interface StoredAssignment {
  id: string;
  programId: string;
  assignedToUserId: string;
  assignedByUserId: string;
  dueAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export class InMemoryTrainingAssignmentRepository implements TrainingAssignmentRepository {
  private readonly assignments = new Map<string, StoredAssignment>();
  private readonly sessions: AssignmentSessionRecord[] = [];
  private tick = 0;

  constructor(
    private readonly programs: Map<string, AssignmentProgramRecord>,
    private readonly users: Map<string, TrainingAssigneeRecord>
  ) {}

  async listManagedAssignments(): Promise<TrainingAssignmentRecord[]> {
    return [...this.assignments.values()].sort(byCreated).map((value) => this.hydrate(value));
  }

  async listAssignmentsForUser(userId: string): Promise<TrainingAssignmentRecord[]> {
    return [...this.assignments.values()].filter((value) => value.assignedToUserId === userId).sort(byCreated).map((value) => this.hydrate(value));
  }

  async findById(id: string): Promise<TrainingAssignmentRecord | null> {
    const value = this.assignments.get(id);
    return value ? this.hydrate(value) : null;
  }

  async findByIdForUser(id: string, userId: string): Promise<TrainingAssignmentRecord | null> {
    const value = this.assignments.get(id);
    return value?.assignedToUserId === userId ? this.hydrate(value) : null;
  }

  async findActiveDuplicate(programId: string, assignedToUserId: string): Promise<TrainingAssignmentRecord | null> {
    const value = [...this.assignments.values()].find((assignment) =>
      assignment.programId === programId && assignment.assignedToUserId === assignedToUserId && !assignment.cancelledAt
    );
    return value ? this.hydrate(value) : null;
  }

  async findProgramById(id: string): Promise<AssignmentProgramRecord | null> {
    return clone(this.programs.get(id) ?? null);
  }

  async findUserById(id: string): Promise<TrainingAssigneeRecord | null> {
    return clone(this.users.get(id) ?? null);
  }

  async listAssignableSaleUsers(): Promise<TrainingAssigneeRecord[]> {
    return [...this.users.values()]
      .filter((user) => user.role === "SALE" && user.status === "ACTIVE")
      .sort((a, b) => a.displayName.localeCompare(b.displayName) || a.id.localeCompare(b.id))
      .map((user) => clone(user));
  }

  async createAssignment(input: {
    id: string;
    programId: string;
    assignedToUserId: string;
    assignedByUserId: string;
    dueAt: string | null;
  }): Promise<TrainingAssignmentRecord> {
    const now = this.timestamp();
    const value: StoredAssignment = { ...input, cancelledAt: null, createdAt: now, updatedAt: now };
    this.assignments.set(value.id, value);
    return this.hydrate(value);
  }

  async cancelAssignment(id: string, cancelledAt: string, expectedUpdatedAt: string): Promise<TrainingAssignmentRecord | null> {
    const value = this.assignments.get(id);
    if (!value || value.cancelledAt || value.updatedAt !== expectedUpdatedAt) return null;
    const next = { ...value, cancelledAt, updatedAt: this.timestamp() };
    this.assignments.set(id, next);
    return this.hydrate(next);
  }

  addSession(session: AssignmentSessionRecord): void {
    const index = this.sessions.findIndex((current) => current.id === session.id);
    if (index >= 0) this.sessions[index] = clone(session);
    else this.sessions.push(clone(session));
  }

  setProgramStatus(id: string, status: AssignmentProgramRecord["status"]): void {
    const program = this.programs.get(id);
    if (program) program.status = status;
  }

  setUserStatus(id: string, status: TrainingAssigneeRecord["status"]): void {
    const user = this.users.get(id);
    if (user) user.status = status;
  }

  private hydrate(value: StoredAssignment): TrainingAssignmentRecord {
    const program = this.programs.get(value.programId);
    const assignedTo = this.users.get(value.assignedToUserId);
    const assignedBy = this.users.get(value.assignedByUserId);
    if (!program || !assignedTo || !assignedBy) throw new Error("Invalid in-memory assignment fixture");
    return clone({
      ...value,
      program,
      assignedTo,
      assignedBy: { id: assignedBy.id, displayName: assignedBy.displayName, email: assignedBy.email },
      sessions: this.sessions.filter((session) => session.trainingAssignmentId === value.id)
    });
  }

  private timestamp(): string {
    this.tick += 1;
    return new Date(Date.UTC(2026, 7, 21, 2, 0, 0, this.tick)).toISOString();
  }
}

function byCreated(a: StoredAssignment, b: StoredAssignment): number {
  return b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id);
}

function clone<T>(value: T): T {
  return structuredClone(value);
}
