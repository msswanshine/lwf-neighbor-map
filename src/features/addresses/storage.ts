import type {
  AddressPersisted,
  FireAssessmentTool,
  LetterGrade,
  ParticipantType,
} from "./types";

export function mergeGradeAndEngagement(
  list: AddressPersisted[],
  updates: {
    id: string;
    grade?: LetterGrade | null;
    engagementCount?: number;
    participantType?: ParticipantType;
    assessmentTool?: FireAssessmentTool;
  },
): AddressPersisted[] {
  return list.map((a) =>
    a.id === updates.id
      ? {
          ...a,
          ...(updates.grade !== undefined ? { grade: updates.grade } : {}),
          ...(updates.engagementCount !== undefined
            ? { engagementCount: updates.engagementCount }
            : {}),
          ...(updates.participantType !== undefined
            ? { participantType: updates.participantType }
            : {}),
          ...(updates.assessmentTool !== undefined
            ? { assessmentTool: updates.assessmentTool }
            : {}),
        }
      : a,
  );
}
