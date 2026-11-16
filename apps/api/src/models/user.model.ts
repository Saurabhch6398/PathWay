import { Schema, model, type InferSchemaType } from 'mongoose';
import { ROLES } from '@pathway/shared';

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ROLES, required: true, index: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export type UserDoc = InferSchemaType<typeof userSchema> & {
  _id: import('mongoose').Types.ObjectId;
};
export const UserModel = model('User', userSchema);
