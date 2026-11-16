import { ChatPanel } from '../../components/ChatPanel';
import { useAuth } from '../../lib/auth';
import { streamPost } from '../../lib/api';

export function AdvisorPage() {
  const { user } = useAuth();
  const isFaculty = user?.role === 'faculty';
  return (
    <div className="max-w-3xl space-y-4">
      <h1 className="text-xl font-semibold">
        {isFaculty ? 'AI academic advisor' : 'AI career advisor'}
      </h1>
      <ChatPanel
        ask={(messages, onToken, signal) =>
          streamPost('/ai/advisor', { messages }, onToken, signal)
        }
        intro={
          isFaculty
            ? 'Ask about industry collaboration, curriculum alignment or placement outcomes.'
            : 'Ask about career paths, what to learn next or how to prepare for interviews. I can see your profile and skills.'
        }
        placeholder="Type your question…"
      />
    </div>
  );
}
