import { SessionHistoryPage, SessionHistoryQuery, SessionRepository } from "./sessionRepository";
import { SimulationSession } from "./simulationSession";

export class InMemorySessionRepository implements SessionRepository {
  private readonly sessions = new Map<string, SimulationSession>();

  async findById(id: string): Promise<SimulationSession | null> {
    return this.sessions.get(id) ?? null;
  }

  async findHistoryByUserId(userId: string, query: SessionHistoryQuery): Promise<SessionHistoryPage> {
    const search = query.search?.toLocaleLowerCase("vi") ?? "";
    const filtered = Array.from(this.sessions.values())
      .filter((session) => session.userId === userId)
      .filter((session) => !query.status || session.status === query.status)
      .filter((session) => !query.mode || session.mode === query.mode)
      .filter((session) => !search || session.personaSnapshot.displayName.toLocaleLowerCase("vi").includes(search))
      .sort((left, right) => sessionUpdatedAt(right).localeCompare(sessionUpdatedAt(left)) || right.id.localeCompare(left.id));
    const items = filtered
      .slice((query.page - 1) * query.pageSize, query.page * query.pageSize)
      .map((session) => ({
        id: session.id,
        persona: session.personaSnapshot,
        mode: session.mode,
        status: session.status,
        createdAt: session.createdAt,
        updatedAt: sessionUpdatedAt(session),
        completedAt: session.completedAt,
        turnCount: session.messages.filter((message) => message.sender === "SALE").length,
        dealOutcome: session.result?.outcome ?? session.runtimeInsight?.dealOutcome ?? null,
        trainingStatus: session.result?.trainingStatus ?? session.runtimeInsight?.trainingStatus ?? null
      }));
    return {
      items,
      page: query.page,
      pageSize: query.pageSize,
      total: filtered.length,
      totalPages: filtered.length === 0 ? 0 : Math.ceil(filtered.length / query.pageSize)
    };
  }

  async save(session: SimulationSession): Promise<void> {
    this.sessions.set(session.id, session);
  }
}

function sessionUpdatedAt(session: SimulationSession): string {
  return session.completedAt ?? session.messages.at(-1)?.createdAt ?? session.createdAt;
}
