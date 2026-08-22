import type { PersistedActiveStudySession } from "@/src/lib/active-study-session";
import type { CurriculumId } from "@/src/lib/curriculum";
import type {
  CourseProgressStore,
  MasteryProgressStore,
} from "@/src/lib/progress.types";

export const LEARNER_PROGRESS_SCHEMA_VERSION = 1;

export const CURRICULUM_ASSIGNMENT_STORAGE_KEY = "myomaster-curriculum-id";

export type PersistedStudyState = {
  courseProgress: CourseProgressStore;
  masteryProgress: MasteryProgressStore;
  activeStudySession: PersistedActiveStudySession | null;
  muscleBriefViewedIds: string[];
  curriculumId?: CurriculumId;
};

export type PersistedLearnerProgress = {
  schemaVersion: typeof LEARNER_PROGRESS_SCHEMA_VERSION;
  savedAt: string;
  curriculumId?: CurriculumId;
  state: PersistedStudyState;
};

export type LearnerProgressRow = {
  user_id: string;
  progress_data: PersistedLearnerProgress;
  revision: number;
  updated_at: string;
};

export type LearnerProgressSaveStatus =
  | "idle"
  | "saving"
  | "saved"
  | "error"
  | "conflict";

export const PROGRESS_LOAD_ERROR_MESSAGE =
  "We couldn't load your saved progress.";

export const PROGRESS_SAVE_ERROR_MESSAGE = "Progress not saved";

export const PROGRESS_CONFLICT_MESSAGE =
  "Your progress changed on another device. Reload to continue with the newest version.";

export const LOGOUT_UNSAVED_WARNING =
  "Your latest progress may not be saved.";

export const LOCAL_PROGRESS_OWNER_STORAGE_KEY =
  "myomaster-local-progress-owner";

export const LOCAL_MIGRATION_MARKER_PREFIX =
  "myomaster-progress-migrated:";
