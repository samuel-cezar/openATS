import type { ISODateString, ObjectId } from './common';

export interface Tenant {
  _id: ObjectId;
  /** The `X-Tenant-Id` header string this tenant is keyed by (e.g. "demo"). */
  key?: string;
  name: string;
  /** Weight applied to hard-skill similarity in the match score. Default 0.6. */
  alpha: number;
  /** Weight applied to soft-skill similarity in the match score. Default 0.4. alpha + beta must equal 1. */
  beta: number;
  createdAt: ISODateString;
}
