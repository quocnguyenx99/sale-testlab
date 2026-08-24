export interface GamificationActivity {
  type: 'SESSION_XP' | 'ASSIGNMENT_XP'
  creditStatus: 'AWARDED' | 'REPEAT_CONTENT' | 'DAILY_CAP'
  points: number
  occurredAt: string
}

export interface PersonalGamification {
  ruleVersion: string
  timezone: string
  totalXp: number
  level: number
  currentLevelXp: number
  xpToNextLevel: number
  currentStreakDays: number
  bestStreakDays: number
  currentMonth: { xp: number; rank: number | null; creditedSessions: number }
  recentActivities: GamificationActivity[]
}

export interface LeaderboardRow {
  rank: number
  displayName: string
  level: number
  currentMonthXp: number
  creditedSessions: number
  isCurrentUser: boolean
}

export interface LeaderboardData {
  period: { type: 'CURRENT_MONTH'; startAt: string; endAt: string; timezone: string }
  rows: LeaderboardRow[]
  totalParticipants: number
  totalPages: number
  currentUser: LeaderboardRow | null
  page: number
  pageSize: number
}
