import { Schema, model } from 'mongoose';

/** Only a SHA-256 of the token is stored, so a DB leak can't be replayed. */
const refreshTokenSchema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  tokenHash: { type: String, required: true, unique: true },
  // TTL index: MongoDB deletes the document once expiresAt has passed.
  expiresAt: { type: Date, required: true, index: { expireAfterSeconds: 0 } },
});

export const RefreshTokenModel = model('RefreshToken', refreshTokenSchema);
