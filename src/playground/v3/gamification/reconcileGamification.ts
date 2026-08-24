import { prisma } from "../prismaClient";
import {
  assignmentCompletionTime,
  businessDate,
  contentKeyHash,
  isEligibleSession,
  sessionXp
} from "./gamificationDomain";
import { DatabaseGamificationRepository } from "./databaseGamificationRepository";
import { GamificationService } from "./gamificationService";

interface Report {
  mode: "DRY_RUN" | "APPLY";
  candidateSessions: number;
  qualifyingSessions: number;
  insertedSessionEvents: number;
  sessionXpAwarded: number;
  repeatContent: number;
  dailyCap: number;
  assignmentCandidates: number;
  insertedAssignmentEvents: number;
  assignmentXpAwarded: number;
  expectedOrPersistedXp: number;
  unresolvedSources: string[];
}

async function main(): Promise<void> {
  const apply = process.argv.includes("--apply");
  const repository = new DatabaseGamificationRepository(prisma);
  const service = new GamificationService(repository);
  const sessionIds = await repository.listHistoricalSessionIds();
  const assignmentIds = await repository.listHistoricalAssignmentIds();
  const existing = await prisma.gamificationEvent.findMany({
    select: { eventType: true, sourceSessionId: true, sourceAssignmentId: true, userId: true, activityDate: true, contentKeyHash: true, creditStatus: true, points: true }
  });
  const existingSessions = new Set(existing.flatMap((event) => event.sourceSessionId ? [event.sourceSessionId] : []));
  const existingAssignments = new Set(existing.flatMap((event) => event.sourceAssignmentId ? [event.sourceAssignmentId] : []));
  const awarded = existing.filter((event) => event.eventType === "SESSION_XP" && event.creditStatus === "AWARDED" && event.points > 0)
    .map((event) => ({ userId: event.userId, date: event.activityDate.toISOString().slice(0, 10), contentKeyHash: event.contentKeyHash ?? "" }));
  const report: Report = {
    mode: apply ? "APPLY" : "DRY_RUN", candidateSessions: sessionIds.length, qualifyingSessions: 0,
    insertedSessionEvents: 0, sessionXpAwarded: 0, repeatContent: 0, dailyCap: 0,
    assignmentCandidates: assignmentIds.length, insertedAssignmentEvents: 0, assignmentXpAwarded: 0,
    expectedOrPersistedXp: 0, unresolvedSources: []
  };

  for (const sessionId of sessionIds) {
    try {
      const candidate = await repository.findSessionCandidate(sessionId);
      if (!candidate) { report.unresolvedSources.push(`SESSION:${sessionId}`); continue; }
      if (!isEligibleSession(candidate)) continue;
      report.qualifyingSessions += 1;
      if (existingSessions.has(sessionId)) continue;
      const date = businessDate(candidate.completedAt!);
      const key = contentKeyHash(candidate);
      const sameContent = awarded.some((event) => event.userId === candidate.userId && event.date === date && event.contentKeyHash === key);
      const dayCount = awarded.filter((event) => event.userId === candidate.userId && event.date === date).length;
      const status = sameContent ? "REPEAT_CONTENT" : dayCount >= 3 ? "DAILY_CAP" : "AWARDED";
      const points = status === "AWARDED" ? sessionXp(candidate.overallScore!) : 0;
      if (status === "AWARDED") { report.sessionXpAwarded += 1; awarded.push({ userId: candidate.userId, date, contentKeyHash: key }); }
      else if (status === "REPEAT_CONTENT") report.repeatContent += 1;
      else report.dailyCap += 1;
      report.expectedOrPersistedXp += points;
      if (apply) {
        const event = await service.reconcileSession(sessionId);
        if (event) report.insertedSessionEvents += 1;
      }
    } catch { report.unresolvedSources.push(`SESSION:${sessionId}`); }
  }

  for (const assignmentId of assignmentIds) {
    try {
      const candidate = await repository.findAssignmentCandidate(assignmentId);
      if (!candidate) { report.unresolvedSources.push(`ASSIGNMENT:${assignmentId}`); continue; }
      if (!assignmentCompletionTime(candidate) || existingAssignments.has(assignmentId)) continue;
      report.assignmentXpAwarded += 1;
      report.expectedOrPersistedXp += 50;
      if (apply) {
        const event = await service.reconcileAssignment(assignmentId);
        if (event) report.insertedAssignmentEvents += 1;
      }
    } catch { report.unresolvedSources.push(`ASSIGNMENT:${assignmentId}`); }
  }

  if (apply) {
    const totals = await prisma.gamificationEvent.aggregate({ where: { creditStatus: "AWARDED", points: { gt: 0 } }, _sum: { points: true } });
    report.expectedOrPersistedXp = totals._sum.points ?? 0;
  }
  console.log(JSON.stringify(report, null, 2));
  if (report.unresolvedSources.length > 0) process.exitCode = 2;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "GAMIFICATION_RECONCILIATION_FAILED");
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
