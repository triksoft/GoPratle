import { GoogleGenAI } from '@google/genai';
import mongoose from 'mongoose';
import { AiSystemStatus, type AiStatus, type IAiSystemStatus } from '../models/AiSystemStatus.js';
import { extractedAiDetailsSchema, type ExtractedAiDetails } from '../validation/ai.js';

export interface AiExtractionResult {
  extracted: ExtractedAiDetails;
  missingFields: string[];
  suggestedStep: number;
}

export type AiGeneratorFn = (description: string, today: string) => Promise<string>;

let inMemoryStatus: {
  status: AiStatus;
  lastIssueAt: Date | null;
  lastIssueType: string | null;
  updatedAt: Date;
} = {
  status: 'available',
  lastIssueAt: null,
  lastIssueType: null,
  updatedAt: new Date()
};

export async function recordAiStatus(status: AiStatus, issueType?: string | null) {
  inMemoryStatus = {
    status,
    lastIssueAt: status !== 'available' ? new Date() : inMemoryStatus.lastIssueAt,
    lastIssueType: status !== 'available' ? issueType ?? 'UNKNOWN_ISSUE' : inMemoryStatus.lastIssueType,
    updatedAt: new Date()
  };

  if (mongoose.connection.readyState !== 1) {
    return;
  }

  try {
    const update: Record<string, any> = {
      status,
      updatedAt: inMemoryStatus.updatedAt
    };
    if (status !== 'available') {
      update.lastIssueAt = inMemoryStatus.lastIssueAt;
      update.lastIssueType = inMemoryStatus.lastIssueType;
    }
    await AiSystemStatus.findOneAndUpdate(
      {},
      { $set: update },
      { upsert: true, new: true }
    );
  } catch (err) {
    // Non-blocking: status logging should not fail caller
    console.error('Failed to record AI status:', err);
  }
}

export async function getAiSystemStatus() {
  const hasKey = Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim());

  if (mongoose.connection.readyState !== 1) {
    return {
      status: !hasKey ? ('unavailable' as const) : inMemoryStatus.status,
      lastIssueAt: inMemoryStatus.lastIssueAt ? inMemoryStatus.lastIssueAt.toISOString() : null,
      lastIssueType: !hasKey ? 'API_KEY_NOT_CONFIGURED' : inMemoryStatus.lastIssueType,
      updatedAt: inMemoryStatus.updatedAt.toISOString()
    };
  }

  try {
    const doc = (await AiSystemStatus.findOne({}).lean()) as IAiSystemStatus | null;
    if (!hasKey) {
      return {
        status: 'unavailable' as const,
        lastIssueAt: doc?.lastIssueAt ? new Date(doc.lastIssueAt).toISOString() : inMemoryStatus.lastIssueAt ? inMemoryStatus.lastIssueAt.toISOString() : null,
        lastIssueType: 'API_KEY_NOT_CONFIGURED',
        updatedAt: new Date().toISOString()
      };
    }
    return {
      status: (doc?.status as AiStatus) || inMemoryStatus.status,
      lastIssueAt: doc?.lastIssueAt ? new Date(doc.lastIssueAt).toISOString() : inMemoryStatus.lastIssueAt ? inMemoryStatus.lastIssueAt.toISOString() : null,
      lastIssueType: doc?.lastIssueType ?? inMemoryStatus.lastIssueType,
      updatedAt: doc?.updatedAt ? new Date(doc.updatedAt).toISOString() : inMemoryStatus.updatedAt.toISOString()
    };
  } catch {
    return {
      status: hasKey ? inMemoryStatus.status : ('unavailable' as const),
      lastIssueAt: inMemoryStatus.lastIssueAt ? inMemoryStatus.lastIssueAt.toISOString() : null,
      lastIssueType: hasKey ? inMemoryStatus.lastIssueType : 'API_KEY_NOT_CONFIGURED',
      updatedAt: new Date().toISOString()
    };
  }
}

export function cleanJsonString(str: string): string {
  let cleaned = str.trim();
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.replace(/^```json\s*/, '').replace(/\s*```$/, '');
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```\s*/, '').replace(/\s*```$/, '');
  }
  return cleaned.trim();
}

export function classifyAiError(error: unknown): 'QUOTA_LIMIT' | 'TIMEOUT' | 'INVALID_JSON' | 'CONFIG_MISSING' | 'OTHER' {
  if (!error) return 'OTHER';
  if (typeof error === 'object') {
    const err = error as Record<string, any>;
    if (err.code === 'CONFIG_MISSING') return 'CONFIG_MISSING';
    if (
      err.code === 'ETIMEDOUT' ||
      err.name === 'TimeoutError' ||
      err.code === 'ECONNABORTED' ||
      String(err.message || '').toLowerCase().includes('timed out')
    ) {
      return 'TIMEOUT';
    }
    if (err.status === 429 || err.statusCode === 429 || err.code === 429) return 'QUOTA_LIMIT';
    if (err.status === 'RESOURCE_EXHAUSTED' || err.code === 'RESOURCE_EXHAUSTED') return 'QUOTA_LIMIT';
    if (err.error && typeof err.error === 'object') {
      if (err.error.code === 429 || err.error.status === 'RESOURCE_EXHAUSTED') return 'QUOTA_LIMIT';
    }
    const msg = String(err.message || '').toLowerCase();
    if (
      msg.includes('429') ||
      msg.includes('resource_exhausted') ||
      msg.includes('quota') ||
      msg.includes('rate limit') ||
      msg.includes('too many requests')
    ) {
      return 'QUOTA_LIMIT';
    }
    if (msg.includes('json') || msg.includes('parse')) {
      return 'INVALID_JSON';
    }
    if (
      msg.includes('fetch failed') ||
      msg.includes('network') ||
      msg.includes('econnrefused') ||
      msg.includes('etimedout')
    ) {
      return 'TIMEOUT';
    }
  }
  return 'OTHER';
}

export async function defaultGeminiGenerator(description: string, today: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || !apiKey.trim()) {
    const error = new Error('GEMINI_API_KEY is not configured.');
    (error as any).code = 'CONFIG_MISSING';
    throw error;
  }

  const ai = new GoogleGenAI({ apiKey });

  const systemInstruction = `You are an AI assistant for GoPratle event planning.
Extract structured event requirements from the user's natural language brief into strict JSON.
Today's date is: ${today} (YYYY-MM-DD). If relative dates are mentioned (e.g. "tomorrow", "this weekend", "next Saturday"), calculate the exact YYYY-MM-DD date relative to today.

Expected JSON output format:
{
  "eventName": "Event title",
  "eventType": "Birthday party | Wedding | Corporate event | Concert | etc.",
  "dateType": "single" | "range",
  "startDate": "YYYY-MM-DD or empty string",
  "endDate": "YYYY-MM-DD or empty string",
  "location": "City or area, e.g. Bangalore",
  "venue": "Specific venue name or empty string",
  "category": "planner" | "performer" | "crew",
  "details": {
    // If category is "planner":
    // "budget": numeric string or number,
    // "guestCount": numeric string or number,
    // "planningScope": "Full planning" | "Partial planning" | "Day-of coordination"

    // If category is "performer":
    // "performanceType": string (e.g. "DJ", "Band", "Singer"),
    // "durationMinutes": numeric string or number,
    // "equipmentProvided": "Yes, fully provided" | "Partially provided" | "No, provider should bring it"

    // If category is "crew":
    // "crewRole": string (e.g. "Sound engineer", "Decorator", "Lighting tech"),
    // "shiftHours": numeric string or number,
    // "teamSize": numeric string or number
  },
  "notes": "Any other context, preferences, or secondary requests",
  "missingFields": ["fieldName1", "fieldName2"] // List essential fields missing from description
}

Rule 1: Category must be one of: "planner", "performer", "crew".
Rule 2: Never include markdown code fences or conversational text. Output pure JSON only.`;

  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      const error = new Error('Gemini request timed out after 15 seconds.');
      (error as any).code = 'ETIMEDOUT';
      reject(error);
    }, 15000);
  });

  const apiPromise = ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: description,
    config: {
      responseMimeType: 'application/json',
      systemInstruction
    }
  });

  const response = await Promise.race([apiPromise, timeoutPromise]);
  return response.text || '';
}

export function normalizeExtractedDetails(data: any): ExtractedAiDetails {
  const category = (data.category || '').toLowerCase();
  const validCategory = ['planner', 'performer', 'crew'].includes(category) ? category : '';

  const detailsRaw = data.details && typeof data.details === 'object' ? data.details : {};
  let normalizedDetails: Record<string, any> = {};

  if (validCategory === 'planner') {
    const budgetVal = detailsRaw.budget !== undefined && detailsRaw.budget !== null ? String(detailsRaw.budget).replace(/[^\d.]/g, '') : '';
    const guestVal = detailsRaw.guestCount !== undefined && detailsRaw.guestCount !== null ? String(detailsRaw.guestCount).replace(/\D/g, '') : '';
    let scope = detailsRaw.planningScope || '';
    if (!['Full planning', 'Partial planning', 'Day-of coordination'].includes(scope)) {
      if (/full/i.test(scope)) scope = 'Full planning';
      else if (/partial/i.test(scope)) scope = 'Partial planning';
      else if (/day|coord/i.test(scope)) scope = 'Day-of coordination';
      else scope = '';
    }
    normalizedDetails = {
      budget: budgetVal,
      guestCount: guestVal,
      planningScope: scope
    };
  } else if (validCategory === 'performer') {
    const durationVal = detailsRaw.durationMinutes !== undefined && detailsRaw.durationMinutes !== null ? String(detailsRaw.durationMinutes).replace(/\D/g, '') : '';
    let equip = detailsRaw.equipmentProvided || '';
    if (!['Yes, fully provided', 'Partially provided', 'No, provider should bring it'].includes(equip)) {
      if (/fully|yes/i.test(equip)) equip = 'Yes, fully provided';
      else if (/partial/i.test(equip)) equip = 'Partially provided';
      else if (/no|bring/i.test(equip)) equip = 'No, provider should bring it';
      else equip = '';
    }
    normalizedDetails = {
      performanceType: detailsRaw.performanceType ? String(detailsRaw.performanceType).trim() : '',
      durationMinutes: durationVal,
      equipmentProvided: equip
    };
  } else if (validCategory === 'crew') {
    const shiftVal = detailsRaw.shiftHours !== undefined && detailsRaw.shiftHours !== null ? String(detailsRaw.shiftHours).replace(/[^\d.]/g, '') : '';
    const teamVal = detailsRaw.teamSize !== undefined && detailsRaw.teamSize !== null ? String(detailsRaw.teamSize).replace(/\D/g, '') : '';
    normalizedDetails = {
      crewRole: detailsRaw.crewRole ? String(detailsRaw.crewRole).trim() : '',
      shiftHours: shiftVal,
      teamSize: teamVal
    };
  }

  // Determine missing fields dynamically
  const missing: string[] = Array.isArray(data.missingFields) ? [...data.missingFields] : [];
  if (!data.eventName && !missing.includes('eventName')) missing.push('eventName');
  if (!data.eventType && !missing.includes('eventType')) missing.push('eventType');
  if (!data.startDate && !missing.includes('startDate')) missing.push('startDate');
  if (!data.location && !missing.includes('location')) missing.push('location');
  if (!validCategory && !missing.includes('category')) missing.push('category');

  return {
    eventName: typeof data.eventName === 'string' ? data.eventName.trim() : '',
    eventType: typeof data.eventType === 'string' ? data.eventType.trim() : '',
    dateType: data.dateType === 'range' ? 'range' : 'single',
    startDate: typeof data.startDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(data.startDate) ? data.startDate : '',
    endDate: typeof data.endDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(data.endDate) ? data.endDate : '',
    location: typeof data.location === 'string' ? data.location.trim() : '',
    venue: typeof data.venue === 'string' ? data.venue.trim() : '',
    category: validCategory as any,
    details: normalizedDetails,
    notes: typeof data.notes === 'string' ? data.notes.trim() : '',
    missingFields: missing
  };
}
