import { Schema, model, models } from 'mongoose';

export type AiStatus = 'available' | 'limited' | 'unavailable';

export interface IAiSystemStatus {
  status: AiStatus;
  lastIssueAt?: Date | null;
  lastIssueType?: string | null;
  updatedAt: Date;
}

const AiSystemStatusSchema = new Schema<IAiSystemStatus>(
  {
    status: {
      type: String,
      enum: ['available', 'limited', 'unavailable'],
      default: 'available',
      required: true
    },
    lastIssueAt: { type: Date, default: null },
    lastIssueType: { type: String, default: null },
    updatedAt: { type: Date, default: Date.now }
  },
  { timestamps: false, versionKey: false, bufferCommands: false }
);

export const AiSystemStatus =
  models.AiSystemStatus || model<IAiSystemStatus>('AiSystemStatus', AiSystemStatusSchema, 'ai_system_status');
