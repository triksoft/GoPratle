import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../app.js';

describe('Admin API', () => {
  it('returns AI system status', async () => {
    const app = createApp();
    const response = await request(app).get('/api/admin/ai-status');

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('status');
    expect(['available', 'limited', 'unavailable']).toContain(response.body.status);
    expect(response.body).toHaveProperty('updatedAt');
  });
});
