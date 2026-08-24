import type { Difficulty } from './training'

export type ContentVersionStatus = 'DRAFT' | 'PUBLISHED'
export interface VersionSummary { id: string; version: number; status: ContentVersionStatus; publishedAt: string | null; updatedAt: string }
export interface ManagedPersonaSummary { id: string; origin: 'LEGACY_IMPORT' | 'MANAGED'; archivedAt: string | null; latestPublished: VersionSummary | null; draft: VersionSummary | null; displayName: string; linkedScenarioCount: number; hasUsableScenario: boolean; updatedAt: string }
export interface ManagedScenarioSummary { id: string; origin: 'LEGACY_IMPORT' | 'MANAGED'; archivedAt: string | null; latestPublished: VersionSummary | null; draft: VersionSummary | null; title: string; linkedPersonaCount: number; updatedAt: string }
export interface PersonaFields { displayName: string; buyerRole: string; organizationType: string; difficulty: Difficulty; summary: string; productInterests: string[]; purchaseContext: string; behaviorTraits: string[]; commonObjections: string[]; likelyQuestions: string[]; trainingFocus: string[] }
export interface ScenarioFields { title: string; description: string; difficulty: Difficulty; category: string; customerNeed: string; priorities: string[]; trainingObjective: string; tags: string[]; openingExamples: string[] }
export interface ManagedPersonaDetail extends ManagedPersonaSummary { versions: VersionSummary[]; currentVersion: VersionSummary & PersonaFields; scenarioLinks: Array<{ scenarioId: string; title: string; isDefault: boolean; sortOrder: number; available: boolean }> }
export interface ManagedScenarioDetail extends ManagedScenarioSummary { versions: VersionSummary[]; currentVersion: VersionSummary & ScenarioFields; personaLinks: Array<{ personaId: string; displayName: string; isDefault: boolean }> }
