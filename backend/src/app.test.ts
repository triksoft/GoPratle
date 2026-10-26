import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from './app.js';

const validPayload = { eventName: 'Product launch', eventType: 'Launch', dateType: 'single', startDate: '2026-11-11', location: 'Pune', category: 'performer', clientSubmissionId: '80f53d33-cc58-477d-bd42-0bbdf9a3d20b', details: { performanceType: 'DJ', durationMinutes: 120, equipmentProvided: 'No, provider should bring it' } };
describe('API', () => {
  it('reports health without requiring a database connection', async () => {
    const response = await request(createApp()).get('/api/health');
    expect(response.status).toBe(200); expect(response.body.status).toBe('ok');
  });
  it('validates a malformed requirement', async () => {
    const response = await request(createApp()).post('/api/requirements').send({});
    expect(response.status).toBe(422); expect(response.body.errors.category).toBeDefined();
  });
  it('persists a valid requirement via its repository', async () => {
    const create = vi.fn().mockResolvedValue({ _id: 'req-1', ...validPayload });
    const response = await request(createApp({ repository: { create, findOne: vi.fn() } })).post('/api/requirements').set('X-Idempotency-Key', validPayload.clientSubmissionId).send(validPayload);
    expect(response.status).toBe(201); expect(create).toHaveBeenCalledOnce(); expect(response.body.requirement._id).toBe('req-1');
  });
  it('returns an existing requirement for a duplicate idempotency key', async () => {
    const response = await request(createApp({ repository: { create: vi.fn().mockRejectedValue({ code: 11000 }), findOne: vi.fn().mockResolvedValue({ _id: 'req-1' }) } })).post('/api/requirements').set('X-Idempotency-Key', validPayload.clientSubmissionId).send(validPayload);
    expect(response.status).toBe(200); expect(response.body.duplicate).toBe(true);
  });
});
