import { createHash } from "crypto";

export const GAMIFICATION_RULE_VERSION = "testlab-gamification-v1";
export const GAMIFICATION_TIME_ZONE = "Asia/Ho_Chi_Minh";
export const MINIMUM_SALE_TURNS = 3;
export const SESSION_BASE_XP = 20;
export const ASSIGNMENT_COMPLETION_XP = 50;
export const DAILY_SESSION_AWARD_CAP = 3;
export const XP_PER_LEVEL = 250;

export type GamificationEventType = "SESSION_XP" | "ASSIGNMENT_XP";
export type GamificationCreditStatus = "AWARDED" | "REPEAT_CONTENT" | "DAILY_CAP";

export interface SessionXpCandidate {
  sessionId: string;
  evaluationId: string;
  userId: string;
  userRole: "SALE" | "MANAGER" | "ADMIN";
  userStatus: "ACTIVE" | "DISABLED";
  sessionStatus: "RUNNING" | "COMPLETED";
  completedAt: string | null;
  evaluatorVersion: string;
  evaluationStatus: "COMPLETED" | "FAILED";
  overallScore: number | null;
  evaluatedAt: string | null;
  saleTurnCount: number;
  personaId: string;
  personaVersionId: string | null;
  scenarioVersionId: string | null;
  scenarioIdentity: string;
  mode: "CUSTOMER_FIRST" | "SALE_FIRST";
}

export interface AssignmentXpCandidate {
  assignmentId: string;
  userId: string;
  userRole: "SALE" | "MANAGER" | "ADMIN";
  userStatus: "ACTIVE" | "DISABLED";
  cancelledAt: string | null;
  requiredItemIds: string[];
  completedSessions: Array<{ itemId: string; completedAt: string; sessionId: string }>;
}

export interface GamificationEventRecord {
  id: string;
  userId: string;
  eventType: GamificationEventType;
  creditStatus: GamificationCreditStatus;
  ruleVersion: string;
  points: number;
  occurredAt: string;
  activityDate: string;
  createdAt: string;
}

export interface GamificationPeriod {
  type: "CURRENT_MONTH";
  startAt: string;
  endAt: string;
  timezone: typeof GAMIFICATION_TIME_ZONE;
}

export function qualityBonus(score: number): number {
  if (!validScore(score)) throw new Error("INVALID_EVALUATION_SCORE");
  if (score >= 90) return 20;
  if (score >= 80) return 15;
  if (score >= 70) return 10;
  if (score >= 60) return 5;
  return 0;
}

export function sessionXp(score: number): number {
  return SESSION_BASE_XP + qualityBonus(score);
}

export function validScore(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 100;
}

export function isEligibleSession(candidate: SessionXpCandidate): boolean {
  return candidate.userRole === "SALE"
    && candidate.userStatus === "ACTIVE"
    && candidate.sessionStatus === "COMPLETED"
    && Boolean(candidate.completedAt)
    && candidate.evaluatorVersion === "testlab-evaluator-v1"
    && candidate.evaluationStatus === "COMPLETED"
    && validScore(candidate.overallScore)
    && Boolean(candidate.evaluatedAt)
    && candidate.saleTurnCount >= MINIMUM_SALE_TURNS;
}

export function contentKeyHash(candidate: SessionXpCandidate): string {
  const versioned = candidate.personaVersionId && candidate.scenarioVersionId
    ? `versioned:${candidate.personaVersionId}:${candidate.scenarioVersionId}:${candidate.mode}`
    : `legacy:${candidate.personaId}:${candidate.scenarioIdentity}:${candidate.mode}`;
  return createHash("sha256").update(versioned).digest("hex");
}

export function businessDate(instant: string | Date): string {
  const date = typeof instant === "string" ? new Date(instant) : instant;
  if (!Number.isFinite(date.getTime())) throw new Error("INVALID_GAMIFICATION_TIMESTAMP");
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: GAMIFICATION_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

export function businessDateValue(value: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("INVALID_BUSINESS_DATE");
  return new Date(`${value}T00:00:00.000Z`);
}

export function currentMonthPeriod(reference: Date): GamificationPeriod {
  const [year, month] = businessDate(reference).split("-").map(Number);
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  return {
    type: "CURRENT_MONTH",
    startAt: vietnamMidnightUtc(year, month, 1).toISOString(),
    endAt: vietnamMidnightUtc(nextYear, nextMonth, 1).toISOString(),
    timezone: GAMIFICATION_TIME_ZONE
  };
}

export function levelProgress(totalXpInput: number): { totalXp: number; level: number; currentLevelXp: number; xpToNextLevel: number } {
  const totalXp = Number.isFinite(totalXpInput) ? Math.max(0, Math.floor(totalXpInput)) : 0;
  const currentLevelXp = totalXp % XP_PER_LEVEL;
  return {
    totalXp,
    level: 1 + Math.floor(totalXp / XP_PER_LEVEL),
    currentLevelXp,
    xpToNextLevel: XP_PER_LEVEL - currentLevelXp
  };
}

export function streaks(activityDates: readonly string[], reference: Date): { currentStreakDays: number; bestStreakDays: number } {
  const dates = [...new Set(activityDates.filter((value) => /^\d{4}-\d{2}-\d{2}$/.test(value)))].sort();
  if (!dates.length) return { currentStreakDays: 0, bestStreakDays: 0 };
  let best = 1;
  let run = 1;
  for (let index = 1; index < dates.length; index += 1) {
    run = dayDifference(dates[index - 1], dates[index]) === 1 ? run + 1 : 1;
    best = Math.max(best, run);
  }
  const today = businessDate(reference);
  const latest = dates.at(-1)!;
  const lag = dayDifference(latest, today);
  if (lag < 0 || lag > 1) return { currentStreakDays: 0, bestStreakDays: best };
  let current = 1;
  for (let index = dates.length - 1; index > 0; index -= 1) {
    if (dayDifference(dates[index - 1], dates[index]) !== 1) break;
    current += 1;
  }
  return { currentStreakDays: current, bestStreakDays: best };
}

export function assignmentCompletionTime(candidate: AssignmentXpCandidate): string | null {
  if (candidate.userRole !== "SALE" || candidate.userStatus !== "ACTIVE" || candidate.cancelledAt || candidate.requiredItemIds.length === 0) return null;
  const firstByItem = candidate.requiredItemIds.map((itemId) => candidate.completedSessions
    .filter((session) => session.itemId === itemId)
    .sort((left, right) => Date.parse(left.completedAt) - Date.parse(right.completedAt) || left.sessionId.localeCompare(right.sessionId))[0] ?? null);
  if (firstByItem.some((session) => session === null)) return null;
  return firstByItem.map((session) => session!.completedAt).sort((left, right) => Date.parse(right) - Date.parse(left))[0];
}

function vietnamMidnightUtc(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day, -7, 0, 0, 0));
}

function dayDifference(left: string, right: string): number {
  return Math.round((Date.parse(`${right}T00:00:00.000Z`) - Date.parse(`${left}T00:00:00.000Z`)) / 86_400_000);
}
