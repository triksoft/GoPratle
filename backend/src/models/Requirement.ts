import { Schema, model, models } from 'mongoose';
import type { RequirementInput } from '../types/requirement.js';

const RequirementSchema = new Schema<RequirementInput>({
  eventName: { type: String, required: true, trim: true },
  eventType: { type: String, required: true, trim: true },
  dateType: { type: String, enum: ['single', 'range'], required: true },
  startDate: { type: String, required: true },
  endDate: { type: String },
  location: { type: String, required: true, trim: true },
  venue: { type: String, trim: true },
  category: { type: String, enum: ['planner', 'performer', 'crew'], required: true },
  details: { type: Schema.Types.Mixed, required: true },
  notes: { type: String, trim: true },
  clientSubmissionId: { type: String, required: true, unique: true, index: true }
}, { timestamps: true, versionKey: false });

export const Requirement = models.Requirement || model<RequirementInput>('Requirement', RequirementSchema);
