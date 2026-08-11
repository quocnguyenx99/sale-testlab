import { SimulationSession } from "./simulationSession";

export interface SessionRepository {
  findById(id: string): Promise<SimulationSession | null>;
  save(session: SimulationSession): Promise<void>;
}
