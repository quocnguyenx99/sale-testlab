import type { AssignmentProgramRecord, TrainingAssigneeRecord, TrainingAssignmentRecord } from "./trainingAssignmentDomain";

export interface TrainingAssignmentRepository {
  listManagedAssignments(): Promise<TrainingAssignmentRecord[]>;
  listAssignmentsForUser(userId: string): Promise<TrainingAssignmentRecord[]>;
  findById(id: string): Promise<TrainingAssignmentRecord | null>;
  findByIdForUser(id: string, userId: string): Promise<TrainingAssignmentRecord | null>;
  findActiveDuplicate(programId: string, assignedToUserId: string): Promise<TrainingAssignmentRecord | null>;
  findProgramById(id: string): Promise<AssignmentProgramRecord | null>;
  findUserById(id: string): Promise<TrainingAssigneeRecord | null>;
  listAssignableSaleUsers(): Promise<TrainingAssigneeRecord[]>;
  createAssignment(input: {
    id: string;
    programId: string;
    assignedToUserId: string;
    assignedByUserId: string;
    dueAt: string | null;
  }): Promise<TrainingAssignmentRecord>;
  cancelAssignment(id: string, cancelledAt: string, expectedUpdatedAt: string): Promise<TrainingAssignmentRecord | null>;
}
