'use client';

import type { TrainingQuestion } from '@/content/staff-types';
import { submitQuiz } from '@/server/actions/staff/training';
import { ActionForm, SubmitButton } from '@/components/staff/forms';

/**
 * The quiz. The browser holds the questions and the options; the answers
 * are graded on the server and come back in the result, per question, only
 * after submitting.
 */
export function Quiz({ moduleId, questions, passingScore }: { moduleId: string; questions: TrainingQuestion[]; passingScore: number | null }) {
  return (
    <ActionForm action={submitQuiz} className="grid gap-5">
      {(state) => (
        <>
          <input type="hidden" name="moduleId" value={moduleId} />
          {questions.map((question, index) => {
            const verdict = state.errors?.[question.id];
            const correctIds = verdict?.startsWith('wrong:') ? verdict.split(':')[1]?.split(',') ?? [] : [];
            const explanation = verdict?.startsWith('wrong:') ? verdict.split(':').slice(2).join(':') : '';
            const multi = question.kind === 'multi_select';
            return (
              <fieldset key={question.id} className={`staff-panel px-4 py-3.5 ${verdict === 'correct' ? 'border-success/50' : verdict ? 'border-danger/50' : ''}`}>
                <legend className="sr-only">Question {index + 1}</legend>
                <p className="text-[0.75rem] font-semibold uppercase tracking-[0.1em] text-brown-soft">
                  Question {index + 1} of {questions.length}
                  {multi ? ' · choose all that apply' : ''}
                </p>
                <p className="mt-1 text-[1rem] font-semibold text-brown">{question.prompt}</p>
                <div className="mt-2 grid gap-1">
                  {question.options.map((option) => {
                    const isCorrect = correctIds.includes(option.id);
                    return (
                      <label key={option.id} className={`flex min-h-11 items-center gap-2.5 rounded-(--radius-sm) px-2 text-[0.9375rem] text-brown ${isCorrect ? 'bg-success/10' : ''}`}>
                        <input type={multi ? 'checkbox' : 'radio'} name={`q:${question.id}`} value={option.id} className="size-4 shrink-0 accent-[var(--color-coral)]" required={!multi} />
                        {option.text}
                        {isCorrect ? <span className="ml-auto text-[0.75rem] font-semibold text-success">correct answer</span> : null}
                      </label>
                    );
                  })}
                </div>
                {verdict === 'correct' ? <p className="mt-2 text-[0.8125rem] font-semibold text-success">Correct.</p> : null}
                {verdict?.startsWith('wrong:') ? <p className="mt-2 text-[0.8125rem] text-danger">Not quite.{explanation ? ` ${explanation}` : ''}</p> : null}
              </fieldset>
            );
          })}
          <div className="flex flex-wrap items-center gap-3">
            <SubmitButton>Submit answers</SubmitButton>
            {passingScore ? <span className="text-[0.8125rem] text-brown-soft">You need {passingScore}% to pass.</span> : null}
          </div>
        </>
      )}
    </ActionForm>
  );
}
