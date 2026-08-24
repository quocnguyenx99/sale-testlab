import { Prisma, PrismaClient } from "@prisma/client";
import {
  AssignmentXpCandidate,
  businessDate,
  businessDateValue,
  GamificationEventRecord,
  SessionXpCandidate
} from "./gamificationDomain";
import {
  AssignmentEventInput,
  GamificationRepository,
  LeaderboardRepositoryPage,
  LeaderboardRepositoryRow,
  PersonalGamificationAggregate,
  SessionEventInput
} from "./gamificationRepository";

const EVALUATOR_VERSION = "testlab-evaluator-v1";

export class DatabaseGamificationRepository implements GamificationRepository {
  constructor(private readonly client: PrismaClient) {}

  async findSessionCandidate(sessionId: string): Promise<SessionXpCandidate | null> {
    const session = await this.client.simulationSession.findUnique({
      where: { id: sessionId },
      select: {
        id: true, userId: true, status: true, completedAt: true, personaId: true,
        personaVersionId: true, scenarioVersionId: true, scenarioSnapshot: true, mode: true,
        user: { select: { role: true, status: true } },
        evaluations: {
          where: { evaluatorVersion: EVALUATOR_VERSION },
          select: { id: true, evaluatorVersion: true, status: true, overallScore: true, evaluatedAt: true },
          take: 1
        },
        _count: { select: { turns: { where: { sender: "SALE" } } } }
      }
    });
    const evaluation = session?.evaluations[0];
    if (!session || !evaluation) return null;
    return {
      sessionId: session.id,
      evaluationId: evaluation.id,
      userId: session.userId,
      userRole: session.user.role,
      userStatus: session.user.status,
      sessionStatus: session.status,
      completedAt: session.completedAt?.toISOString() ?? null,
      evaluatorVersion: evaluation.evaluatorVersion,
      evaluationStatus: evaluation.status,
      overallScore: evaluation.overallScore,
      evaluatedAt: evaluation.evaluatedAt?.toISOString() ?? null,
      saleTurnCount: session._count.turns,
      personaId: session.personaId,
      personaVersionId: session.personaVersionId,
      scenarioVersionId: session.scenarioVersionId,
      scenarioIdentity: scenarioIdentity(session.scenarioSnapshot),
      mode: session.mode
    };
  }

  async findAssignmentCandidate(assignmentId: string): Promise<AssignmentXpCandidate | null> {
    const assignment = await this.client.trainingAssignment.findUnique({
      where: { id: assignmentId },
      select: {
        id: true, assignedToUserId: true, cancelledAt: true,
        assignedTo: { select: { role: true, status: true } },
        program: { select: { items: { select: { id: true }, orderBy: [{ sortOrder: "asc" }, { id: "asc" }] } } },
        sessions: {
          where: { status: "COMPLETED", completedAt: { not: null } },
          select: { id: true, trainingProgramItemId: true, completedAt: true },
          orderBy: [{ completedAt: "asc" }, { id: "asc" }]
        }
      }
    });
    if (!assignment) return null;
    return {
      assignmentId: assignment.id,
      userId: assignment.assignedToUserId,
      userRole: assignment.assignedTo.role,
      userStatus: assignment.assignedTo.status,
      cancelledAt: assignment.cancelledAt?.toISOString() ?? null,
      requiredItemIds: assignment.program.items.map((item) => item.id),
      completedSessions: assignment.sessions.flatMap((session) => session.trainingProgramItemId && session.completedAt ? [{
        itemId: session.trainingProgramItemId,
        completedAt: session.completedAt.toISOString(),
        sessionId: session.id
      }] : [])
    };
  }

  async findAssignmentIdForSession(sessionId: string): Promise<string | null> {
    return (await this.client.simulationSession.findUnique({ where: { id: sessionId }, select: { trainingAssignmentId: true } }))?.trainingAssignmentId ?? null;
  }

  async createSessionEventAtomically(input: SessionEventInput): Promise<GamificationEventRecord> {
    return this.client.$transaction(async (transaction) => {
      await lockUser(transaction, input.candidate.userId);
      const existing = await transaction.gamificationEvent.findUnique({
        where: { eventType_sourceSessionId: { eventType: "SESSION_XP", sourceSessionId: input.candidate.sessionId } }
      });
      if (existing) return eventRecord(existing);
      const date = businessDateValue(input.activityDate);
      const sameContent = await transaction.gamificationEvent.count({
        where: {
          userId: input.candidate.userId, activityDate: date, eventType: "SESSION_XP",
          creditStatus: "AWARDED", points: { gt: 0 }, contentKeyHash: input.contentKeyHash
        }
      });
      const dailyAwards = await transaction.gamificationEvent.count({
        where: {
          userId: input.candidate.userId, activityDate: date, eventType: "SESSION_XP",
          creditStatus: "AWARDED", points: { gt: 0 }
        }
      });
      const creditStatus = sameContent > 0 ? "REPEAT_CONTENT" : dailyAwards >= 3 ? "DAILY_CAP" : "AWARDED";
      try {
        return eventRecord(await transaction.gamificationEvent.create({ data: {
          id: input.id,
          userId: input.candidate.userId,
          eventType: "SESSION_XP",
          creditStatus,
          ruleVersion: input.ruleVersion,
          points: creditStatus === "AWARDED" ? input.points : 0,
          occurredAt: new Date(input.candidate.completedAt!),
          activityDate: date,
          contentKeyHash: input.contentKeyHash,
          sourceSessionId: input.candidate.sessionId,
          sourceEvaluationId: input.candidate.evaluationId
        } }));
      } catch (error) {
        if (!isDuplicate(error)) throw error;
        const raced = await transaction.gamificationEvent.findUnique({
          where: { eventType_sourceSessionId: { eventType: "SESSION_XP", sourceSessionId: input.candidate.sessionId } }
        });
        if (!raced) throw error;
        return eventRecord(raced);
      }
    }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });
  }

  async createAssignmentEventAtomically(input: AssignmentEventInput): Promise<GamificationEventRecord> {
    return this.client.$transaction(async (transaction) => {
      await lockUser(transaction, input.candidate.userId);
      const existing = await transaction.gamificationEvent.findUnique({
        where: { eventType_sourceAssignmentId: { eventType: "ASSIGNMENT_XP", sourceAssignmentId: input.candidate.assignmentId } }
      });
      if (existing) return eventRecord(existing);
      try {
        return eventRecord(await transaction.gamificationEvent.create({ data: {
          id: input.id,
          userId: input.candidate.userId,
          eventType: "ASSIGNMENT_XP",
          creditStatus: "AWARDED",
          ruleVersion: input.ruleVersion,
          points: input.points,
          occurredAt: new Date(input.occurredAt),
          activityDate: businessDateValue(input.activityDate),
          sourceAssignmentId: input.candidate.assignmentId
        } }));
      } catch (error) {
        if (!isDuplicate(error)) throw error;
        const raced = await transaction.gamificationEvent.findUnique({
          where: { eventType_sourceAssignmentId: { eventType: "ASSIGNMENT_XP", sourceAssignmentId: input.candidate.assignmentId } }
        });
        if (!raced) throw error;
        return eventRecord(raced);
      }
    }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });
  }

  async getPersonalAggregate(userId: string, monthStart: Date, monthEnd: Date): Promise<PersonalGamificationAggregate> {
    const [total, month, creditedSessions, days, recent] = await Promise.all([
      this.client.gamificationEvent.aggregate({ where: { userId, creditStatus: "AWARDED", points: { gt: 0 } }, _sum: { points: true } }),
      this.client.gamificationEvent.aggregate({ where: { userId, creditStatus: "AWARDED", points: { gt: 0 }, occurredAt: { gte: monthStart, lt: monthEnd } }, _sum: { points: true } }),
      this.client.gamificationEvent.count({ where: { userId, eventType: "SESSION_XP", creditStatus: "AWARDED", points: { gt: 0 }, occurredAt: { gte: monthStart, lt: monthEnd } } }),
      this.client.gamificationEvent.findMany({
        where: { userId, eventType: "SESSION_XP", creditStatus: "AWARDED", points: { gt: 0 } },
        select: { activityDate: true }, distinct: ["activityDate"], orderBy: { activityDate: "asc" }
      }),
      this.client.gamificationEvent.findMany({
        where: { userId }, select: { eventType: true, creditStatus: true, points: true, occurredAt: true },
        orderBy: [{ occurredAt: "desc" }, { id: "desc" }], take: 10
      })
    ]);
    return {
      totalXp: total._sum.points ?? 0,
      currentMonthXp: month._sum.points ?? 0,
      creditedSessions,
      activityDates: days.map((day) => day.activityDate.toISOString().slice(0, 10)),
      recentActivities: recent.map((event) => ({ ...event, occurredAt: event.occurredAt.toISOString() }))
    };
  }

  async getLeaderboard(input: { monthStart: Date; monthEnd: Date; page: number; pageSize: number; currentUserId: string }): Promise<LeaderboardRepositoryPage> {
    const offset = (input.page - 1) * input.pageSize;
    const ranked = rankedSql(input.monthStart, input.monthEnd);
    const [rows, current, totals] = await this.client.$transaction([
      this.client.$queryRaw<RawLeaderboardRow[]>(Prisma.sql`${ranked} SELECT * FROM ranked ORDER BY rank_position LIMIT ${input.pageSize} OFFSET ${offset}`),
      this.client.$queryRaw<RawLeaderboardRow[]>(Prisma.sql`${ranked} SELECT * FROM ranked WHERE user_id = ${input.currentUserId}`),
      this.client.$queryRaw<Array<{ total: bigint }>>(Prisma.sql`${ranked} SELECT COUNT(*) AS total FROM ranked`)
    ]);
    return {
      rows: rows.map(leaderboardRow),
      currentUser: current[0] ? leaderboardRow(current[0]) : null,
      totalParticipants: Number(totals[0]?.total ?? 0)
    };
  }

  async listHistoricalSessionIds(): Promise<string[]> {
    return (await this.client.sessionEvaluation.findMany({
      where: { evaluatorVersion: EVALUATOR_VERSION, status: "COMPLETED", evaluatedAt: { not: null } },
      select: { sessionId: true }, orderBy: [{ evaluatedAt: "asc" }, { id: "asc" }]
    })).map((evaluation) => evaluation.sessionId);
  }

  async listHistoricalAssignmentIds(): Promise<string[]> {
    return (await this.client.trainingAssignment.findMany({ select: { id: true }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] })).map((assignment) => assignment.id);
  }

  countEvents(): Promise<number> { return this.client.gamificationEvent.count(); }
}

type TransactionClient = Prisma.TransactionClient;
type StoredEvent = Awaited<ReturnType<TransactionClient["gamificationEvent"]["create"]>>;
type RawLeaderboardRow = {
  rank_position: bigint;
  user_id: string;
  display_name: string;
  total_xp: bigint | number;
  period_xp: bigint | number;
  credited_sessions: bigint | number;
};

async function lockUser(transaction: TransactionClient, userId: string): Promise<void> {
  await transaction.$queryRaw(Prisma.sql`SELECT id FROM users WHERE id = ${userId} FOR UPDATE`);
}

function eventRecord(event: StoredEvent): GamificationEventRecord {
  return {
    id: event.id, userId: event.userId, eventType: event.eventType, creditStatus: event.creditStatus,
    ruleVersion: event.ruleVersion, points: event.points, occurredAt: event.occurredAt.toISOString(),
    activityDate: event.activityDate.toISOString().slice(0, 10), createdAt: event.createdAt.toISOString()
  };
}

function scenarioIdentity(value: unknown): string {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "unknown";
  const source = value as Record<string, unknown>;
  for (const key of ["id", "scenarioId", "scenario_id", "title"]) {
    if (typeof source[key] === "string" && source[key].trim()) return source[key].trim().slice(0, 200);
  }
  return "unknown";
}

function isDuplicate(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

function rankedSql(start: Date, end: Date): Prisma.Sql {
  return Prisma.sql`
    WITH period_scores AS (
      SELECT ge.user_id,
             SUM(ge.points) AS period_xp,
             SUM(CASE WHEN ge.event_type = 'SESSION_XP' AND ge.credit_status = 'AWARDED' AND ge.points > 0 THEN 1 ELSE 0 END) AS credited_sessions,
             MAX(ge.occurred_at) AS last_positive_at
      FROM gamification_events ge
      INNER JOIN users eligible ON eligible.id = ge.user_id AND eligible.role = 'SALE' AND eligible.status = 'ACTIVE'
      WHERE ge.occurred_at >= ${start} AND ge.occurred_at < ${end} AND ge.points > 0 AND ge.credit_status = 'AWARDED'
      GROUP BY ge.user_id
    ), all_time AS (
      SELECT user_id, SUM(points) AS total_xp
      FROM gamification_events
      WHERE points > 0 AND credit_status = 'AWARDED'
      GROUP BY user_id
    ), ranked AS (
      SELECT ROW_NUMBER() OVER (ORDER BY ps.period_xp DESC, ps.credited_sessions DESC, ps.last_positive_at ASC, ps.user_id ASC) AS rank_position,
             ps.user_id, u.display_name, COALESCE(atx.total_xp, 0) AS total_xp,
             ps.period_xp, ps.credited_sessions
      FROM period_scores ps
      INNER JOIN users u ON u.id = ps.user_id
      LEFT JOIN all_time atx ON atx.user_id = ps.user_id
    )`;
}

function leaderboardRow(row: RawLeaderboardRow): LeaderboardRepositoryRow {
  return {
    rank: Number(row.rank_position), userId: row.user_id, displayName: row.display_name,
    totalXp: Number(row.total_xp), currentMonthXp: Number(row.period_xp), creditedSessions: Number(row.credited_sessions)
  };
}
