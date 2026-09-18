"use client";

import { useRouter } from "next/navigation";
import { Card } from "@/app/components/ui/Card";
import {
  formatInstructorStudyProgress,
  formatInstructorWeeklyParticipation,
  type InstructorStudentDto,
} from "@/src/lib/instructor/instructor-student";
import { COURSE_SECTIONS, isCourseSection, type CourseSection } from "@/src/lib/profile.types";

type InstructorDashboardProps = {
  section: CourseSection;
  students: InstructorStudentDto[];
  error?: string | null;
};

export function InstructorDashboard({
  section,
  students,
  error = null,
}: InstructorDashboardProps) {
  const router = useRouter();

  return (
    <div className="w-full space-y-5">
      <section className="space-y-1.5 text-center sm:text-left">
        <p className="text-sm font-medium uppercase tracking-wider text-brand-700">
          Instructor
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-text-primary sm:text-3xl">
          Instructor Dashboard
        </h1>
        <p className="text-sm leading-relaxed text-text-secondary">
          Review study progress and this week&apos;s participation by class
          section.
        </p>
      </section>

      <Card variant="featured">
        <div className="space-y-4">
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-text-secondary">Section</span>
            <select
              className="w-full rounded-[var(--radius)] border border-border-strong bg-surface px-3 py-2.5 text-sm text-text-primary shadow-[var(--shadow-sm)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
              value={section}
              onChange={(event) => {
                const nextSection = event.target.value;

                if (!isCourseSection(nextSection)) {
                  return;
                }

                router.push(
                  `/instructor?section=${encodeURIComponent(nextSection)}`,
                );
              }}
            >
              {COURSE_SECTIONS.map((courseSection) => (
                <option key={courseSection} value={courseSection}>
                  {courseSection}
                </option>
              ))}
            </select>
          </label>

          {error ? (
            <p className="text-sm text-error-text" aria-live="polite">
              {error}
            </p>
          ) : null}

          {students.length === 0 && !error ? (
            <p className="text-sm text-text-secondary">
              No students in this section.
            </p>
          ) : null}

          {students.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-text-muted">
                    <th className="py-2 pr-4 font-medium">Student</th>
                    <th className="py-2 pr-4 font-medium">Study Progress</th>
                    <th className="py-2 font-medium">Weekly Participation</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((student) => (
                    <tr
                      key={`${student.section}:${student.username}`}
                      className="border-b border-border last:border-b-0"
                    >
                      <td className="py-3 pr-4 font-medium text-text-primary">
                        {student.username}
                      </td>
                      <td className="py-3 pr-4 text-text-secondary">
                        {formatInstructorStudyProgress(student)}
                      </td>
                      <td className="py-3 text-text-secondary">
                        {formatInstructorWeeklyParticipation(student)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      </Card>
    </div>
  );
}
