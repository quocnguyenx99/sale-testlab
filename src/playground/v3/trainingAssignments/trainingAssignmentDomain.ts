import type { SimulationMode, SimulationStatus } from "../simulationSession";
import type { TrainingProgramStatus } from "../trainingPrograms/trainingProgramDomain";

export type TrainingAssignmentState = "ASSIGNED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
export type TrainingAssignmentItemState = "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED";

export interface TrainingAssigneeRecord {
  id: string;
  displayName: string;
  email: string;
  role: "SALE" | "MANAGER" | "ADMIN";
  status: "ACTIVE" | "DISABLED";
}

export interface AssignmentProgramItemRecord {
  id: string;
  personaId: string;
  scenarioId: string;
  mode: SimulationMode;
  sortOrder: number;
}

export interface AssignmentProgramRecord {
  id: string;
  name: string;
  description: string | null;
  status: TrainingProgramStatus;
  items: AssignmentProgramItemRecord[];
}

export interface AssignmentSessionRecord {
  id: string;
  userId: string;
  trainingAssignmentId: string;
  trainingProgramItemId: string;
  status: SimulationStatus;
}

export interface TrainingAssignmentRecord {
  id: string;
  programId: string;
  assignedToUserId: string;
  assignedByUserId: string;
  dueAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
  program: AssignmentProgramRecord;
  assignedTo: TrainingAssigneeRecord;
  assignedBy: Pick<TrainingAssigneeRecord, "id" | "displayName" | "email">;
  sessions: AssignmentSessionRecord[];
}

export interface DerivedAssignmentItem {
  id: string;
  personaId: string;
  scenarioId: string;
  mode: SimulationMode;
  sortOrder: number;
  state: TrainingAssignmentItemState;
  activeSessionId: string | null;
}

export interface DerivedTrainingAssignment {
  state: TrainingAssignmentState;
  isOverdue: boolean;
  completedItems: number;
  totalItems: number;
  progressPercent: number;
  items: DerivedAssignmentItem[];
}

export function deriveTrainingAssignment(record: TrainingAssignmentRecord, now: Date): DerivedTrainingAssignment {
  const items = record.program.items.map((item): DerivedAssignmentItem => {
    const attempts = record.sessions.filter((session) => session.trainingProgramItemId === item.id);
    const completed = attempts.some((session) => session.status === "COMPLETED");
    const running = attempts.find((session) => session.status === "RUNNING") ?? null;
    return {
      ...item,
      state: completed ? "COMPLETED" : running ? "IN_PROGRESS" : "NOT_STARTED",
      activeSessionId: running?.id ?? null
    };
  });
  const completedItems = items.filter((item) => item.state === "COMPLETED").length;
  const totalItems = items.length;
  const hasAttempt = record.sessions.length > 0;
  const state: TrainingAssignmentState = record.cancelledAt
    ? "CANCELLED"
    : totalItems > 0 && completedItems === totalItems
      ? "COMPLETED"
      : hasAttempt
        ? "IN_PROGRESS"
        : "ASSIGNED";
  return {
    state,
    isOverdue: Boolean(record.dueAt && Date.parse(record.dueAt) < now.getTime() && state !== "COMPLETED" && state !== "CANCELLED"),
    completedItems,
    totalItems,
    progressPercent: totalItems === 0 ? 0 : Math.round((completedItems / totalItems) * 100),
    items
  };
}
