import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { facultyProfileUpdateSchema, type FacultyProfileDto } from '@pathway/shared';
import { Field } from '../../components/Field';
import { Button, ErrorText, LoadingText } from '../../components/Feedback';
import { api } from '../../lib/api';
import { errorMessage } from '../../lib/format';

const KEY = ['faculty-profile'];

export function FacultyProfilePage() {
  const { data, isLoading, error } = useQuery({
    queryKey: KEY,
    queryFn: () => api<{ profile: FacultyProfileDto }>('/faculty/me').then((r) => r.profile),
  });
  if (isLoading) return <LoadingText />;
  if (error || !data) return <ErrorText message={errorMessage(error)} />;
  return <Form profile={data} />;
}

function Form({ profile }: { profile: FacultyProfileDto }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    collegeName: profile.collegeName ?? '',
    department: profile.department ?? '',
    designation: profile.designation ?? '',
  });
  const [validation, setValidation] = useState('');
  const [saved, setSaved] = useState(false);
  const save = useMutation({
    mutationFn: (body: object) =>
      api('/faculty/me', { method: 'PATCH', body: JSON.stringify(body) }),
    onSuccess: () => {
      setSaved(true);
      queryClient.invalidateQueries({ queryKey: KEY });
    },
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaved(false);
    const parsed = facultyProfileUpdateSchema.safeParse(form);
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
      <h1 className="text-xl font-semibold">Faculty profile</h1>
      <Field
        label="College / university"
        name="collegeName"
        value={form.collegeName}
        onChange={(e) => setForm({ ...form, collegeName: e.target.value })}
      />
      <Field
        label="Department"
        name="department"
        value={form.department}
        onChange={(e) => setForm({ ...form, department: e.target.value })}
      />
      <Field
        label="Designation"
        name="designation"
        value={form.designation}
        onChange={(e) => setForm({ ...form, designation: e.target.value })}
      />
      {validation && <ErrorText message={validation} />}
      {save.error && <ErrorText message={errorMessage(save.error)} />}
      {saved && <p className="text-sm text-green-700">Saved.</p>}
      <Button disabled={save.isPending}>{save.isPending ? 'Saving…' : 'Save profile'}</Button>
    </form>
  );
}
