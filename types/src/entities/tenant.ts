import { ISODateString, ObjectId } from './common';

export interface Tenant {
  _id: ObjectId;
  name: string;
  /** Weight applied to hard-skill similarity in the match score. Default 0.6. */
  alpha: number;
  /** Weight applied to soft-skill similarity in the match score. Default 0.4. alpha + beta must equal 1. */
  beta: number;
  createdAt: ISODateString;
}
