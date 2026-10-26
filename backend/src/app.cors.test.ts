import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from './app.js';

describe('CORS', () => {
  it('allows the production Vercel frontend', async () => {
    const response = await request(createApp()).get('/api/health').set('Origin', 'https://go-pratle-lovat.vercel.app');
    expect(response.status).toBe(200);
    expect(response.headers['access-control-allow-origin']).toBe('https://go-pratle-lovat.vercel.app');
  });
});
