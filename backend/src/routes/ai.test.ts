import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../app.js';

describe('AI Assistant API', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('successfully extracts event details from valid AI output', async () => {
    const mockOutput = JSON.stringify({
      eventName: "Rohan's 30th Birthday",
      eventType: 'Birthday party',
      dateType: 'single',
      startDate: '2026-11-20',
      location: 'Bangalore',
      venue: 'Sky Lounge',
      category: 'performer',
      details: {
        performanceType: 'DJ',
        durationMinutes: 180,
        equipmentProvided: 'No, provider should bring it'
      },
      notes: 'Customer requested upbeat commercial and Bollywood music.',
      missingFields: []
    });

    const mockGenerator = vi.fn().mockResolvedValue(mockOutput);
    const app = createApp({ aiOptions: { generator: mockGenerator } });

    const response = await request(app)
      .post('/api/ai/extract-event-details')
      .send({ description: 'I need a DJ for my 30th birthday next Friday in Bangalore at Sky Lounge.' });

    expect(response.status).toBe(200);
    expect(response.body.extracted.eventName).toBe("Rohan's 30th Birthday");
    expect(response.body.extracted.category).toBe('performer');
    expect(response.body.extracted.details.performanceType).toBe('DJ');
    expect(response.body.suggestedStep).toBe(2);
    expect(mockGenerator).toHaveBeenCalledOnce();
  });

  it('handles missing GEMINI_API_KEY with a friendly 503 response without secrets', async () => {
    const mockGenerator = vi.fn().mockRejectedValue(
      Object.assign(new Error('GEMINI_API_KEY is not configured.'), { code: 'CONFIG_MISSING' })
    );
    const app = createApp({ aiOptions: { generator: mockGenerator } });

    const response = await request(app)
      .post('/api/ai/extract-event-details')
      .send({ description: 'I need a planner in Mumbai for a wedding.' });

    expect(response.status).toBe(503);
    expect(response.body.code).toBe('AI_CONFIG_MISSING');
    expect(response.body.message).toContain('not configured');
    expect(response.body).not.toHaveProperty('apiKey');
  });

  it('handles provider 401 unauthenticated / invalid key error safely with 503 without leaking secrets', async () => {
    const authError = Object.assign(new Error('API key not valid. Please pass a valid API key.'), {
      status: 401,
      code: 'UNAUTHENTICATED'
    });
    const mockGenerator = vi.fn().mockRejectedValue(authError);
    const app = createApp({ aiOptions: { generator: mockGenerator } });

    const response = await request(app)
      .post('/api/ai/extract-event-details')
      .send({ description: 'Need an event planner in Pune.' });

    expect(response.status).toBe(503);
    expect(response.body.code).toBe('AI_CONFIG_MISSING');
    expect(response.body.message).toContain('not configured');
    expect(JSON.stringify(response.body)).not.toContain('API key not valid');
  });

  it('handles provider 403 permission denied / blocked key error safely with 503', async () => {
    const forbiddenError = Object.assign(new Error('Permission denied on resource projects/x/models/y.'), {
      status: 403,
      code: 'PERMISSION_DENIED'
    });
    const mockGenerator = vi.fn().mockRejectedValue(forbiddenError);
    const app = createApp({ aiOptions: { generator: mockGenerator } });

    const response = await request(app)
      .post('/api/ai/extract-event-details')
      .send({ description: 'Need a band in Kolkata.' });

    expect(response.status).toBe(503);
    expect(response.body.code).toBe('AI_CONFIG_MISSING');
    expect(response.body.message).toContain('not configured');
  });

  it('handles provider 404 model not found error safely with 503 model configuration diagnosis', async () => {
    const notFoundError = Object.assign(
      new Error('models/gemini-2.5-flash is not found for API version v1beta, or is not supported for generateContent.'),
      {
        status: 404,
        code: 'NOT_FOUND'
      }
    );
    const mockGenerator = vi.fn().mockRejectedValue(notFoundError);
    const app = createApp({ aiOptions: { generator: mockGenerator } });

    const response = await request(app)
      .post('/api/ai/extract-event-details')
      .send({ description: 'Corporate summit in Hyderabad.' });

    expect(response.status).toBe(503);
    expect(response.body.code).toBe('AI_CONFIG_MISSING');
    expect(response.body.message).toContain('model is currently unavailable');
    // Does not expose provider error details
    expect(JSON.stringify(response.body)).not.toContain('v1beta');
  });

  it('handles Gemini quota / token / rate-limit with HTTP 429 AI_LIMIT_REACHED', async () => {
    const quotaError = Object.assign(new Error('Resource has been exhausted (e.g. check quota).'), {
      status: 429,
      code: 'RESOURCE_EXHAUSTED'
    });
    const mockGenerator = vi.fn().mockRejectedValue(quotaError);
    const app = createApp({ aiOptions: { generator: mockGenerator } });

    const response = await request(app)
      .post('/api/ai/extract-event-details')
      .send({ description: 'Need catering and DJ in Delhi for 50 people.' });

    expect(response.status).toBe(429);
    expect(response.body).toEqual({
      code: 'AI_LIMIT_REACHED',
      message: 'The AI assistant has temporarily reached its usage limit. Please complete the event form manually.'
    });
  });

  it('handles invalid Gemini JSON with a safe fallback 422', async () => {
    const mockGenerator = vi.fn().mockResolvedValue('Sorry, I cannot help with that event as structured data.');
    const app = createApp({ aiOptions: { generator: mockGenerator } });

    const response = await request(app)
      .post('/api/ai/extract-event-details')
      .send({ description: 'Plan a mystery event.' });

    expect(response.status).toBe(422);
    expect(response.body.code).toBe('AI_PARSE_FAILED');
    expect(response.body.message).toContain('Please complete the event form manually');
  });

  it('handles Gemini network or timeout error with retryable 504 response', async () => {
    const timeoutError = Object.assign(new Error('Gemini request timed out after 45 seconds.'), {
      code: 'ETIMEDOUT'
    });
    const mockGenerator = vi.fn().mockRejectedValue(timeoutError);
    const app = createApp({ aiOptions: { generator: mockGenerator } });

    const response = await request(app)
      .post('/api/ai/extract-event-details')
      .send({ description: 'Need sound technicians in Chennai.' });

    expect(response.status).toBe(504);
    expect(response.body.code).toBe('AI_NETWORK_ERROR');
    expect(response.body.message).toContain('retry or continue manually');
  });

  it('handles request cancellation / AbortError gracefully with 504 response', async () => {
    const abortError = Object.assign(new Error('This operation was aborted'), {
      name: 'AbortError',
      code: 'ABORT_ERR'
    });
    const mockGenerator = vi.fn().mockRejectedValue(abortError);
    const app = createApp({ aiOptions: { generator: mockGenerator } });

    const response = await request(app)
      .post('/api/ai/extract-event-details')
      .send({ description: 'Need event anchors in Hyderabad.' });

    expect(response.status).toBe(504);
    expect(response.body.code).toBe('AI_NETWORK_ERROR');
    expect(response.body.message).toContain('retry or continue manually');
  });

  it('validates minimum description length', async () => {
    const app = createApp();
    const response = await request(app).post('/api/ai/extract-event-details').send({ description: 'hi' });

    expect(response.status).toBe(422);
    expect(response.body.errors.description).toBeDefined();
  });
});
