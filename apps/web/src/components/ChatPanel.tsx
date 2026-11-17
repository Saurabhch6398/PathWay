import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { ChatMessage } from '@pathway/shared';
import { errorMessage } from '../lib/format';
import { Button, ErrorText } from './Feedback';

interface ChatPanelProps {
  /** Sends the conversation and reports reply text through `onToken` (once, or many times when streaming). */
  ask: (
    messages: ChatMessage[],
    onToken: (token: string) => void,
    signal: AbortSignal,
  ) => Promise<void>;
  intro: string;
  placeholder: string;
}

export function ChatPanel({ ask, intro, placeholder }: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const abortRef = useRef<AbortController | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView?.({ behavior: 'smooth' });
  }, [messages]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    setError('');
    setInput('');
    setBusy(true);
    const history: ChatMessage[] = [...messages, { role: 'user', content: text }];
    setMessages([...history, { role: 'assistant', content: '' }]);

    const controller = new AbortController();
    abortRef.current = controller;
    const append = (token: string) =>
      setMessages((cur) => {
        const last = cur[cur.length - 1]!;
        return [...cur.slice(0, -1), { ...last, content: last.content + token }];
      });
    try {
      // Last 9 messages: keeps requests small and always starts on a user turn.
      await ask(history.slice(-9), append, controller.signal);
    } catch (err) {
      if (!controller.signal.aborted) setError(errorMessage(err));
    } finally {
      setBusy(false);
      // Drop an assistant bubble that never received text.
      setMessages((cur) => (cur[cur.length - 1]?.content === '' ? cur.slice(0, -1) : cur));
    }
  }

  return (
    <div className="flex h-[28rem] flex-col rounded-xl border bg-white shadow-sm">
      <div className="flex-1 space-y-3 overflow-y-auto p-4" aria-live="polite">
        {messages.length === 0 && <p className="text-sm text-slate-500">{intro}</p>}
        {messages.map((m, i) => (
          <div key={i} className={m.role === 'user' ? 'text-right' : ''}>
            <span
              className={`inline-block max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-left text-sm ${
                m.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-900'
              }`}
            >
              {m.content || (busy && i === messages.length - 1 ? '…' : '')}
            </span>
          </div>
        ))}
        <div ref={endRef} />
      </div>
      {error && (
        <div className="px-4">
          <ErrorText message={error} />
        </div>
      )}
      <form onSubmit={onSubmit} className="flex gap-2 border-t p-3">
        <input
          aria-label="Message"
          value={input}
          maxLength={2000}
          placeholder={placeholder}
          onChange={(e) => setInput(e.target.value)}
          className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <Button disabled={busy || !input.trim()}>{busy ? 'Thinking…' : 'Send'}</Button>
      </form>
    </div>
  );
}
