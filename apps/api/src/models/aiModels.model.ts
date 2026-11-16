import { Schema, model } from 'mongoose';
import { DIFFICULTIES, TICKET_STATUSES } from '@pathway/shared';

const questionSchema = new Schema(
  {
    question: { type: String, required: true },
    options: { type: [String], required: true },
    correctIndex: { type: Number, required: true, min: 0, max: 3 },
    explanation: { type: String, default: '' },
  },
  { _id: false },
);

export const QuizModel = model(
  'Quiz',
  new Schema(
    {
      student: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
      topic: { type: String, required: true },
      difficulty: { type: String, enum: DIFFICULTIES, required: true },
      questions: { type: [questionSchema], required: true },
    },
    { timestamps: true },
  ),
);

const attemptSchema = new Schema(
  {
    quiz: { type: Schema.Types.ObjectId, ref: 'Quiz', required: true },
    student: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    answers: { type: [Number], default: [] }, // -1 = unanswered
    score: { type: Number, required: true },
    total: { type: Number, required: true },
  },
  { timestamps: true },
);
// A quiz can be submitted once, so scores can't be farmed by re-submitting.
attemptSchema.index({ quiz: 1, student: 1 }, { unique: true });
export const QuizAttemptModel = model('QuizAttempt', attemptSchema);

export const TicketModel = model(
  'Ticket',
  new Schema(
    {
      user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
      subject: { type: String, required: true, trim: true },
      description: { type: String, required: true },
      status: { type: String, enum: TICKET_STATUSES, default: 'open' },
    },
    { timestamps: true },
  ),
);
