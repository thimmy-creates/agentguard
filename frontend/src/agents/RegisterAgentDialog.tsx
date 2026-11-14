import { KeyRound, ShieldAlert } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, CopyButton, Field, Input, Modal, Textarea } from '@/components/ui';
import { api, ApiError, type Agent } from '@/lib/api';
import { useToast } from '@/lib/toast';
import { cn } from '@/lib/utils';

const PRESETS = [
  { id: 'standard', title: 'Standard', text: 'Read and create are allowed. Export and external messages need approval. Delete is blocked.' },
  { id: 'read_only', title: 'Read-only', text: 'Reads are allowed. Everything else is blocked.' },
  { id: 'locked_down', title: 'Locked down', text: 'Every action needs approval. Delete is blocked.' },
] as const;

export function RegisterAgentDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const navigate = useNavigate();
  const toast = useToast();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [preset, setPreset] = useState<(typeof PRESETS)[number]['id']>('standard');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ agent: Agent; apiKey: string } | null>(null);

  useEffect(() => {
    if (open) {
      setName('');
      setDescription('');
      setPreset('standard');
      setError(null);
      setCreated(null);
    }
  }, [open]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (name.trim().length < 2) {
      setError('Give the agent a name of at least 2 characters.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      setCreated(await api.post('/agents', { name: name.trim(), description: description.trim(), preset }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not register the agent');
    } finally {
      setBusy(false);
    }
  }

  if (created) {
    const curl = `curl -X POST ${window.location.origin}/api/gateway/request \\\n  -H "x-agent-key: ${created.apiKey}" \\\n  -H "content-type: application/json" \\\n  -d '{"agent_id":"${created.agent.id}","action":"read_project_data","params":{"records":5}}'`;
    return (
      <Modal open={open} onOpenChange={onOpenChange} title={`${created.agent.name} is registered`} description="Copy the key now. It is shown once and stored only as a hash." size="lg">
        <div className="space-y-4">
          <div className="rounded-2xl border border-review/40 bg-review-soft p-4">
            <p className="flex items-center gap-2 text-sm font-semibold text-review">
              <ShieldAlert aria-hidden className="size-4" />
              Agent key (shown once)
            </p>
            <div className="mt-3 flex items-center gap-2 rounded-xl bg-background p-2 pl-3">
              <KeyRound aria-hidden className="size-4 shrink-0 text-muted" />
              <code className="min-w-0 flex-1 break-all font-mono text-sm">{created.apiKey}</code>
              <CopyButton value={created.apiKey} label="Copy agent key" />
            </div>
          </div>
          <div>
            <p className="mb-2 flex items-center justify-between text-sm font-medium">
              Send a request through the gateway
              <CopyButton value={curl} label="Copy curl command" />
            </p>
            <pre className="overflow-x-auto rounded-xl border border-line bg-background p-3 font-mono text-xs leading-relaxed">{curl}</pre>
          </div>
          <Button
            variant="primary"
            className="w-full"
            onClick={() => {
              toast({ title: `${created.agent.name} registered`, description: 'Policy v1 is active.' });
              onOpenChange(false);
              navigate(`/agents/${created.agent.id}`);
            }}
          >
            Open agent
          </Button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Register an agent" description="Pick a starting policy. You can change any rule afterwards.">
      <form onSubmit={submit} className="space-y-5" noValidate>
        <Field label="Name" required error={error}>
          {(p) => <Input {...p} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Atlas" maxLength={48} autoComplete="off" autoFocus />}
        </Field>
        <Field label="What does it do?" hint="Optional. Shown on the agent card.">
          {(p) => <Textarea {...p} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={200} />}
        </Field>

        <fieldset>
          <legend className="mb-2 text-sm font-medium">Starting permissions</legend>
          <div className="grid gap-2">
            {PRESETS.map((p) => (
              <label
                key={p.id}
                className={cn(
                  'flex min-h-14 cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition-colors duration-150 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand',
                  preset === p.id ? 'border-brand bg-brand-soft' : 'border-line-strong hover:border-brand/50',
                )}
              >
                <input type="radio" name="preset" value={p.id} checked={preset === p.id} onChange={() => setPreset(p.id)} className="mt-1 size-4 accent-[var(--brand)]" />
                <span>
                  <span className="block text-sm font-semibold">{p.title}</span>
                  <span className="block text-sm text-muted">{p.text}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <Button type="submit" variant="primary" loading={busy} className="w-full">
          Register agent
        </Button>
      </form>
    </Modal>
  );
}
