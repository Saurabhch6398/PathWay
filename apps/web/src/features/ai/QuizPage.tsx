import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  DIFFICULTIES,
  generateQuizSchema,
  type QuizDto,
  type QuizHistoryItemDto,
  type QuizResultDto,
} from '@pathway/shared';
import { Button, ErrorText } from '../../components/Feedback';
import { api } from '../../lib/api';
import { errorMessage, formatDate } from '../../lib/format';

export function QuizPage() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ topic: '', difficulty: 'intermediate', count: 5 });
  const [validation, setValidation] = useState('');
  const [quiz, setQuiz] = useState<QuizDto | null>(null);
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [result, setResult] = useState<QuizResultDto | null>(null);

  const history = useQuery({
    queryKey: ['quiz-history'],
    queryFn: () => api<{ history: QuizHistoryItemDto[] }>('/ai/quizzes/me').then((r) => r.history),
  });

  const generate = useMutation({
    mutationFn: (body: object) =>
      api<{ quiz: QuizDto }>('/ai/quizzes', { method: 'POST', body: JSON.stringify(body) }).then(
        (r) => r.quiz,
      ),
    onSuccess: (q) => {
      setQuiz(q);
      setAnswers(q.questions.map(() => null));
      setResult(null);
    },
  });
  const submit = useMutation({
    mutationFn: () =>
      api<{ result: QuizResultDto }>(`/ai/quizzes/${quiz!.id}/submit`, {
        method: 'POST',
        body: JSON.stringify({ answers }),
      }).then((r) => r.result),
    onSuccess: (r) => {
      setResult(r);
      queryClient.invalidateQueries({ queryKey: ['quiz-history'] });
      queryClient.invalidateQueries({ queryKey: ['student-profile'] }); // skills may have changed
    },
  });

  function onGenerate(e: FormEvent) {
    e.preventDefault();
    const parsed = generateQuizSchema.safeParse(form);
    if (!parsed.success)
      return setValidation(parsed.error.issues[0]?.message ?? 'Check your input');
    setValidation('');
    generate.mutate(parsed.data);
  }

  const reset = () => {
    setQuiz(null);
    setResult(null);
    generate.reset();
    submit.reset();
  };

  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-xl font-semibold">AI quizzes</h1>

      {!quiz && (
        <form
          onSubmit={onGenerate}
          className="grid gap-3 rounded-xl border bg-white p-5 shadow-sm sm:grid-cols-4"
        >
          <div className="sm:col-span-2">
            <label htmlFor="topic" className="mb-1 block text-sm font-medium text-slate-700">
              Topic
            </label>
            <input
              id="topic"
              value={form.topic}
              maxLength={60}
              placeholder="e.g. Node.js, SQL joins, React hooks"
              onChange={(e) => setForm({ ...form, topic: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label htmlFor="difficulty" className="mb-1 block text-sm font-medium text-slate-700">
              Difficulty
            </label>
            <select
              id="difficulty"
              value={form.difficulty}
              onChange={(e) => setForm({ ...form, difficulty: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm capitalize"
            >
              {DIFFICULTIES.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="count" className="mb-1 block text-sm font-medium text-slate-700">
              Questions
            </label>
            <select
              id="count"
              value={form.count}
              onChange={(e) => setForm({ ...form, count: Number(e.target.value) })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              {[3, 5, 7, 10].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-4">
            {validation && <ErrorText message={validation} />}
            {generate.error && <ErrorText message={errorMessage(generate.error)} />}
            <Button className="mt-1" disabled={generate.isPending}>
              {generate.isPending ? 'Generating…' : 'Generate quiz'}
            </Button>
          </div>
        </form>
      )}

      {quiz && (
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            <span className="font-medium capitalize">{quiz.difficulty}</span> quiz on{' '}
            <span className="font-medium">{quiz.topic}</span>
          </p>
          {result && (
            <div className="rounded-xl border bg-indigo-50 p-4">
              <p className="text-lg font-semibold">
                Score: {result.score} / {result.total} ({result.percent}%)
              </p>
              {result.skill && (
                <p className="text-sm text-slate-700">
                  Your “{result.skill.name}” skill is now {result.skill.proficiency}/100.
                </p>
              )}
            </div>
          )}
          {quiz.questions.map((q, qi) => {
            const review = result?.answers[qi];
            return (
              <fieldset
                key={qi}
                disabled={!!result}
                className="rounded-xl border bg-white p-4 shadow-sm"
              >
                <legend className="px-1 font-medium">
                  {qi + 1}. {q.question}
                </legend>
                <div className="mt-2 space-y-1">
                  {q.options.map((opt, oi) => {
                    const isCorrect = review?.correctIndex === oi;
                    const isWrongPick = review && review.yourAnswer === oi && !isCorrect;
                    return (
                      <label
                        key={oi}
                        className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm ${isCorrect ? 'bg-green-50' : isWrongPick ? 'bg-red-50' : ''}`}
                      >
                        <input
                          type="radio"
                          name={`q${qi}`}
                          checked={answers[qi] === oi}
                          onChange={() => setAnswers(answers.map((a, i) => (i === qi ? oi : a)))}
                        />
                        {opt}
                        {isCorrect && (
                          <span className="ml-auto text-xs font-medium text-green-700">
                            Correct
                          </span>
                        )}
                      </label>
                    );
                  })}
                </div>
                {review?.explanation && (
                  <p className="mt-2 text-sm text-slate-600">{review.explanation}</p>
                )}
              </fieldset>
            );
          })}
          {submit.error && <ErrorText message={errorMessage(submit.error)} />}
          {result ? (
            <Button onClick={reset}>New quiz</Button>
          ) : (
            <div className="flex items-center gap-3">
              <Button disabled={submit.isPending} onClick={() => submit.mutate()}>
                {submit.isPending ? 'Submitting…' : 'Submit answers'}
              </Button>
              <span className="text-sm text-slate-500">
                {answers.filter((a) => a !== null).length} of {answers.length} answered
              </span>
            </div>
          )}
        </div>
      )}

      {history.data && history.data.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold text-slate-700">Recent results</h2>
          <ul className="divide-y rounded-xl border bg-white text-sm shadow-sm">
            {history.data.map((h) => (
              <li key={h.id} className="flex justify-between px-4 py-2">
                <span>
                  {h.topic} <span className="text-slate-500 capitalize">· {h.difficulty}</span>
                </span>
                <span>
                  {h.score}/{h.total} · {formatDate(h.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
