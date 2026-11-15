import { Router, type Request, type Response } from 'express';
import {
  classifyAiError,
  cleanJsonString,
  defaultGeminiChatGenerator,
  defaultGeminiGenerator,
  getAiSystemStatus,
  logSanitizedAiError,
  normalizeExtractedDetails,
  recordAiStatus,
  type AiChatGeneratorFn,
  type AiGeneratorFn
} from '../services/aiService.js';
import {
  aiExtractionRequestSchema,
  chatRequestSchema,
  extractedAiDetailsSchema
} from '../validation/ai.js';

export interface AiRouterOptions {
  generator?: AiGeneratorFn;
  chatGenerator?: AiChatGeneratorFn;
}

// In-memory rate-limiter to protect Gemini quota
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + 60000 });
    return false;
  }
  if (entry.count >= 20) {
    return true;
  }
  entry.count++;
  return false;
}

export function aiRouter(options: AiRouterOptions = {}) {
  const router = Router();
  const generator = options.generator ?? defaultGeminiGenerator;
  const chatGenerator = options.chatGenerator ?? defaultGeminiChatGenerator;

  router.post('/extract-event-details', async (req: Request, res: Response) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    if (isRateLimited(ip)) {
      await recordAiStatus('limited', 'CLIENT_RATE_LIMIT');
      return res.status(429).json({
        code: 'AI_LIMIT_REACHED',
        message: 'The AI assistant has temporarily reached its usage limit. Please complete the event form manually.'
      });
    }

    const parsedBody = aiExtractionRequestSchema.safeParse(req.body);
    if (!parsedBody.success) {
      return res.status(422).json({
        message: 'Please provide a valid event description.',
        errors: parsedBody.error.flatten().fieldErrors
      });
    }

    const today = new Date().toISOString().slice(0, 10);

    try {
      const rawOutput = await generator(parsedBody.data.description, today);

      let parsedJson: any;
      try {
        const cleaned = cleanJsonString(rawOutput);
        parsedJson = JSON.parse(cleaned);
      } catch (jsonErr) {
        logSanitizedAiError(jsonErr, 'Gemini Raw Output Parse');
        await recordAiStatus('available', 'INVALID_AI_OUTPUT');
        return res.status(422).json({
          code: 'AI_PARSE_FAILED',
          message: 'The AI assistant could not structure the event details. Please complete the event form manually.'
        });
      }

      const normalized = normalizeExtractedDetails(parsedJson);
      const validated = extractedAiDetailsSchema.safeParse(normalized);
      if (!validated.success) {
        logSanitizedAiError(validated.error, 'Gemini Normalized Schema Validation');
        await recordAiStatus('available', 'INVALID_AI_OUTPUT');
        return res.status(422).json({
          code: 'AI_PARSE_FAILED',
          message: 'The AI assistant could not structure the event details. Please complete the event form manually.'
        });
      }

      await recordAiStatus('available');

      // Decide suggested step
      const hasBasics =
        validated.data.eventName &&
        validated.data.eventType &&
        validated.data.startDate &&
        validated.data.location &&
        validated.data.category;

      const suggestedStep = hasBasics ? 2 : 1;

      return res.status(200).json({
        extracted: validated.data,
        missingFields: validated.data.missingFields,
        suggestedStep
      });
    } catch (error: unknown) {
      const errorType = classifyAiError(error);

      if (errorType === 'CONFIG_MISSING') {
        logSanitizedAiError(error, 'Gemini Configuration/Authentication');
        await recordAiStatus('unavailable', 'API_KEY_NOT_CONFIGURED');
        return res.status(503).json({
          code: 'AI_CONFIG_MISSING',
          message: 'The AI assistant is currently not configured. Please complete the event form manually.'
        });
      }

      if (errorType === 'MODEL_NOT_FOUND') {
        logSanitizedAiError(error, 'Gemini Model Resolution');
        await recordAiStatus('unavailable', 'MODEL_NOT_FOUND');
        return res.status(503).json({
          code: 'AI_CONFIG_MISSING',
          message: 'The AI assistant model is currently unavailable. Please complete the event form manually.'
        });
      }

      if (errorType === 'QUOTA_LIMIT') {
        logSanitizedAiError(error, 'Gemini Quota/Rate Limit');
        await recordAiStatus('limited', 'RATE_LIMIT_EXCEEDED');
        return res.status(429).json({
          code: 'AI_LIMIT_REACHED',
          message: 'The AI assistant has temporarily reached its usage limit. Please complete the event form manually.'
        });
      }

      if (errorType === 'TIMEOUT') {
        logSanitizedAiError(error, 'Gemini Network Timeout');
        await recordAiStatus('unavailable', 'NETWORK_TIMEOUT');
        return res.status(504).json({
          code: 'AI_NETWORK_ERROR',
          message: 'The AI request timed out or encountered a network issue. You can retry or continue manually.'
        });
      }

      logSanitizedAiError(error, 'Gemini Unexpected Provider Service');
      await recordAiStatus('unavailable', 'AI_SERVICE_ERROR');
      return res.status(500).json({
        code: 'AI_SERVICE_ERROR',
        message: 'The AI assistant is temporarily unavailable. Please complete the event form manually.'
      });
    }
  });

  // POST /api/ai/chat - Conversational guided event planning
  router.post('/chat', async (req: Request, res: Response) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    if (isRateLimited(ip)) {
      await recordAiStatus('limited', 'CLIENT_RATE_LIMIT');
      return res.status(429).json({
        code: 'AI_LIMIT_REACHED',
        message: 'The AI assistant has temporarily reached its usage limit. Please complete the event form manually.'
      });
    }

    const parsedBody = chatRequestSchema.safeParse(req.body);
    if (!parsedBody.success) {
      return res.status(422).json({
        message: 'Please provide valid conversation messages.',
        errors: parsedBody.error.flatten().fieldErrors
      });
    }

    const today = new Date().toISOString().slice(0, 10);

    try {
      const rawOutput = await chatGenerator(
        parsedBody.data.messages,
        today,
        parsedBody.data.currentExtracted
      );

      let parsedJson: any;
      try {
        const cleaned = cleanJsonString(rawOutput);
        parsedJson = JSON.parse(cleaned);
      } catch (jsonErr) {
        logSanitizedAiError(jsonErr, 'Gemini Chat Raw Output Parse');
        await recordAiStatus('available', 'INVALID_AI_OUTPUT');
        return res.status(422).json({
          code: 'AI_PARSE_FAILED',
          message: 'The AI assistant could not structure the event details. Please complete the event form manually.'
        });
      }

      const rawExtracted = parsedJson.extracted || parsedJson;
      const normalizedExtracted = normalizeExtractedDetails(rawExtracted);
      const validatedExtracted = extractedAiDetailsSchema.safeParse(normalizedExtracted);

      let assistantMessage =
        typeof parsedJson.assistantMessage === 'string' && parsedJson.assistantMessage.trim()
          ? parsedJson.assistantMessage.trim()
          : "I've noted your requirements. Could you share any more details, or are you ready to review?";

      // Sanitize any false submission language from AI output
      if (
        /\b(successfully posted|has been posted|have been posted|is posted|was posted|confirmed and post|confirm and post|requirement has been saved|event is posted|requirement is confirmed)\b/i.test(
          assistantMessage
        )
      ) {
        assistantMessage = 'Your draft is ready for review.';
      }

      const quickReplies: string[] = Array.isArray(parsedJson.quickReplies)
        ? parsedJson.quickReplies
            .filter((q: any) => typeof q === 'string' && q.trim())
            .map((q: string) => {
              const trimmed = q.trim();
              if (/confirm\s+and\s+post/i.test(trimmed) || /yes,\s*review\s*now/i.test(trimmed)) {
                return 'Add contact details';
              }
              if (/\bpost\b/i.test(trimmed) || /\bsubmit\b/i.test(trimmed)) {
                return 'Review details in form';
              }
              return trimmed;
            })
        : [];

      const extractedData = validatedExtracted.success ? validatedExtracted.data : normalizedExtracted;

      const hasBasics = Boolean(
        extractedData.eventName &&
        extractedData.eventType &&
        extractedData.startDate &&
        extractedData.location &&
        extractedData.category
      );

      const isReadyForReview = Boolean(parsedJson.isReadyForReview ?? hasBasics);
      const suggestedStep = parsedJson.suggestedStep || (extractedData.category ? 2 : 1);

      await recordAiStatus('available');

      return res.status(200).json({
        assistantMessage,
        quickReplies,
        extracted: extractedData,
        missingFields: extractedData.missingFields || [],
        isReadyForReview,
        suggestedStep
      });
    } catch (error: unknown) {
      const errorType = classifyAiError(error);

      if (errorType === 'CONFIG_MISSING') {
        logSanitizedAiError(error, 'Gemini Configuration/Authentication');
        await recordAiStatus('unavailable', 'API_KEY_NOT_CONFIGURED');
        return res.status(503).json({
          code: 'AI_CONFIG_MISSING',
          message: 'The AI assistant is currently not configured. Please complete the event form manually.'
        });
      }

      if (errorType === 'MODEL_NOT_FOUND') {
        logSanitizedAiError(error, 'Gemini Model Resolution');
        await recordAiStatus('unavailable', 'MODEL_NOT_FOUND');
        return res.status(503).json({
          code: 'AI_CONFIG_MISSING',
          message: 'The AI assistant model is currently unavailable. Please complete the event form manually.'
        });
      }

      if (errorType === 'QUOTA_LIMIT') {
        logSanitizedAiError(error, 'Gemini Quota/Rate Limit');
        await recordAiStatus('limited', 'RATE_LIMIT_EXCEEDED');
        return res.status(429).json({
          code: 'AI_LIMIT_REACHED',
          message: 'The AI assistant has temporarily reached its usage limit. Please complete the event form manually.'
        });
      }

      if (errorType === 'TIMEOUT') {
        logSanitizedAiError(error, 'Gemini Network Timeout');
        await recordAiStatus('unavailable', 'NETWORK_TIMEOUT');
        return res.status(504).json({
          code: 'AI_NETWORK_ERROR',
          message: 'The AI request timed out or encountered a network issue. You can retry or continue manually.'
        });
      }

      logSanitizedAiError(error, 'Gemini Unexpected Provider Service');
      await recordAiStatus('unavailable', 'AI_SERVICE_ERROR');
      return res.status(500).json({
        code: 'AI_SERVICE_ERROR',
        message: 'The AI assistant is temporarily unavailable. Please complete the event form manually.'
      });
    }
  });

  return router;
}

export function adminRouter() {
  const router = Router();
  router.get('/ai-status', async (_req: Request, res: Response) => {
    const status = await getAiSystemStatus();
    return res.status(200).json(status);
  });
  return router;
}
