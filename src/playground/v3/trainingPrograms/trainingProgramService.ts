import { randomUUID } from "crypto";
import type { PublicTrainingProgram } from "../publicContracts";
import type { SimulationMode } from "../simulationSession";
import type {
  TrainingProgramCatalog,
  TrainingProgramItemInput,
  TrainingProgramRecord,
  TrainingProgramWriteInput
} from "./trainingProgramDomain";
import type { TrainingProgramRepository } from "./trainingProgramRepository";

export type TrainingProgramErrorCode =
  | "TRAINING_PROGRAM_NOT_FOUND"
  | "INVALID_TRAINING_PROGRAM_INPUT"
  | "INVALID_TRAINING_CONTENT_REFERENCE"
  | "TRAINING_PROGRAM_EMPTY"
  | "TRAINING_PROGRAM_IMMUTABLE"
  | "INVALID_TRAINING_PROGRAM_TRANSITION"
  | "TRAINING_PROGRAM_CONFLICT";

export class TrainingProgramServiceError extends Error {
  constructor(public readonly code: TrainingProgramErrorCode, message: string) {
    super(message);
    this.name = "TrainingProgramServiceError";
  }
}

interface TrainingProgramServiceDependencies {
  repository: TrainingProgramRepository;
  catalog: TrainingProgramCatalog;
  createId?: () => string;
}

export class TrainingProgramService {
  private readonly createId: () => string;
  private readonly locks = new Map<string, Promise<void>>();

  constructor(private readonly dependencies: TrainingProgramServiceDependencies) {
    this.createId = dependencies.createId ?? randomUUID;
  }

  async list(): Promise<PublicTrainingProgram[]> {
    return Promise.all((await this.dependencies.repository.listPrograms()).map((program) => this.toPublic(program)));
  }

  async get(idInput: unknown): Promise<PublicTrainingProgram> {
    return this.toPublic(await this.requireProgram(idInput));
  }

  async create(createdByUserId: string, input: unknown): Promise<PublicTrainingProgram> {
    const normalized = this.normalizeInput(input);
    await this.validateReferences(normalized.items);
    const program = await this.dependencies.repository.createProgram({
      ...normalized,
      id: this.createId(),
      createdByUserId,
      itemIds: normalized.items.map(() => this.createId())
    });
    return this.toPublic(program);
  }

  async update(idInput: unknown, input: unknown): Promise<PublicTrainingProgram> {
    const id = this.programId(idInput);
    return this.withLock(id, async () => {
      const current = await this.requireProgram(id);
      if (current.status !== "DRAFT") throw immutable();
      const normalized = this.normalizeInput(input);
      await this.validateReferences(normalized.items);
      const updated = await this.dependencies.repository.updateDraftProgram(id, current.updatedAt, {
        ...normalized,
        itemIds: normalized.items.map(() => this.createId())
      });
      if (!updated) throw conflict();
      return this.toPublic(updated);
    });
  }

  async publish(idInput: unknown): Promise<PublicTrainingProgram> {
    const id = this.programId(idInput);
    return this.withLock(id, async () => {
      const current = await this.requireProgram(id);
      if (current.status !== "DRAFT") throw transition("Chỉ chương trình nháp mới có thể xuất bản.");
      if (current.items.length === 0) {
        throw new TrainingProgramServiceError("TRAINING_PROGRAM_EMPTY", "Chương trình cần ít nhất một nội dung luyện tập trước khi xuất bản.");
      }
      await this.validateReferences(current.items);
      const published = await this.dependencies.repository.transitionProgram(id, "DRAFT", "PUBLISHED", current.updatedAt);
      if (!published) throw conflict();
      return this.toPublic(published);
    });
  }

  async archive(idInput: unknown): Promise<PublicTrainingProgram> {
    const id = this.programId(idInput);
    return this.withLock(id, async () => {
      const current = await this.requireProgram(id);
      if (current.status !== "PUBLISHED") throw transition("Chỉ chương trình đã xuất bản mới có thể lưu trữ.");
      const archived = await this.dependencies.repository.transitionProgram(id, "PUBLISHED", "ARCHIVED", current.updatedAt);
      if (!archived) throw conflict();
      return this.toPublic(archived);
    });
  }

  async deleteDraft(idInput: unknown): Promise<void> {
    const id = this.programId(idInput);
    await this.withLock(id, async () => {
      const current = await this.requireProgram(id);
      if (current.status !== "DRAFT") throw immutable();
      if (!await this.dependencies.repository.deleteDraftProgram(id)) throw conflict();
    });
  }

  private normalizeInput(input: unknown): TrainingProgramWriteInput {
    const body = object(input);
    const name = text(body.name, 160);
    if (!name) throw invalid("Tên chương trình là bắt buộc.");
    const description = body.description === null || body.description === undefined ? null : text(body.description, 2_000);
    if (body.description !== null && body.description !== undefined && typeof body.description !== "string") {
      throw invalid("Mô tả chương trình không hợp lệ.");
    }
    if (!Array.isArray(body.items) || body.items.length > 100) throw invalid("Danh sách nội dung luyện tập không hợp lệ.");
    const orders = new Set<number>();
    const items = body.items.map((value) => {
      const item = object(value);
      const personaId = identifier(item.personaId);
      const scenarioId = identifier(item.scenarioId);
      const mode = item.mode;
      const sortOrder = item.sortOrder;
      if (!personaId || !scenarioId || (mode !== "CUSTOMER_FIRST" && mode !== "SALE_FIRST")) {
        throw invalid("Cấu hình nội dung luyện tập không hợp lệ.");
      }
      if (!Number.isInteger(sortOrder) || (sortOrder as number) < 1 || orders.has(sortOrder as number)) {
        throw invalid("Thứ tự nội dung luyện tập không hợp lệ hoặc bị trùng.");
      }
      orders.add(sortOrder as number);
      const personaVersionId = typeof item.personaVersionId === "string" ? item.personaVersionId.trim() : "";
      const scenarioVersionId = typeof item.scenarioVersionId === "string" ? item.scenarioVersionId.trim() : "";
      return { personaId, scenarioId, personaVersionId, scenarioVersionId, mode: mode as SimulationMode, sortOrder: sortOrder as number };
    });
    items.sort((a, b) => a.sortOrder - b.sortOrder || a.personaId.localeCompare(b.personaId));
    return { name, description: description || null, items: items.map((item, index) => ({ ...item, sortOrder: index + 1 })) };
  }

  private async validateReferences(items: Array<Pick<TrainingProgramItemInput, "personaId" | "scenarioId" | "personaVersionId" | "scenarioVersionId">>): Promise<void> {
    for (const item of items) {
      const selection = await this.dependencies.catalog.resolve(item.personaId, item.scenarioId, item.personaVersionId || null, item.scenarioVersionId || null);
      if (!selection) {
        throw new TrainingProgramServiceError(
          "INVALID_TRAINING_CONTENT_REFERENCE",
          "Persona hoặc tình huống luyện tập không tồn tại hay không tương thích."
        );
      }
      item.personaVersionId = selection.personaVersionId || item.personaVersionId || "";
      item.scenarioVersionId = selection.scenarioVersionId || item.scenarioVersionId || "";
    }
  }

  private async requireProgram(idInput: unknown): Promise<TrainingProgramRecord> {
    const id = this.programId(idInput);
    const program = await this.dependencies.repository.findById(id);
    if (!program) throw new TrainingProgramServiceError("TRAINING_PROGRAM_NOT_FOUND", "Không tìm thấy chương trình đào tạo.");
    return program;
  }

  private programId(value: unknown): string {
    const id = identifier(value);
    if (!id) throw new TrainingProgramServiceError("TRAINING_PROGRAM_NOT_FOUND", "Không tìm thấy chương trình đào tạo.");
    return id;
  }

  private async toPublic(program: TrainingProgramRecord): Promise<PublicTrainingProgram> {
    return {
      id: program.id,
      name: program.name,
      description: program.description,
      status: program.status,
      createdBy: { id: program.createdBy.id, displayName: program.createdBy.displayName },
      createdAt: program.createdAt,
      updatedAt: program.updatedAt,
      items: await Promise.all(program.items.map(async (item) => {
        const selection = await this.dependencies.catalog.resolve(item.personaId, item.scenarioId, item.personaVersionId || null, item.scenarioVersionId || null);
        return {
          id: item.id,
          personaId: item.personaId,
          personaLabel: selection?.personaLabel ?? null,
          scenarioId: item.scenarioId,
          scenarioLabel: selection?.scenarioLabel ?? null,
          personaVersionId: item.personaVersionId || selection?.personaVersionId || null,
          personaVersion: selection?.personaVersion ?? null,
          scenarioVersionId: item.scenarioVersionId || selection?.scenarioVersionId || null,
          scenarioVersion: selection?.scenarioVersion ?? null,
          mode: item.mode,
          sortOrder: item.sortOrder
        };
      }))
    };
  }

  private async withLock<T>(id: string, operation: () => Promise<T>): Promise<T> {
    const previous = this.locks.get(id) ?? Promise.resolve();
    let release = (): void => {};
    const current = new Promise<void>((resolve) => { release = resolve; });
    this.locks.set(id, current);
    await previous;
    try {
      return await operation();
    } finally {
      release();
      if (this.locks.get(id) === current) this.locks.delete(id);
    }
  }
}

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw invalid("Dữ liệu chương trình không hợp lệ.");
  return value as Record<string, unknown>;
}

function text(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  const normalized = value.trim();
  if (normalized.length > max) throw invalid("Dữ liệu chương trình vượt quá độ dài cho phép.");
  return normalized;
}

function identifier(value: unknown): string {
  return typeof value === "string" && value.trim().length > 0 && value.trim().length <= 160 ? value.trim() : "";
}

function invalid(message: string): TrainingProgramServiceError {
  return new TrainingProgramServiceError("INVALID_TRAINING_PROGRAM_INPUT", message);
}

function immutable(): TrainingProgramServiceError {
  return new TrainingProgramServiceError("TRAINING_PROGRAM_IMMUTABLE", "Chương trình đã xuất bản hoặc lưu trữ không thể chỉnh sửa.");
}

function transition(message: string): TrainingProgramServiceError {
  return new TrainingProgramServiceError("INVALID_TRAINING_PROGRAM_TRANSITION", message);
}

function conflict(): TrainingProgramServiceError {
  return new TrainingProgramServiceError("TRAINING_PROGRAM_CONFLICT", "Chương trình vừa được thay đổi. Vui lòng tải lại và thử lại.");
}
