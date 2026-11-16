import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { recruiterProfileUpdateSchema, type RecruiterProfileDto } from '@pathway/shared';
import { Field } from '../../components/Field';
import { Button, ErrorText, LoadingText } from '../../components/Feedback';
import { api } from '../../lib/api';
import { errorMessage } from '../../lib/format';

const KEY = ['recruiter-profile'];

export function CompanyPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: KEY,
    queryFn: () => api<{ profile: RecruiterProfileDto }>('/recruiter/me').then((r) => r.profile),
  });
  if (isLoading) return <LoadingText />;
  if (error || !data) return <ErrorText message={errorMessage(error)} />;
  return <CompanyForm profile={data} />;
}

function CompanyForm({ profile }: { profile: RecruiterProfileDto }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    companyName: profile.company?.name ?? '',
    designation: profile.designation ?? '',
  });
  const [validation, setValidation] = useState('');
  const [saved, setSaved] = useState(false);

  const save = useMutation({
    mutationFn: (body: object) =>
      api('/recruiter/me', { method: 'PATCH', body: JSON.stringify(body) }),
    onSuccess: () => {
      setSaved(true);
      queryClient.invalidateQueries({ queryKey: KEY });
    },
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaved(false);
    const parsed = recruiterProfileUpdateSchema.safeParse({
      companyName: form.companyName || undefined,
      designation: form.designation,
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
      <h1 className="text-xl font-semibold">Company</h1>
      <Field
        label="Company name"
        name="companyName"
        value={form.companyName}
        onChange={(e) => setForm({ ...form, companyName: e.target.value })}
      />
      <Field
        label="Your designation"
        name="designation"
        value={form.designation}
        onChange={(e) => setForm({ ...form, designation: e.target.value })}
      />
      <p className="text-xs text-slate-500">
        A company name can only be registered once; it belongs to the account that registered it
        first.
      </p>
      {validation && <ErrorText message={validation} />}
      {save.error && <ErrorText message={errorMessage(save.error)} />}
      {saved && <p className="text-sm text-green-700">Saved.</p>}
      <Button disabled={save.isPending}>{save.isPending ? 'Saving…' : 'Save'}</Button>
    </form>
  );
}
