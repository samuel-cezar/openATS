import { User, UserRole } from '../entities/user';

// POST /api/v1/users
export interface CreateUserRequest {
  name?: string;
  email: string;
  role?: UserRole;
}
export type CreateUserResponse = User;

// GET /api/v1/users
export type ListUsersResponse = User[];
