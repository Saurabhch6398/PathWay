import type { AiProvider } from './provider';

function generateMockQuiz(prompt: string) {
  // Extract topic from <topic>...</topic>
  const topicMatch = prompt.match(/<topic>(.*?)<\/topic>/i);
  const topic = topicMatch?.[1] ? topicMatch[1].trim() : 'Software Engineering';

  // Extract count: "Write 5 intermediate-level questions"
  const countMatch = prompt.match(/Write (\d+)/i);
  const count = countMatch?.[1] ? Math.min(Math.max(parseInt(countMatch[1], 10), 1), 10) : 5;

  const questionBank = [
    {
      q: `What is a primary best practice when designing scalable architectures in ${topic}?`,
      opts: [
        `Decoupling services and using stateless components`,
        `Storing all session state in local in-memory singletons`,
        `Disabling caching to guarantee immediate fresh data`,
        `Routing all database operations through synchronous blocking queues`,
      ],
      correct: 0,
      exp: `Decoupling services and maintaining stateless application layers allows horizontal scaling without session locking.`,
    },
    {
      q: `Which of the following approaches is most effective for error handling in modern ${topic}?`,
      opts: [
        `Ignoring edge cases and relying on process auto-restart`,
        `Catching errors at domain boundaries and returning standardized error structures`,
        `Logging errors only to local disk files without alerting`,
        `Terminating the server process immediately on every exception`,
      ],
      correct: 1,
      exp: `Standardized error handling with structured responses prevents leaking internal implementation details while ensuring client resiliency.`,
    },
    {
      q: `How should concurrent read/write requests be handled efficiently in ${topic}?`,
      opts: [
        `Using atomic operations and database-level unique compound indexes`,
        `Allowing race conditions and cleaning up corrupted rows manually`,
        `Restricting the entire application to a single thread with no concurrency`,
        `Disabling transactions and locks to maximize raw write speed`,
      ],
      correct: 0,
      exp: `Compound indexes and atomic constraints provide consistency guarantees under high concurrent load.`,
    },
    {
      q: `In the context of ${topic}, what is the main benefit of implementing automated testing?`,
      opts: [
        `Completely eliminating the need for code reviews`,
        `Catching regressions early and enabling confident continuous delivery`,
        `Increasing deployment payload size to deter reverse engineering`,
        `Replacing static type systems and linting tools`,
      ],
      correct: 1,
      exp: `Automated unit and integration testing suites prevent regressions and allow rapid, safe feature iterations.`,
    },
    {
      q: `What is the recommended strategy for managing sensitive API keys and secrets in ${topic}?`,
      opts: [
        `Hardcoding secrets directly inside repository source files`,
        `Storing secrets in client-side cookies with plain text`,
        `Injecting secrets via validated environment variables that are never committed`,
        `Checking environment variables into public git repositories`,
      ],
      correct: 2,
      exp: `Environment variables kept out of version control protect sensitive credentials from exposure.`,
    },
    {
      q: `When optimizing network performance in ${topic}, which method provides the highest impact?`,
      opts: [
        `Enabling payload compression, caching headers, and CDN distribution`,
        `Sending uncompressed JSON with all database fields on every request`,
        `Polling the server continuously every 100 milliseconds`,
        `Avoiding HTTPS encryption to reduce TLS handshake overhead`,
      ],
      correct: 0,
      exp: `Compression (gzip/brotli), caching strategies, and CDN delivery minimize latency and network overhead.`,
    },
    {
      q: `What is the significance of idempotency in API operations within ${topic}?`,
      opts: [
        `Ensuring multiple identical requests produce the same side-effect as a single request`,
        `Making requests execute twice as fast on retry`,
        `Allowing unauthorized users to execute administrative mutations`,
        `Preventing clients from caching GET query results`,
      ],
      correct: 0,
      exp: `Idempotent operations prevent unintended duplicate side-effects (e.g., duplicate charges or bookings) when clients retry network failures.`,
    },
  ];

  const questions = questionBank.slice(0, count).map((item, idx) => ({
    question: `${item.q} (Ref: ${idx + 1})`,
    options: item.opts,
    correctIndex: item.correct,
    explanation: item.exp,
  }));

  return JSON.stringify({ questions });
}

function generateMockSkillGap(prompt: string) {
  let targetRole = 'Software Engineer';
  try {
    const studentMatch = prompt.match(/<student>(.*?)<\/student>/s);
    if (studentMatch?.[1]) {
      const data = JSON.parse(studentMatch[1]);
      if (data.targetRole) targetRole = data.targetRole;
    }
  } catch {
    // fallback to default
  }

  return JSON.stringify({
    summary: `Comprehensive evaluation for the ${targetRole} target track: your foundational skills show strong aptitude, but bridging industry-standard tools, system testing, and architecture practices is critical for placement readiness.`,
    strengths: [
      'Core Programming Fundamentals',
      'Database Modeling & Schema Design',
      'RESTful API Principles',
      'Version Control Workflows',
    ],
    gaps: [
      {
        skill: 'Distributed System Architecture',
        priority: 'high',
        reason: `Production ${targetRole} roles demand hands-on experience with load balancing, caching layers (Redis), and event-driven patterns.`,
      },
      {
        skill: 'Automated CI/CD & Testing',
        priority: 'high',
        reason: 'Enterprise teams require test-driven development (TDD) and automated deployment pipelines.',
      },
      {
        skill: 'Cloud Deployment & Monitoring',
        priority: 'medium',
        reason: 'Familiarity with containerization (Docker) and observability tools is essential.',
      },
      {
        skill: 'Performance Optimization & Profiling',
        priority: 'low',
        reason: 'Understanding query indexing and memory profiling improves application scalability.',
      },
    ],
    nextSteps: [
      `Build a portfolio project demonstrating end-to-end ${targetRole} workflows with Docker.`,
      'Implement integration test suites for all major API routes using automated mocks.',
      'Take specialized assessments and practice system design interview scenarios.',
      'Engage with industry mentors on PathWay to review your portfolio architecture.',
    ],
  });
}

export function createMockProvider(): AiProvider {
  return {
    async generateJson({ prompt }) {
      if (prompt.includes('<topic>')) {
        return generateMockQuiz(prompt);
      }
      return generateMockSkillGap(prompt);
    },

    async generateText({ messages }) {
      const lastUser = messages.filter((m) => m.role === 'user').pop();
      const question = lastUser?.content ?? 'career guidance';
      return `Here is tailored advice for your goal: "${question}". To succeed, focus on building demonstrable production projects, deepening your algorithmic problem-solving skills, and regularly validating your competencies through quizzes and mentorship sessions on PathWay.`;
    },

    async *streamText({ messages, signal }) {
      const lastUser = messages.filter((m) => m.role === 'user').pop();
      const query = lastUser?.content ?? 'career guidance';

      const response = `Hello! Based on your question ("${query}"), here are 3 key recommendations:

1. **Focused Skill Deepening:** Focus on mastering one core stack thoroughly rather than spreading across too many tools. Build full-stack projects with authentication, database indexing, and automated tests.

2. **Practical Verification:** Use PathWay's AI Quizzes and Skill Gap analyzer to identify specific areas where industry requirements exceed current coursework.

3. **Mentorship & Networking:** Schedule a 1-on-1 session with our platform mentors to review your resume and conduct mock technical interviews.

Keep building and practicing consistently! What specific technology or role would you like to explore next?`;

      const words = response.split(' ');
      for (const word of words) {
        if (signal?.aborted) return;
        yield word + ' ';
        await new Promise((resolve) => setTimeout(resolve, 25)); // realistic streaming feel
      }
    },
  };
}
