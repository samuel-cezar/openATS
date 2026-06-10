import mongoose, { Schema, type Document } from 'mongoose';
import type { User } from '@openats/types';

/**
 * Mongoose document for User. Reuses the shared `User` shape from
 * @openats/types; only `_id` (ObjectId vs wire-string) differs between
 * the in-memory and JSON-wire forms.
 */
export interface UserDocument extends Document, Omit<User, '_id'> {}

const userSchema = new Schema<UserDocument>({
  tenantId: { type: String, required: true, index: true },
  name: String,
  email: { type: String, required: true },
  role: { type: String, enum: ['recruiter', 'admin'], default: 'recruiter' },
});

export default mongoose.model<UserDocument>('User', userSchema);
