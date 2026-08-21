import { randomUUID } from "crypto";
import type {
  PublicManagedTrainingAssignment,
  PublicOwnTrainingAssignment,
  PublicTrainingAssignee
} from "../publicContracts";
import type { SimulationService } from "../simulationService";
import type { SimulationSession } from "../simulationSession";
import type { TrainingProgramCatalog } from "../trainingPrograms/trainingProgramDomain";
import { deriveTrainingAssignment, type TrainingAssignmentRecord } from "./trainingAssignmentDomain";
import type { TrainingAssignmentRepository } from "./trainingAssignmentRepository";

export type TrainingAssignmentErrorCode =
  | "TRAINING_ASSIGNMENT_NOT_FOUND"
  | "TRAINING_ASSIGNMENT_ITEM_NOT_FOUND"
  | "INVALID_TRAINING_ASSIGNMENT_INPUT"
  | "TRAINING_PROGRAM_NOT_ASSIGNABLE"
  | "TRAINING_ASSIGNEE_NOT_ELIGIBLE"
  | "TRAINING_ASSIGNMENT_DUPLICATE"
  | "TRAINING_ASSIGNMENT_CANCELLED"
  | "TRAINING_ASSIGNMENT_COMPLETED"
  | "TRAINING_ASSIGNMENT_CONTENT_UNAVAILABLE"
  | "TRAINING_ASSIGNMENT_CONFLICT";

export class TrainingAssignmentServiceError extends Error {
  constructor(public readonly code: TrainingAssignmentErrorCode, message: string) {
    super(message);
    this.name = "TrainingAssignmentServiceError";
  }
}

interface TrainingAssignmentServiceDependencies {
  repository: TrainingAssignmentRepository;
  simulation: SimulationService;
  catalog: TrainingProgramCatalog;
  now?: () => Date;
  createId?: () => string;
}

export class TrainingAssignmentService {
  private readonly now: () => Date;
  private readonly createId: () => string;
  private readonly locks = new Map<string, Promise<void>>();

  constructor(private readonly dependencies: TrainingAssignmentServiceDependencies) {
    this.now = dependencies.now ?? (() => new Date());
    this.createId = dependencies.createId ?? randomUUID;
  }

  async listAssignees(): Promise<PublicTrainingAssignee[]> {
    return (await this.dependencies.repository.listAssignableSaleUsers()).map((user) => ({
      id: user.id,
      displayName: user.displayName,
      email: user.email,
      role: "SALE"
    }));
  }

  async listManaged(): Promise<PublicManagedTrainingAssignment[]> {
    return (await this.dependencies.repository.listManagedAssignments()).map((record) => this.toManaged(record));
  }

  async getManaged(idInput: unknown): Promise<PublicManagedTrainingAssignment> {
    return this.toManaged(await this.requireManaged(idInput));
  }

  async listOwn(userId: string): Promise<PublicOwnTrainingAssignment[]> {
    return (await this.dependencies.repository.listAssignmentsForUser(userId)).map((record) => this.toOwn(record));
  }

  async getOwn(idInput: unknown, userId: string): Promise<PublicOwnTrainingAssignment> {
    return this.toOwn(await this.requireOwn(idInput, userId));
  }

  async create(assignedByUserId: string, input: unknown): Promise<PublicManagedTrainingAssignment> {
    const body = object(input);
    const programId = identifier(body.programId);
    const assignedToUserId = identifier(body.assignedToUserId);
    const dueAt = optionalDate(body.dueAt);
    if (!programId || !assignedToUserId) throw invalid("Chương trình và nhân viên SALE là bắt buộc.");
    return this.withLock(`create:${programId}:${assignedToUserId}`, async () => {
      const program = await this.dependencies.repository.findProgramById(programId);
      if (!program || program.status !== "PUBLISHED" || program.items.length === 0) {
        throw new TrainingAssignmentServiceError("TRAINING_PROGRAM_NOT_ASSIGNABLE", "Chỉ chương trình đã xuất bản mới có thể được phân công.");
      }
      const assignee = await this.dependencies.repository.findUserById(assignedToUserId);
      if (!assignee || assignee.role !== "SALE" || assignee.status !== "ACTIVE") {
        throw new TrainingAssignmentServiceError("TRAINING_ASSIGNEE_NOT_ELIGIBLE", "Chỉ nhân viên SALE đang hoạt động mới có thể nhận chương trình.");
      }
      if (await this.dependencies.repository.findActiveDuplicate(programId, assignedToUserId)) {
        throw new TrainingAssignmentServiceError("TRAINING_ASSIGNMENT_DUPLICATE", "Nhân viên đã có phân công chưa hủy cho chương trình này.");
      }
      return this.toManaged(await this.dependencies.repository.createAssignment({
        id: this.createId(),
        programId,
        assignedToUserId,
        assignedByUserId,
        dueAt
      }));
    });
  }

  async cancel(idInput: unknown): Promise<PublicManagedTrainingAssignment> {
    const id = assignmentId(idInput);
    return this.withLock(`cancel:${id}`, async () => {
      const current = await this.requireManaged(id);
      const derived = deriveTrainingAssignment(current, this.now());
      if (derived.state === "COMPLETED") {
        throw new TrainingAssignmentServiceError("TRAINING_ASSIGNMENT_COMPLETED", "Không thể hủy phân công đã hoàn thành.");
      }
      if (derived.state === "CANCELLED") {
        throw new TrainingAssignmentServiceError("TRAINING_ASSIGNMENT_CANCELLED", "Phân công đã được hủy trước đó.");
      }
      const cancelled = await this.dependencies.repository.cancelAssignment(id, this.now().toISOString(), current.updatedAt);
      if (!cancelled) throw conflict();
      return this.toManaged(cancelled);
    });
  }

  async startAssignedItem(idInput: unknown, itemIdInput: unknown, userId: string): Promise<SimulationSession> {
    const id = assignmentId(idInput);
    const itemId = identifier(itemIdInput);
    if (!itemId) throw notFound("TRAINING_ASSIGNMENT_ITEM_NOT_FOUND", "Không tìm thấy nội dung được phân công.");
    return this.withLock(`start:${id}:${itemId}`, async () => {
      const current = await this.requireOwn(id, userId);
      const derived = deriveTrainingAssignment(current, this.now());
      if (derived.state === "CANCELLED") {
        throw new TrainingAssignmentServiceError("TRAINING_ASSIGNMENT_CANCELLED", "Phân công đã bị hủy và không thể bắt đầu nội dung mới.");
      }
      const item = current.program.items.find((candidate) => candidate.id === itemId);
      const progress = derived.items.find((candidate) => candidate.id === itemId);
      if (!item || !progress) throw notFound("TRAINING_ASSIGNMENT_ITEM_NOT_FOUND", "Không tìm thấy nội dung được phân công.");
      if (progress.state === "COMPLETED") {
        throw new TrainingAssignmentServiceError("TRAINING_ASSIGNMENT_COMPLETED", "Nội dung này đã hoàn thành.");
      }
      if (progress.activeSessionId) return this.dependencies.simulation.getSession(progress.activeSessionId, userId);
      if (!this.dependencies.catalog.resolve(item.personaId, item.scenarioId)) {
        throw new TrainingAssignmentServiceError("TRAINING_ASSIGNMENT_CONTENT_UNAVAILABLE", "Nội dung luyện tập hiện không còn khả dụng.");
      }
      return this.dependencies.simulation.createAssignedSession(item.personaId, item.mode, userId, {
        trainingAssignmentId: current.id,
        trainingProgramItemId: item.id
      });
    });
  }

  private async requireManaged(idInput: unknown): Promise<TrainingAssignmentRecord> {
    const id = assignmentId(idInput);
    const assignment = await this.dependencies.repository.findById(id);
    if (!assignment) throw notFound("TRAINING_ASSIGNMENT_NOT_FOUND", "Không tìm thấy phân công đào tạo.");
    return assignment;
  }

  private async requireOwn(idInput: unknown, userId: string): Promise<TrainingAssignmentRecord> {
    const id = assignmentId(idInput);
    const assignment = await this.dependencies.repository.findByIdForUser(id, userId);
    if (!assignment) throw notFound("TRAINING_ASSIGNMENT_NOT_FOUND", "Không tìm thấy phân công đào tạo.");
    return assignment;
  }

  private toManaged(record: TrainingAssignmentRecord): PublicManagedTrainingAssignment {
    const derived = deriveTrainingAssignment(record, this.now());
    return {
      id: record.id,
      program: { id: record.program.id, name: record.program.name, description: record.program.description, status: record.program.status },
      assignedTo: { id: record.assignedTo.id, displayName: record.assignedTo.displayName, email: record.assignedTo.email },
      assignedBy: { id: record.assignedBy.id, displayName: record.assignedBy.displayName },
      assignedAt: record.createdAt,
      dueAt: record.dueAt,
      cancelledAt: record.cancelledAt,
      state: derived.state,
      isOverdue: derived.isOverdue,
      completedItems: derived.completedItems,
      totalItems: derived.totalItems,
      progressPercent: derived.progressPercent,
      items: derived.items.map((item) => this.publicItem(item))
    };
  }

  private toOwn(record: TrainingAssignmentRecord): PublicOwnTrainingAssignment {
    const managed = this.toManaged(record);
    const derived = deriveTrainingAssignment(record, this.now());
    return {
      id: managed.id,
      program: managed.program,
      assignedAt: managed.assignedAt,
      dueAt: managed.dueAt,
      cancelledAt: managed.cancelledAt,
      state: managed.state,
      isOverdue: managed.isOverdue,
      completedItems: managed.completedItems,
      totalItems: managed.totalItems,
      progressPercent: managed.progressPercent,
      items: derived.items.map((item) => ({ ...this.publicItem(item), activeSessionId: item.activeSessionId }))
    };
  }

  private publicItem(item: ReturnType<typeof deriveTrainingAssignment>["items"][number]) {
    const selection = this.dependencies.catalog.resolve(item.personaId, item.scenarioId);
    return {
      id: item.id,
      sortOrder: item.sortOrder,
      personaId: item.personaId,
      personaLabel: selection?.personaLabel ?? null,
      scenarioId: item.scenarioId,
      scenarioLabel: selection?.scenarioLabel ?? null,
      mode: item.mode,
      state: item.state
    };
  }

  private async withLock<T>(key: string, operation: () => Promise<T>): Promise<T> {
    const previous = this.locks.get(key) ?? Promise.resolve();
    let release = (): void => {};
    const current = new Promise<void>((resolve) => { release = resolve; });
    this.locks.set(key, current);
    await previous;
    try {
      return await operation();
    } finally {
      release();
      if (this.locks.get(key) === current) this.locks.delete(key);
    }
  }
}

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw invalid("Dữ liệu phân công không hợp lệ.");
  return value as Record<string, unknown>;
}

function identifier(value: unknown): string {
  return typeof value === "string" && value.trim().length > 0 && value.trim().length <= 160 ? value.trim() : "";
}

function assignmentId(value: unknown): string {
  const id = identifier(value);
  if (!id) throw notFound("TRAINING_ASSIGNMENT_NOT_FOUND", "Không tìm thấy phân công đào tạo.");
  return id;
}

function optionalDate(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) throw invalid("Hạn hoàn thành không hợp lệ.");
  return new Date(value).toISOString();
}

function invalid(message: string): TrainingAssignmentServiceError {
  return new TrainingAssignmentServiceError("INVALID_TRAINING_ASSIGNMENT_INPUT", message);
}

function notFound(code: "TRAINING_ASSIGNMENT_NOT_FOUND" | "TRAINING_ASSIGNMENT_ITEM_NOT_FOUND", message: string): TrainingAssignmentServiceError {
  return new TrainingAssignmentServiceError(code, message);
}

function conflict(): TrainingAssignmentServiceError {
  return new TrainingAssignmentServiceError("TRAINING_ASSIGNMENT_CONFLICT", "Phân công vừa được thay đổi. Vui lòng tải lại và thử lại.");
}
