import type {
  AssignmentXpCandidate,
  GamificationCreditStatus,
  GamificationEventRecord,
  SessionXpCandidate
} from "./gamificationDomain";

export interface SessionEventInput {
  id: string;
  candidate: SessionXpCandidate;
  points: number;
  activityDate: string;
  contentKeyHash: string;
  ruleVersion: string;
}

export interface AssignmentEventInput {
  id: string;
  candidate: AssignmentXpCandidate;
  points: number;
  occurredAt: string;
  activityDate: string;
  ruleVersion: string;
}

export interface PersonalGamificationAggregate {
  totalXp: number;
  currentMonthXp: number;
  creditedSessions: number;
  activityDates: string[];
  recentActivities: Array<{
    eventType: "SESSION_XP" | "ASSIGNMENT_XP";
    creditStatus: GamificationCreditStatus;
    points: number;
    occurredAt: string;
  }>;
}

export interface LeaderboardRepositoryRow {
  rank: number;
  userId: string;
  displayName: string;
  totalXp: number;
  currentMonthXp: number;
  creditedSessions: number;
}

export interface LeaderboardRepositoryPage {
  rows: LeaderboardRepositoryRow[];
  currentUser: LeaderboardRepositoryRow | null;
  totalParticipants: number;
}

export interface GamificationRepository {
  findSessionCandidate(sessionId: string): Promise<SessionXpCandidate | null>;
  findAssignmentCandidate(assignmentId: string): Promise<AssignmentXpCandidate | null>;
  findAssignmentIdForSession(sessionId: string): Promise<string | null>;
  createSessionEventAtomically(input: SessionEventInput): Promise<GamificationEventRecord>;
  createAssignmentEventAtomically(input: AssignmentEventInput): Promise<GamificationEventRecord>;
  getPersonalAggregate(userId: string, monthStart: Date, monthEnd: Date): Promise<PersonalGamificationAggregate>;
  getLeaderboard(input: { monthStart: Date; monthEnd: Date; page: number; pageSize: number; currentUserId: string }): Promise<LeaderboardRepositoryPage>;
  listHistoricalSessionIds(): Promise<string[]>;
  listHistoricalAssignmentIds(): Promise<string[]>;
  countEvents(): Promise<number>;
}
