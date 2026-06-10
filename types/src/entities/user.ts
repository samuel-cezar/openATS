import type { ObjectId } from './common';

export type UserRole = 'recruiter' | 'admin';

export interface User {
  _id: ObjectId;
  tenantId: ObjectId;
  name?: string;
  email: string;
  role: UserRole;
}
