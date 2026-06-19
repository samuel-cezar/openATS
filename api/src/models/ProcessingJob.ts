import mongoose, { Schema, type Document } from 'mongoose';

/**
 * Mongoose document for a pipeline processing job. Inserted by the API's
 * POST /positions/:id/process and /candidates/:id/process endpoints and polled
 * by the Python monitor (services/1_monitor/main.py), which claims pending jobs
 * (pending -> running), runs the stages, and on success sets processed=true /
 * skillsStale=false on the target Position/Candidate. The model name maps to
 * the `processingjobs` collection the monitor reads.
 */
export interface ProcessingJobDocument extends Document {
  tenantId: string;
  entityType: 'position' | 'candidate';
  entityId: mongoose.Types.ObjectId;
  status: 'pending' | 'running' | 'completed' | 'failed';
  stage: string | null;
  error: string | null;
  createdAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;
}

const processingJobSchema = new Schema<ProcessingJobDocument>({
  tenantId: { type: String, required: true, index: true },
  entityType: { type: String, enum: ['position', 'candidate'], required: true },
  entityId: { type: Schema.Types.ObjectId, required: true },
  status: {
    type: String,
    enum: ['pending', 'running', 'completed', 'failed'],
    default: 'pending',
    index: true,
  },
  stage: { type: String, default: null },
  error: { type: String, default: null },
  createdAt: { type: Date, default: Date.now },
  startedAt: { type: Date, default: null },
  completedAt: { type: Date, default: null },
});

export default mongoose.model<ProcessingJobDocument>('ProcessingJob', processingJobSchema);
