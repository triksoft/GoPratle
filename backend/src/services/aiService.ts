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
export type AiChatGeneratorFn = (
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  today: string,
  currentExtracted?: any
) => Promise<string>;

export const GEMINI_TIMEOUT_MS = 45000;

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

export function sanitizeSecretString(message: string): string {
  if (!message) return '';
  return message
    .replace(/(key[=:])\s*([a-zA-Z0-9_\-]+)/gi, '$1[REDACTED]')
    .replace(/AIzaSy[a-zA-Z0-9_\-]{20,}/g, '[REDACTED_API_KEY]')
    .replace(/(Bearer\s+)[a-zA-Z0-9_\.\-]+/gi, '$1[REDACTED_TOKEN]');
}

export function extractHttpStatus(error: unknown): number | undefined {
  if (!error || typeof error !== 'object') return undefined;
  const err = error as Record<string, any>;
  if (typeof err.status === 'number') return err.status;
  if (typeof err.statusCode === 'number') return err.statusCode;
  if (typeof err.code === 'number') return err.code;
  if (err.error && typeof err.error === 'object') {
    if (typeof err.error.code === 'number') return err.error.code;
    if (typeof err.error.status === 'number') return err.error.status;
  }
  const match = String(err.message || '').match(/\b(400|401|403|404|429|500|503|504)\b/);
  if (match) return Number(match[1]);
  return undefined;
}

export function extractErrorCode(error: unknown): string | undefined {
  if (!error || typeof error !== 'object') return undefined;
  const err = error as Record<string, any>;
  if (typeof err.code === 'string') return err.code;
  if (typeof err.status === 'string') return err.status;
  if (err.error && typeof err.error === 'object') {
    if (typeof err.error.status === 'string') return err.error.status;
    if (typeof err.error.code === 'string') return err.error.code;
  }
  return undefined;
}

export function logSanitizedAiError(error: unknown, context: string = 'Gemini API') {
  const status = extractHttpStatus(error);
  const code = extractErrorCode(error);
  const name = error instanceof Error ? error.name : 'UnknownError';
  const rawMessage = error instanceof Error ? error.message : String(error);
  const message = sanitizeSecretString(rawMessage);

  console.error(`[AI Diagnostic] ${context} error:`, {
    status: status ?? 'N/A',
    name,
    code: code ?? 'UNKNOWN',
    message: message || 'No message provided'
  });
}

export type AiErrorClassification =
  | 'CONFIG_MISSING'
  | 'MODEL_NOT_FOUND'
  | 'QUOTA_LIMIT'
  | 'TIMEOUT'
  | 'INVALID_JSON'
  | 'OTHER';

export function classifyAiError(error: unknown): AiErrorClassification {
  if (!error) return 'OTHER';
  if (typeof error === 'object') {
    const err = error as Record<string, any>;
    if (err.code === 'CONFIG_MISSING') return 'CONFIG_MISSING';
    if (err.code === 'MODEL_NOT_FOUND') return 'MODEL_NOT_FOUND';

    const status = extractHttpStatus(error);
    const code = String(extractErrorCode(error) || '').toUpperCase();
    const msg = String(err.message || '').toLowerCase();

    // 1. Quota / rate limit / 429
    if (
      status === 429 ||
      code === 'RESOURCE_EXHAUSTED' ||
      code === 'RATE_LIMIT_EXCEEDED' ||
      msg.includes('429') ||
      msg.includes('resource_exhausted') ||
      msg.includes('quota') ||
      msg.includes('rate limit') ||
      msg.includes('too many requests')
    ) {
      return 'QUOTA_LIMIT';
    }

    // 2. Invalid / blocked key or HTTP 401 / 403
    if (
      status === 401 ||
      status === 403 ||
      code === 'PERMISSION_DENIED' ||
      code === 'UNAUTHENTICATED' ||
      code === 'API_KEY_INVALID' ||
      msg.includes('api_key') ||
      msg.includes('api key') ||
      msg.includes('apikey') ||
      msg.includes('unauthenticated') ||
      msg.includes('permission_denied') ||
      msg.includes('permission denied') ||
      (status === 400 && (msg.includes('key') || msg.includes('credential') || msg.includes('auth')))
    ) {
      return 'CONFIG_MISSING';
    }

    // 3. Unavailable model or HTTP 404
    if (
      status === 404 ||
      code === 'NOT_FOUND' ||
      msg.includes('404') ||
      msg.includes('not found') ||
      msg.includes('not_found') ||
      msg.includes('is not supported for generatecontent') ||
      msg.includes('call listmodels')
    ) {
      return 'MODEL_NOT_FOUND';
    }

    // 4. Timeout / network / cancellation
    if (
      err.code === 'ETIMEDOUT' ||
      err.name === 'TimeoutError' ||
      err.name === 'AbortError' ||
      err.code === 'ABORT_ERR' ||
      err.code === 'ECONNABORTED' ||
      err.code === 'ECONNREFUSED' ||
      status === 504 ||
      msg.includes('timed out') ||
      msg.includes('timeout') ||
      msg.includes('aborted') ||
      msg.includes('abort') ||
      msg.includes('fetch failed') ||
      msg.includes('network') ||
      msg.includes('etimedout')
    ) {
      return 'TIMEOUT';
    }

    // 5. Invalid JSON
    if (msg.includes('json') || msg.includes('parse')) {
      return 'INVALID_JSON';
    }
  }

  return 'OTHER';
}

export async function callGeminiWithFallback(contents: string, systemInstruction: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || !apiKey.trim() || apiKey === 'your_actual_gemini_api_key_from_google_ai_studio') {
    const error = new Error('GEMINI_API_KEY is not configured.');
    (error as any).code = 'CONFIG_MISSING';
    throw error;
  }

  const ai = new GoogleGenAI({ apiKey });

  // Model fallback order:
  // GEMINI_MODEL override -> gemini-3.5-flash-lite -> gemini-3.5-flash -> gemini-3.6-flash -> gemini-3.8-flash
  const configuredModel = process.env.GEMINI_MODEL?.trim();
  const fallbackOrder = [
    'gemini-3.5-flash-lite',
    'gemini-3.5-flash',
    'gemini-3.6-flash',
    'gemini-3.8-flash'
  ];
  const candidateModels = [
    ...(configuredModel ? [configuredModel] : []),
    ...fallbackOrder
  ].filter((m, idx, arr) => arr.indexOf(m) === idx);

  let lastError: unknown;

  for (const modelName of candidateModels) {
    const controller = new AbortController();
    let timeoutId: NodeJS.Timeout | undefined;

    try {
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
          controller.abort();
          const error = new Error(`Gemini request timed out after ${GEMINI_TIMEOUT_MS / 1000} seconds.`);
          (error as any).code = 'ETIMEDOUT';
          (error as any).name = 'TimeoutError';
          reject(error);
        }, GEMINI_TIMEOUT_MS);
      });

      const apiPromise = ai.models.generateContent({
        model: modelName,
        contents,
        config: {
          responseMimeType: 'application/json',
          systemInstruction,
          abortSignal: controller.signal
        }
      });

      // Prevent unhandled rejection warning if timeout fires before upstream abort settles
      apiPromise.catch(() => {});

      const response = await Promise.race([apiPromise, timeoutPromise]);
      return response.text || '';
    } catch (err: any) {
      lastError = err;

      // If aborted due to timeout or timed out, throw explicit timeout error
      if (err?.code === 'ETIMEDOUT' || err?.name === 'TimeoutError' || controller.signal.aborted) {
        const timeoutErr = new Error(`Gemini request timed out after ${GEMINI_TIMEOUT_MS / 1000} seconds.`);
        (timeoutErr as any).code = 'ETIMEDOUT';
        (timeoutErr as any).name = 'TimeoutError';
        throw timeoutErr;
      }

      const errorClassification = classifyAiError(err);
      if (errorClassification === 'MODEL_NOT_FOUND') {
        logSanitizedAiError(err, `Model ${modelName} not found, trying fallback`);
        continue; // Try next candidate model
      }
      // If it's a quota, auth, timeout, or network error, do not retry other models
      throw err;
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }
  }

  // If all candidate models failed
  throw lastError;
}

export async function defaultGeminiGenerator(description: string, today: string): Promise<string> {
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

  return callGeminiWithFallback(description, systemInstruction);
}

export async function defaultGeminiChatGenerator(
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  today: string,
  currentExtracted?: any
): Promise<string> {
  const systemInstruction = `You are GoPratle's AI Event Planning Assistant. You guide customers conversationally through planning an event and gathering all details needed for an event requirement posting.
Today's date is: ${today} (YYYY-MM-DD). If relative dates are mentioned (e.g. "tomorrow", "this weekend", "next Saturday"), calculate the exact YYYY-MM-DD date relative to today.

We are gathering event requirements to pre-fill a four-step event requirement form:
1. Event Basics:
   - eventName (e.g. "Rohan's 30th Birthday", "Annual Tech Summit 2026")
   - eventType ("Birthday party", "Wedding", "Corporate event", "Concert / performance", etc.)
   - dateType ("single" or "range")
   - startDate ("YYYY-MM-DD")
   - endDate ("YYYY-MM-DD" or empty if single-day)
   - location (City or area, e.g. "Bangalore", "Mumbai")
   - venue (Specific venue name if mentioned, else empty)
2. Category & Category-Specific Details:
   - category: must be one of "planner", "performer", "crew"
   - if category is "planner":
     - budget (numeric string or number)
     - guestCount (numeric string or number)
     - planningScope ("Full planning" | "Partial planning" | "Day-of coordination")
   - if category is "performer":
     - performanceType (e.g. "DJ", "Live Band", "Singer")
     - durationMinutes (numeric string or number, e.g. 180)
     - equipmentProvided ("Yes, fully provided" | "Partially provided" | "No, provider should bring it")
   - if category is "crew":
     - crewRole (e.g. "Sound engineer", "Decorator", "Lighting technician")
     - shiftHours (numeric string or number)
     - teamSize (numeric string or number)
3. Notes:
   - notes: Any special requests, themes, music genres, or additional context.

CONVERSATION INSTRUCTIONS:
- Review the conversation history and the details extracted so far.
- Ask follow-up questions ONE AT A TIME based on what is missing:
  1. What date is the event?
  2. Which city/location?
  3. Approximately how many guests?
  4. What do you need help with (planner, performer, or crew)?
  5. Any budget or venue preference?
- Always provide 2 to 5 relevant, concise "quickReplies" (chips) that the user might click next. (e.g., date chips, city chips, category chips, guest count chips).
- Set "isReadyForReview": true when key details (eventName or eventType, date, location, and category) are collected, or if the user asks to review/finish. If essential details are still missing, set "isReadyForReview": false.
- Never include markdown code fences or conversational greetings outside the JSON. Return pure JSON conforming strictly to the format below.

Output JSON Format:
{
  "assistantMessage": "Friendly follow-up question or summary",
  "quickReplies": ["Quick reply 1", "Quick reply 2"],
  "extracted": {
    "eventName": "...",
    "eventType": "...",
    "dateType": "single" | "range",
    "startDate": "YYYY-MM-DD",
    "endDate": "",
    "location": "...",
    "venue": "",
    "category": "planner" | "performer" | "crew" | "",
    "details": { ... },
    "notes": "...",
    "missingFields": ["..."]
  },
  "missingFields": ["..."],
  "isReadyForReview": boolean,
  "suggestedStep": 1 | 2 | 3 | 4
}`;

  const conversationText = messages
    .map(m => `${m.role === 'assistant' ? 'Assistant' : 'Customer'}: ${m.content}`)
    .join('\n');

  // Never send contact information (phone/email) to Gemini
  const safeExtracted = currentExtracted && typeof currentExtracted === 'object'
    ? Object.fromEntries(
        Object.entries(currentExtracted).filter(
          ([k]) => !['phone', 'email', 'phoneNumber', 'emailId'].includes(k)
        )
      )
    : undefined;

  const prompt = `Current conversation:\n${conversationText}\n\n${
    safeExtracted ? `Previously extracted state:\n${JSON.stringify(safeExtracted, null, 2)}\n\n` : ''
  }Generate the JSON response following the system instructions:`;

  return callGeminiWithFallback(prompt, systemInstruction);
}

export function normalizeBudget(raw: any): string {
  if (raw === undefined || raw === null) return '';
  const str = String(raw).trim();
  if (!str) return '';

  // Check if it's a numeric range (e.g. "₹1,00,000–₹3,00,000" or "100000 - 300000")
  const rangeMatch = str.match(/^(?:₹\s*)?([0-9,]+(?:\.[0-9]+)?)\s*(?:-|–|—|\bto\b)\s*(?:₹\s*)?([0-9,]+(?:\.[0-9]+)?)$/i);
  if (rangeMatch) {
    const min = rangeMatch[1].trim();
    const max = rangeMatch[2].trim();
    return `₹${min} – ₹${max}`;
  }

  // Complex or worded range, e.g. "₹1,00,000 – ₹3,00,000" or "1 Lakh to 2 Lakh"
  if (/[-–—]|\bto\b/i.test(str) && /\d/.test(str)) {
    return str.trim();
  }

  // Single value: if it has currency formatting or commas, keep readable
  if (str.startsWith('₹') || str.includes(',')) {
    return str;
  }
  const digits = str.replace(/[^\d.]/g, '');
  return digits;
}

export function normalizeExtractedDetails(data: any): ExtractedAiDetails {
  const category = (data.category || '').toLowerCase();
  const validCategory = ['planner', 'performer', 'crew'].includes(category) ? category : '';

  const detailsRaw = data.details && typeof data.details === 'object' ? data.details : {};
  let normalizedDetails: Record<string, any> = {};

  if (validCategory === 'planner') {
    const budgetVal = normalizeBudget(detailsRaw.budget);
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
