import {
  SimulationMode,
  SimulationPersonaSnapshot,
  SimulationSession,
  SimulationStatus
} from "./simulationSession";

export interface RecentSessionSummary {
  id: string;
  persona: SimulationPersonaSnapshot;
  mode: SimulationMode;
  status: SimulationStatus;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  turnCount: number;
  dealOutcome: string | null;
  trainingStatus: string | null;
}

export interface SessionHistoryQuery {
  page: number;
  pageSize: number;
  status?: SimulationStatus;
  mode?: SimulationMode;
  search?: string;
}

export interface SessionHistoryPage {
  items: RecentSessionSummary[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface SessionRepository {
  findById(id: string): Promise<SimulationSession | null>;
  findHistoryByUserId(userId: string, query: SessionHistoryQuery): Promise<SessionHistoryPage>;
  save(session: SimulationSession): Promise<void>;
}
