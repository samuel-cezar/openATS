import { ISODateString, ObjectId } from './common';

export interface Match {
  _id: ObjectId;
  tenantId: ObjectId;
  candidateId: ObjectId;
  positionId: ObjectId;
  totalScore: number;
  hardScore: number;
  softScore: number;
  rank?: number;
  computedAt: ISODateString;
}
