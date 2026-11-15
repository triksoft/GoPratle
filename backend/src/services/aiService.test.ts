import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  GEMINI_TIMEOUT_MS,
  classifyAiError,
  defaultGeminiChatGenerator,
  defaultGeminiGenerator,
  logSanitizedAiError,
  normalizeBudget,
  normalizeExtractedDetails,
  sanitizeSecretString
} from './aiService.js';

// Mock @google/genai
vi.mock('@google/genai', () => {
  return {
    GoogleGenAI: vi.fn()
  };
});

describe('aiService timeout, cancellation, and model fallback', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    process.env.GEMINI_API_KEY = 'test-gemini-key';
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it('exports GEMINI_TIMEOUT_MS set to 45000', () => {
    expect(GEMINI_TIMEOUT_MS).toBe(45000);
  });

  describe('classifyAiError', () => {
    it('classifies timeout and abort errors as TIMEOUT', () => {
      expect(classifyAiError(new Error('Gemini request timed out after 45 seconds.'))).toBe('TIMEOUT');
      expect(classifyAiError(Object.assign(new Error('timeout'), { code: 'ETIMEDOUT' }))).toBe('TIMEOUT');
      expect(classifyAiError(Object.assign(new Error('operation aborted'), { name: 'AbortError' }))).toBe('TIMEOUT');
      expect(classifyAiError(Object.assign(new Error('aborted'), { code: 'ABORT_ERR' }))).toBe('TIMEOUT');
      expect(classifyAiError(Object.assign(new Error('aborted request'), { code: 'ECONNABORTED' }))).toBe('TIMEOUT');
    });

    it('classifies quota limit errors as QUOTA_LIMIT', () => {
      expect(classifyAiError(Object.assign(new Error('Quota exceeded'), { status: 429 }))).toBe('QUOTA_LIMIT');
      expect(classifyAiError(Object.assign(new Error('Exhausted'), { code: 'RESOURCE_EXHAUSTED' }))).toBe('QUOTA_LIMIT');
    });

    it('classifies auth errors as CONFIG_MISSING', () => {
      expect(classifyAiError(Object.assign(new Error('Unauthorized'), { status: 401 }))).toBe('CONFIG_MISSING');
      expect(classifyAiError(Object.assign(new Error('Forbidden'), { status: 403 }))).toBe('CONFIG_MISSING');
    });

    it('classifies model not found errors as MODEL_NOT_FOUND', () => {
      expect(classifyAiError(Object.assign(new Error('Model not found'), { status: 404 }))).toBe('MODEL_NOT_FOUND');
    });
  });

  describe('defaultGeminiGenerator model fallback and abortSignal', () => {
    it('passes abortSignal in config and follows default fallback order when model fails with 404', async () => {
      const { GoogleGenAI } = await import('@google/genai');

      const invokedModels: string[] = [];
      const abortSignalsReceived: boolean[] = [];

      const mockGenerateContent = vi.fn().mockImplementation(async (params: any) => {
        invokedModels.push(params.model);
        abortSignalsReceived.push(Boolean(params.config?.abortSignal));

        // First model fails with 404 NOT_FOUND
        if (params.model === 'gemini-3.5-flash-lite') {
          const err = Object.assign(new Error('models/gemini-3.5-flash-lite is not found'), {
            status: 404,
            code: 'NOT_FOUND'
          });
          throw err;
        }

        // Second model succeeds
        return { text: '{"eventName": "Fallback Success"}' };
      });

      (GoogleGenAI as any).mockImplementation(() => ({
        models: {
          generateContent: mockGenerateContent
        }
      }));

      delete process.env.GEMINI_MODEL;

      const result = await defaultGeminiGenerator('Test description', '2026-11-14');

      expect(result).toBe('{"eventName": "Fallback Success"}');
      expect(invokedModels).toEqual(['gemini-3.5-flash-lite', 'gemini-3.5-flash']);
      expect(abortSignalsReceived.every(Boolean)).toBe(true);
    });

    it('respects GEMINI_MODEL override before default fallback models', async () => {
      const { GoogleGenAI } = await import('@google/genai');

      const invokedModels: string[] = [];

      const mockGenerateContent = vi.fn().mockImplementation(async (params: any) => {
        invokedModels.push(params.model);

        if (params.model === 'custom-gemini-model') {
          const err = Object.assign(new Error('Custom model not found'), {
            status: 404,
            code: 'NOT_FOUND'
          });
          throw err;
        }

        return { text: '{"eventName": "Custom Fallback Success"}' };
      });

      (GoogleGenAI as any).mockImplementation(() => ({
        models: {
          generateContent: mockGenerateContent
        }
      }));

      process.env.GEMINI_MODEL = 'custom-gemini-model';

      const result = await defaultGeminiGenerator('Test description', '2026-11-14');

      expect(result).toBe('{"eventName": "Custom Fallback Success"}');
      expect(invokedModels).toEqual(['custom-gemini-model', 'gemini-3.5-flash-lite']);
    });

    it('supports defaultGeminiChatGenerator with conversational history', async () => {
      const { GoogleGenAI } = await import('@google/genai');

      let receivedContents = '';
      const mockGenerateContent = vi.fn().mockImplementation(async (params: any) => {
        receivedContents = params.contents;
        return {
          text: JSON.stringify({
            assistantMessage: 'When is your party?',
            quickReplies: ['Next Friday'],
            extracted: { eventType: 'Birthday' },
            isReadyForReview: false
          })
        };
      });

      (GoogleGenAI as any).mockImplementation(() => ({
        models: {
          generateContent: mockGenerateContent
        }
      }));

      const result = await defaultGeminiChatGenerator(
        [
          { role: 'assistant', content: 'What are you planning?' },
          { role: 'user', content: 'Birthday party' }
        ],
        '2026-11-14',
        { eventType: 'Birthday' }
      );

      expect(result).toContain('When is your party?');
      expect(receivedContents).toContain('Customer: Birthday party');
      expect(receivedContents).toContain('Previously extracted state:');
    });

    it('aborts upstream request and throws 45s timeout when request hangs', async () => {
      const { GoogleGenAI } = await import('@google/genai');

      let signalDuringCall: AbortSignal | undefined;

      const mockGenerateContent = vi.fn().mockImplementation(async (params: any) => {
        signalDuringCall = params.config?.abortSignal;
        // Never resolve normally, wait until aborted
        return new Promise((_, reject) => {
          signalDuringCall?.addEventListener('abort', () => {
            const abortErr = new Error('The operation was aborted');
            abortErr.name = 'AbortError';
            reject(abortErr);
          });
        });
      });

      (GoogleGenAI as any).mockImplementation(() => ({
        models: {
          generateContent: mockGenerateContent
        }
      }));

      vi.useFakeTimers();

      try {
        const expectation = expect(
          defaultGeminiGenerator('Test description', '2026-11-14')
        ).rejects.toThrow('Gemini request timed out after 45 seconds.');

        // Fast-forward by 45,000 ms
        await vi.advanceTimersByTimeAsync(45000);

        await expectation;
        expect(signalDuringCall?.aborted).toBe(true);
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe('safe logging without secrets', () => {
    it('sanitizes API keys and tokens in log messages', () => {
      const sanitized = sanitizeSecretString(
        'Failed with key=secret123 and AIzaSyA1B2C3D4E5F6G7H8I9J0K1L2M3N4O5 and Bearer eyJhbGciOi'
      );
      expect(sanitized).not.toContain('secret123');
      expect(sanitized).not.toContain('AIzaSyA1B2C3D4E5F6G7H8I9J0K1L2M3N4O5');
      expect(sanitized).toContain('key=[REDACTED]');
      expect(sanitized).toContain('[REDACTED_API_KEY]');
      expect(sanitized).toContain('Bearer [REDACTED_TOKEN]');
    });
  });

  describe('normalizeBudget & budget range handling', () => {
    it('normalizes single numeric budget values cleanly', () => {
      expect(normalizeBudget(80000)).toBe('80000');
      expect(normalizeBudget('80000')).toBe('80000');
      expect(normalizeBudget('₹80,000')).toBe('₹80,000');
    });

    it('preserves readable budget ranges and avoids concatenating digits', () => {
      expect(normalizeBudget('₹1,00,000–₹3,00,000')).toBe('₹1,00,000 – ₹3,00,000');
      expect(normalizeBudget('₹1,00,000 - ₹3,00,000')).toBe('₹1,00,000 – ₹3,00,000');
      expect(normalizeBudget('100000 to 300000')).toBe('₹100000 – ₹300000');
      // Must never return 100000300000
      expect(normalizeBudget('₹1,00,000–₹3,00,000')).not.toContain('100000300000');
    });

    it('preserves budget range in normalizeExtractedDetails for planner', () => {
      const extracted = normalizeExtractedDetails({
        category: 'planner',
        details: {
          budget: '₹1,00,000–₹3,00,000',
          guestCount: '150',
          planningScope: 'Full planning'
        }
      });
      expect(extracted.details.budget).toBe('₹1,00,000 – ₹3,00,000');
    });

    it('normalizes phone number and email in normalizeExtractedDetails', () => {
      const extracted = normalizeExtractedDetails({
        eventName: 'Anniversary Party',
        category: 'planner',
        phone: '  +91 98765 43210  ',
        email: '  test@example.com  ',
        details: {
          budget: '200000',
          guestCount: '50',
          planningScope: 'Full planning'
        }
      });
      expect(extracted.phone).toBe('+91 98765 43210');
      expect(extracted.email).toBe('test@example.com');
    });
  });
});
