import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { studentProfileUpdateSchema, type Skill, type StudentProfileDto } from '@pathway/shared';
import { Field } from '../../components/Field';
import { Button, ErrorText, LoadingText } from '../../components/Feedback';
import { api } from '../../lib/api';
import { errorMessage } from '../../lib/format';

const KEY = ['student-profile'];

export function ProfilePage() {
  const { data, isLoading, error } = useQuery({
    queryKey: KEY,
    queryFn: () => api<{ profile: StudentProfileDto }>('/students/me').then((r) => r.profile),
  });
  if (isLoading) return <LoadingText />;
  if (error || !data) return <ErrorText message={errorMessage(error)} />;
  return <ProfileForm profile={data} />;
}

function ProfileForm({ profile }: { profile: StudentProfileDto }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    course: profile.course ?? '',
    batch: profile.batch ?? '',
    targetRole: profile.targetRole ?? '',
  });
  const [skills, setSkills] = useState<Skill[]>(profile.skills);
  const [visible, setVisible] = useState(profile.visibleToRecruiters);
  const [validation, setValidation] = useState('');
  const [saved, setSaved] = useState(false);

  const save = useMutation({
    mutationFn: (body: object) =>
      api('/students/me', { method: 'PATCH', body: JSON.stringify(body) }),
    onSuccess: () => {
      setSaved(true);
      queryClient.invalidateQueries({ queryKey: KEY });
    },
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaved(false);
    const parsed = studentProfileUpdateSchema.safeParse({
      ...form,
      visibleToRecruiters: visible,
      skills: skills.filter((s) => s.name.trim()),
    });
    if (!parsed.success)
      return setValidation(parsed.error.issues[0]?.message ?? 'Check your input');
    setValidation('');
    save.mutate(parsed.data);
  }

  const updateSkill = (i: number, patch: Partial<Skill>) =>
    setSkills(skills.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));

  return (
    <form
      onSubmit={onSubmit}
      className="max-w-2xl space-y-4 rounded-xl border bg-white p-6 shadow-sm"
    >
      <h1 className="text-xl font-semibold">My profile</h1>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Course"
          name="course"
          value={form.course}
          onChange={(e) => setForm({ ...form, course: e.target.value })}
        />
        <Field
          label="Batch"
          name="batch"
          placeholder="2025-29"
          value={form.batch}
          onChange={(e) => setForm({ ...form, batch: e.target.value })}
        />
      </div>
      <Field
        label="Target role"
        name="targetRole"
        value={form.targetRole}
        onChange={(e) => setForm({ ...form, targetRole: e.target.value })}
      />

      <div>
        <p className="mb-2 text-sm font-medium text-slate-700">Skills</p>
        <div className="space-y-2">
          {skills.map((s, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                aria-label={`Skill ${i + 1} name`}
                value={s.name}
                placeholder="e.g. React"
                onChange={(e) => updateSkill(i, { name: e.target.value })}
                className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <input
                aria-label={`Skill ${i + 1} proficiency`}
                type="number"
                min={0}
                max={100}
                value={s.proficiency}
                onChange={(e) => updateSkill(i, { proficiency: Number(e.target.value) })}
                className="w-20 rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <Button
                type="button"
                variant="secondary"
                onClick={() => setSkills(skills.filter((_, idx) => idx !== i))}
              >
                Remove
              </Button>
            </div>
          ))}
        </div>
        <Button
          type="button"
          variant="secondary"
          className="mt-2"
          onClick={() => setSkills([...skills, { name: '', proficiency: 50 }])}
        >
          + Add skill
        </Button>
        <p className="mt-1 text-xs text-slate-500">Proficiency is 0–100.</p>
      </div>

      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          checked={visible}
          onChange={(e) => setVisible(e.target.checked)}
          className="mt-1"
        />
        <span>
          Let recruiters find me in talent search
          <span className="block text-xs text-slate-500">
            Shows your name, course, target role and skills. Never your email.
          </span>
        </span>
      </label>

      {validation && <ErrorText message={validation} />}
      {save.error && <ErrorText message={errorMessage(save.error)} />}
      {saved && <p className="text-sm text-green-700">Profile saved.</p>}
      <Button disabled={save.isPending}>{save.isPending ? 'Saving…' : 'Save profile'}</Button>
    </form>
  );
}
