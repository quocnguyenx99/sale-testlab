import { randomUUID } from "crypto";
import type { PublicLeaderboard, PublicLeaderboardRow, PublicPersonalGamification } from "../publicContracts";
import {
  ASSIGNMENT_COMPLETION_XP,
  assignmentCompletionTime,
  businessDate,
  contentKeyHash,
  currentMonthPeriod,
  GAMIFICATION_RULE_VERSION,
  isEligibleSession,
  levelProgress,
  sessionXp,
  streaks
} from "./gamificationDomain";
import type { GamificationRepository, LeaderboardRepositoryRow } from "./gamificationRepository";

export type GamificationErrorCode = "GAMIFICATION_FORBIDDEN" | "INVALID_GAMIFICATION_QUERY";

export class GamificationServiceError extends Error {
  constructor(public readonly code: GamificationErrorCode, message: string) {
    super(message);
    this.name = "GamificationServiceError";
  }
}

export class GamificationService {
  private readonly now: () => Date;
  private readonly createId: () => string;

  constructor(private readonly repository: GamificationRepository, options: { now?: () => Date; createId?: () => string } = {}) {
    this.now = options.now ?? (() => new Date());
    this.createId = options.createId ?? randomUUID;
  }

  async reconcileSession(sessionId: string) {
    const candidate = await this.repository.findSessionCandidate(sessionId);
    if (!candidate || !isEligibleSession(candidate)) return null;
    return this.repository.createSessionEventAtomically({
      id: this.createId(), candidate, points: sessionXp(candidate.overallScore!),
      activityDate: businessDate(candidate.completedAt!), contentKeyHash: contentKeyHash(candidate),
      ruleVersion: GAMIFICATION_RULE_VERSION
    });
  }

  async reconcileAssignmentForSession(sessionId: string) {
    const assignmentId = await this.repository.findAssignmentIdForSession(sessionId);
    return assignmentId ? this.reconcileAssignment(assignmentId) : null;
  }

  async reconcileAssignment(assignmentId: string) {
    const candidate = await this.repository.findAssignmentCandidate(assignmentId);
    if (!candidate) return null;
    const occurredAt = assignmentCompletionTime(candidate);
    if (!occurredAt) return null;
    return this.repository.createAssignmentEventAtomically({
      id: this.createId(), candidate, points: ASSIGNMENT_COMPLETION_XP, occurredAt,
      activityDate: businessDate(occurredAt), ruleVersion: GAMIFICATION_RULE_VERSION
    });
  }

  async getPersonal(user: { id: string; role: "SALE" | "MANAGER" | "ADMIN" }): Promise<PublicPersonalGamification> {
    if (user.role !== "SALE") throw new GamificationServiceError("GAMIFICATION_FORBIDDEN", "Chỉ nhân viên SALE có hồ sơ Gamification cá nhân.");
    const period = currentMonthPeriod(this.now());
    const [aggregate, leaderboard] = await Promise.all([
      this.repository.getPersonalAggregate(user.id, new Date(period.startAt), new Date(period.endAt)),
      this.repository.getLeaderboard({ monthStart: new Date(period.startAt), monthEnd: new Date(period.endAt), page: 1, pageSize: 1, currentUserId: user.id })
    ]);
    return {
      ruleVersion: GAMIFICATION_RULE_VERSION,
      timezone: period.timezone,
      ...levelProgress(aggregate.totalXp),
      ...streaks(aggregate.activityDates, this.now()),
      currentMonth: { xp: aggregate.currentMonthXp, rank: leaderboard.currentUser?.rank ?? null, creditedSessions: aggregate.creditedSessions },
      recentActivities: aggregate.recentActivities.map((activity) => ({
        type: activity.eventType, creditStatus: activity.creditStatus, points: activity.points, occurredAt: activity.occurredAt
      }))
    };
  }

  async getLeaderboard(currentUserId: string, pageInput: unknown, pageSizeInput: unknown): Promise<PublicLeaderboard> {
    const page = integer(pageInput, 1, 1, Number.MAX_SAFE_INTEGER);
    const pageSize = integer(pageSizeInput, 25, 1, 100);
    const period = currentMonthPeriod(this.now());
    const result = await this.repository.getLeaderboard({
      monthStart: new Date(period.startAt), monthEnd: new Date(period.endAt), page, pageSize, currentUserId
    });
    return {
      period,
      rows: result.rows.map((row) => publicRow(row, currentUserId)),
      totalParticipants: result.totalParticipants,
      totalPages: result.totalParticipants === 0 ? 0 : Math.ceil(result.totalParticipants / pageSize),
      currentUser: result.currentUser ? publicRow(result.currentUser, currentUserId) : null,
      page,
      pageSize
    };
  }

  async reconcileAll(): Promise<{ sessionEvents: number; assignmentEvents: number; unresolved: string[] }> {
    const unresolved: string[] = [];
    let sessionEvents = 0;
    let assignmentEvents = 0;
    for (const sessionId of await this.repository.listHistoricalSessionIds()) {
      try { if (await this.reconcileSession(sessionId)) sessionEvents += 1; } catch { unresolved.push(`SESSION:${sessionId}`); }
    }
    for (const assignmentId of await this.repository.listHistoricalAssignmentIds()) {
      try { if (await this.reconcileAssignment(assignmentId)) assignmentEvents += 1; } catch { unresolved.push(`ASSIGNMENT:${assignmentId}`); }
    }
    return { sessionEvents, assignmentEvents, unresolved };
  }
}

function integer(value: unknown, fallback: number, min: number, max: number): number {
  if (value === null || value === undefined || value === "") return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new GamificationServiceError("INVALID_GAMIFICATION_QUERY", "Tham số phân trang không hợp lệ.");
  }
  return parsed;
}

function publicRow(row: LeaderboardRepositoryRow, currentUserId: string): PublicLeaderboardRow {
  return {
    rank: row.rank,
    displayName: row.displayName,
    level: levelProgress(row.totalXp).level,
    currentMonthXp: row.currentMonthXp,
    creditedSessions: row.creditedSessions,
    isCurrentUser: row.userId === currentUserId
  };
}
