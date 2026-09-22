import { notFound } from 'next/navigation';
import { OneTap } from '@/components/staff/forms';
import { StaffShell } from '@/components/staff/StaffShell';
import { Back, Button, Pill, Screen, Section } from '@/components/staff/ui';
import { formatDate } from '@/lib/staff/time';
import { beginTraining, finishReading } from '@/server/actions/staff/training';
import { getAssignment, getModule } from '@/server/staff/training';
import { isDenied, staffPage } from '../../_lib';
import { Quiz } from './Quiz';

export const dynamic = 'force-dynamic';

/** A module, read top to bottom, ending in "I've read this" or a quiz. */
export default async function ModulePage({ params }: { params: Promise<{ id: string }> }) {
  const page = await staffPage('training.view_self');
  if (isDenied(page)) return page.denied;
  const { context, db, unread } = page;
  const { id } = await params;
  const lesson = await getModule(db, id);
  if (!lesson || (lesson.status !== 'published' && !context.isManager)) notFound();
  const assignment = context.employee ? await getAssignment(db, context.employee.id, id) : null;
  const complete = assignment?.status === 'completed' && !assignment.outdated;

  return (
    <StaffShell context={context} unread={unread}>
      <Back href="/staff/training" label="Training" />
      <Screen
        title={lesson.title}
        eyebrow={[lesson.category.replace('_', ' '), lesson.estimatedMinutes ? `${lesson.estimatedMinutes} min` : null, `v${lesson.version}`].filter(Boolean).join(' · ')}
        lead={lesson.description}
        actions={context.isManager ? <Button href={`/staff/operations/training/${lesson.id}`} small>Manage</Button> : undefined}
      >
        {assignment ? (
          <div className="flex flex-wrap items-center gap-2 text-[0.875rem] text-brown-soft">
            {complete ? <Pill tone="good">Completed{assignment.score !== null ? ` · ${assignment.score}%` : ''}</Pill> : assignment.outdated ? <Pill tone="warn">New version — do it again</Pill> : assignment.status === 'expired' ? <Pill tone="warn">Needs renewing</Pill> : assignment.overdue ? <Pill tone="bad">Overdue</Pill> : lesson.required ? <Pill tone="accent">Required</Pill> : null}
            {assignment.dueOn && !complete ? <span>Due {formatDate(assignment.dueOn, 'short')}</span> : null}
            {assignment.status === 'assigned' ? (
              <OneTap action={beginTraining} fields={{ assignmentId: assignment.id }} variant="quiet" quiet>
                Mark as started
              </OneTap>
            ) : null}
          </div>
        ) : null}

        <div className="grid gap-6">
          {lesson.sections.map((section) => (
            <article key={section.id} className="staff-panel px-5 py-4">
              {section.title ? <h2 className="text-[1.125rem] font-semibold text-brown">{section.title}</h2> : null}
              {section.kind === 'video' && section.mediaUrl ? (
                <div className="mt-3 overflow-hidden rounded-(--radius-md)">
                  {/^https?:\/\/(www\.)?(youtube\.com|youtu\.be|vimeo\.com)/.test(section.mediaUrl) ? (
                    <iframe src={embedUrl(section.mediaUrl)} title={section.title || 'Video'} className="aspect-video w-full" allow="accelerometer; autoplay; encrypted-media; picture-in-picture" allowFullScreen />
                  ) : (
                    <video src={section.mediaUrl} controls playsInline className="w-full" />
                  )}
                </div>
              ) : null}
              {section.kind === 'image' && section.mediaUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- training media lives wherever a manager linked it
                <img src={section.mediaUrl} alt={section.title || 'Diagram'} className="mt-3 w-full rounded-(--radius-md)" />
              ) : null}
              {section.body ? <p className="mt-2 whitespace-pre-line text-[1rem] leading-relaxed text-brown">{section.body}</p> : null}
              {section.kind === 'checklist' && section.items.length > 0 ? (
                <ul className="mt-3 grid gap-1.5">
                  {section.items.map((item) => (
                    <li key={item} className="flex items-start gap-2.5 text-[0.9375rem] text-brown">
                      <span aria-hidden="true" className="mt-1 size-2 shrink-0 rounded-full bg-amber" />
                      {item}
                    </li>
                  ))}
                </ul>
              ) : null}
              {section.kind === 'link' && section.mediaUrl ? (
                <p className="mt-3">
                  <a href={section.mediaUrl} target={section.mediaUrl.startsWith('/') ? undefined : '_blank'} rel="noreferrer" className="inline-flex min-h-11 items-center rounded-(--radius-sm) border border-brown/30 px-4 text-[0.9375rem] font-semibold text-brown">
                    Open {section.title || 'the resource'} {section.mediaUrl.startsWith('/') ? '' : '↗'}
                  </a>
                </p>
              ) : null}
            </article>
          ))}
        </div>

        {assignment && !complete ? (
          lesson.questions.length > 0 ? (
            <Section title="Quiz">
              <Quiz moduleId={lesson.id} questions={lesson.questions} passingScore={lesson.passingScore} />
            </Section>
          ) : (
            <Section title="Finished reading?">
              <OneTap action={finishReading} fields={{ moduleId: lesson.id }}>
                I’ve read and understood this
              </OneTap>
            </Section>
          )
        ) : null}
        {!assignment && context.employee ? <p className="text-[0.875rem] text-brown-soft">This module is not assigned to you. You can still read it; a manager can assign it if it applies.</p> : null}
      </Screen>
    </StaffShell>
  );
}

function embedUrl(url: string): string {
  const youtube = /(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/.exec(url);
  if (youtube) return `https://www.youtube-nocookie.com/embed/${youtube[1]}`;
  const vimeo = /vimeo\.com\/(\d+)/.exec(url);
  if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}`;
  return url;
}
