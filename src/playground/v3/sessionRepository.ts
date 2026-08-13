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

export interface SessionRepository {
  findById(id: string): Promise<SimulationSession | null>;
  findRecentByUserId(userId: string, limit: number): Promise<RecentSessionSummary[]>;
  save(session: SimulationSession): Promise<void>;
}
