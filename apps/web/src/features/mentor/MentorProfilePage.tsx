import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { mentorProfileUpdateSchema, type MentorSelfDto } from '@pathway/shared';
import { Field } from '../../components/Field';
import { Button, ErrorText, LoadingText } from '../../components/Feedback';
import { api } from '../../lib/api';
import { errorMessage } from '../../lib/format';

const KEY = ['mentor-profile'];

export function MentorProfilePage() {
  const { data, isLoading, error } = useQuery({
    queryKey: KEY,
    queryFn: () => api<{ profile: MentorSelfDto }>('/mentors/me').then((r) => r.profile),
  });
  if (isLoading) return <LoadingText />;
  if (error || !data) return <ErrorText message={errorMessage(error)} />;
  return <Form profile={data} />;
}

function Form({ profile }: { profile: MentorSelfDto }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    title: profile.title ?? '',
    companyName: profile.companyName ?? '',
    experienceYears: profile.experienceYears?.toString() ?? '',
    expertise: profile.expertise.join(', '),
  });
  const [available, setAvailable] = useState(profile.available);
  const [validation, setValidation] = useState('');
  const [saved, setSaved] = useState(false);

  const save = useMutation({
    mutationFn: (body: object) =>
      api('/mentors/me', { method: 'PATCH', body: JSON.stringify(body) }),
    onSuccess: () => {
      setSaved(true);
      queryClient.invalidateQueries({ queryKey: KEY });
      queryClient.invalidateQueries({ queryKey: ['mentors'] });
    },
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaved(false);
    const parsed = mentorProfileUpdateSchema.safeParse({
      title: form.title,
      companyName: form.companyName,
      experienceYears:
        form.experienceYears.trim() === '' ? undefined : Number(form.experienceYears),
      expertise: form.expertise
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      available,
    });
    if (!parsed.success)
      return setValidation(parsed.error.issues[0]?.message ?? 'Check your input');
    setValidation('');
    save.mutate(parsed.data);
  }

  return (
    <form
      onSubmit={onSubmit}
      className="max-w-xl space-y-4 rounded-xl border bg-white p-6 shadow-sm"
    >
      <h1 className="text-xl font-semibold">Mentor profile</h1>
      <Field
        label="Title"
        name="title"
        placeholder="e.g. Senior Software Architect"
        value={form.title}
        onChange={(e) => setForm({ ...form, title: e.target.value })}
      />
      <Field
        label="Company"
        name="companyName"
        value={form.companyName}
        onChange={(e) => setForm({ ...form, companyName: e.target.value })}
      />
      <Field
        label="Years of experience"
        name="experienceYears"
        type="number"
        min={0}
        max={60}
        value={form.experienceYears}
        onChange={(e) => setForm({ ...form, experienceYears: e.target.value })}
      />
      <Field
        label="Areas of expertise (comma separated)"
        name="expertise"
        placeholder="System design, Node.js"
        value={form.expertise}
        onChange={(e) => setForm({ ...form, expertise: e.target.value })}
      />
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={available}
          onChange={(e) => setAvailable(e.target.checked)}
        />
        Available for new sessions
      </label>
      <p className="text-xs text-slate-500">
        Your title and company are self-declared and shown to students.
      </p>
      {validation && <ErrorText message={validation} />}
      {save.error && <ErrorText message={errorMessage(save.error)} />}
      {saved && <p className="text-sm text-green-700">Saved.</p>}
      <Button disabled={save.isPending}>{save.isPending ? 'Saving…' : 'Save profile'}</Button>
    </form>
  );
}
