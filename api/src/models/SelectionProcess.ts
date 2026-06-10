import mongoose, { Schema, type Document } from 'mongoose';
import type { SelectionProcess } from '@openats/types';

/**
 * Mongoose document for SelectionProcess. Reuses the shared `SelectionProcess`
 * shape from @openats/types, but `_id` (ObjectId vs wire-string) and the date
 * fields (Date vs ISODateString) differ between the in-memory and JSON-wire forms.
 */
export interface SelectionProcessDocument
  extends Document,
    Omit<SelectionProcess, '_id' | 'startDate' | 'endDate'> {
  startDate?: Date;
  endDate?: Date;
}

const selectionProcessSchema = new Schema<SelectionProcessDocument>({
  tenantId: { type: String, required: true, index: true },
  name: String,
  description: String,
  startDate: Date,
  endDate: Date,
});

export default mongoose.model<SelectionProcessDocument>('SelectionProcess', selectionProcessSchema);
