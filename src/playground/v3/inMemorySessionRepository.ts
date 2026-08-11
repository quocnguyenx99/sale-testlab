import { SessionRepository } from "./sessionRepository";
import { SimulationSession } from "./simulationSession";

export class InMemorySessionRepository implements SessionRepository {
  private readonly sessions = new Map<string, SimulationSession>();

  async findById(id: string): Promise<SimulationSession | null> {
    return this.sessions.get(id) ?? null;
  }

  async save(session: SimulationSession): Promise<void> {
    this.sessions.set(session.id, session);
  }
}
