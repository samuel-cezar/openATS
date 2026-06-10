import { ISODateString, ObjectId } from './common';

export interface SelectionProcess {
  _id: ObjectId;
  tenantId: ObjectId;
  name?: string;
  description?: string;
  startDate?: ISODateString;
  endDate?: ISODateString;
}
