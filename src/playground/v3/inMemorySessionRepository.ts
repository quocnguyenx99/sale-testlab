import { RecentSessionSummary, SessionRepository } from "./sessionRepository";
import { SimulationSession } from "./simulationSession";

export class InMemorySessionRepository implements SessionRepository {
  private readonly sessions = new Map<string, SimulationSession>();

  async findById(id: string): Promise<SimulationSession | null> {
    return this.sessions.get(id) ?? null;
  }

  async findRecentByUserId(userId: string, limit: number): Promise<RecentSessionSummary[]> {
    return Array.from(this.sessions.values())
      .filter((session) => session.userId === userId)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt) || right.id.localeCompare(left.id))
      .slice(0, limit)
      .map((session) => ({
        id: session.id,
        persona: session.personaSnapshot,
        mode: session.mode,
        status: session.status,
        createdAt: session.createdAt,
        updatedAt: session.completedAt ?? session.messages.at(-1)?.createdAt ?? session.createdAt,
        completedAt: session.completedAt,
        turnCount: session.messages.filter((message) => message.sender === "SALE").length,
        dealOutcome: session.result?.outcome ?? session.runtimeInsight?.dealOutcome ?? null,
        trainingStatus: session.result?.trainingStatus ?? session.runtimeInsight?.trainingStatus ?? null
      }));
  }

  async save(session: SimulationSession): Promise<void> {
    this.sessions.set(session.id, session);
  }
}
