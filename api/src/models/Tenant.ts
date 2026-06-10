import mongoose, { Schema, type Document } from 'mongoose';
import type { Tenant } from '@openats/types';

/**
 * Mongoose document for Tenant. Reuses the shared `Tenant` shape from
 * @openats/types, but `_id` (ObjectId vs wire-string) and `createdAt`
 * (Date vs ISODateString) differ between the in-memory and JSON-wire forms.
 */
export interface TenantDocument extends Document, Omit<Tenant, '_id' | 'createdAt'> {
  createdAt: Date;
}

const tenantSchema = new Schema<TenantDocument>({
  name: { type: String, required: true },
  alpha: { type: Number, default: 0.6 },
  beta: { type: Number, default: 0.4 },
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model<TenantDocument>('Tenant', tenantSchema);
