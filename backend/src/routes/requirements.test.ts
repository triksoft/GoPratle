import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../app.js';

const sampleRequirement = {
  _id: '64b1f2e9a1b2c3d4e5f6a7b8',
  eventName: 'Tech Conference 2026',
  eventType: 'Conference',
  dateType: 'range',
  startDate: '2026-11-20',
  endDate: '2026-11-22',
  location: 'Hyderabad',
  venue: 'HICC',
  category: 'planner',
  details: { budget: 500000, guestCount: 300, planningScope: 'Full planning' },
  notes: 'Keynotes and breakout tracks.',
  clientSubmissionId: '99f53d33-cc58-477d-bd42-0bbdf9a3d20c',
  status: 'new',
  createdAt: '2026-11-14T10:00:00.000Z',
  updatedAt: '2026-11-14T10:00:00.000Z'
};

describe('Requirements API (Dashboard & Calendar)', () => {
  it('lists requirements with pagination and summary counts', async () => {
    const mockFindChain = {
      sort: vi.fn().mockReturnThis(),
      skip: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([sampleRequirement])
    };
    const mockRepo = {
      create: vi.fn(),
      findOne: vi.fn(),
      find: vi.fn().mockReturnValue(mockFindChain),
      countDocuments: vi.fn().mockImplementation((filter: any) => {
        if (filter.category === 'planner') return Promise.resolve(5);
        if (filter.category === 'performer') return Promise.resolve(3);
        if (filter.category === 'crew') return Promise.resolve(2);
        return Promise.resolve(10);
      })
    };

    const app = createApp({ repository: mockRepo });
    const response = await request(app).get('/api/requirements?page=1&limit=5');

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].eventName).toBe('Tech Conference 2026');
    expect(response.body.pagination).toEqual({
      page: 1,
      limit: 5,
      total: 10,
      totalPages: 2,
      hasNextPage: true,
      hasPrevPage: false
    });
    expect(response.body.summary).toEqual({
      total: 10,
      planner: 5,
      performer: 3,
      crew: 2,
      upcoming: 10
    });
  });

  it('filters requirements by category and status', async () => {
    const mockFindChain = {
      sort: vi.fn().mockReturnThis(),
      skip: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([sampleRequirement])
    };
    const mockRepo = {
      create: vi.fn(),
      findOne: vi.fn(),
      find: vi.fn().mockReturnValue(mockFindChain),
      countDocuments: vi.fn().mockResolvedValue(1)
    };

    const app = createApp({ repository: mockRepo });
    const response = await request(app).get('/api/requirements?category=planner&status=new');

    expect(response.status).toBe(200);
    expect(mockRepo.find).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'planner',
        status: 'new'
      })
    );
  });

  it('filters out closed requirements when excludeStatus=closed query param is passed', async () => {
    const mockFindChain = {
      sort: vi.fn().mockReturnThis(),
      skip: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([sampleRequirement])
    };
    const mockRepo = {
      create: vi.fn(),
      findOne: vi.fn(),
      find: vi.fn().mockReturnValue(mockFindChain),
      countDocuments: vi.fn().mockResolvedValue(1)
    };

    const app = createApp({ repository: mockRepo });
    const response = await request(app).get('/api/requirements?excludeStatus=closed');

    expect(response.status).toBe(200);
    expect(mockRepo.find).toHaveBeenCalledWith(
      expect.objectContaining({
        status: { $ne: 'closed' }
      })
    );
  });

  it('rejects invalid query parameters with 422', async () => {
    const app = createApp();
    const response = await request(app).get('/api/requirements?category=invalidCategory');
    expect(response.status).toBe(422);
    expect(response.body.errors.category).toBeDefined();
  });

  it('returns a single requirement by ID', async () => {
    const mockRepo = {
      create: vi.fn(),
      findOne: vi.fn(),
      findById: vi.fn().mockResolvedValue(sampleRequirement)
    };

    const app = createApp({ repository: mockRepo });
    const response = await request(app).get(`/api/requirements/${sampleRequirement._id}`);

    expect(response.status).toBe(200);
    expect(response.body.requirement._id).toBe(sampleRequirement._id);
    expect(mockRepo.findById).toHaveBeenCalledWith(sampleRequirement._id);
  });

  it('returns 404 when requirement ID is not found', async () => {
    const mockRepo = {
      create: vi.fn(),
      findOne: vi.fn(),
      findById: vi.fn().mockResolvedValue(null)
    };

    const app = createApp({ repository: mockRepo });
    const response = await request(app).get('/api/requirements/64b1f2e9a1b2c3d4e5f6a7b9');

    expect(response.status).toBe(404);
    expect(response.body.message).toBe('Requirement not found.');
  });

  it('updates requirement status via PATCH /api/requirements/:id/status', async () => {
    const updatedRequirement = { ...sampleRequirement, status: 'confirmed' };
    const mockRepo = {
      create: vi.fn(),
      findOne: vi.fn(),
      findByIdAndUpdate: vi.fn().mockResolvedValue(updatedRequirement)
    };

    const app = createApp({ repository: mockRepo });
    const response = await request(app)
      .patch(`/api/requirements/${sampleRequirement._id}/status`)
      .send({ status: 'confirmed' });

    expect(response.status).toBe(200);
    expect(response.body.message).toBe('Status updated.');
    expect(response.body.requirement.status).toBe('confirmed');
    expect(mockRepo.findByIdAndUpdate).toHaveBeenCalledWith(
      sampleRequirement._id,
      { $set: { status: 'confirmed' } },
      { new: true }
    );
  });

  it('rejects an invalid status update with 422', async () => {
    const app = createApp();
    const response = await request(app)
      .patch(`/api/requirements/${sampleRequirement._id}/status`)
      .send({ status: 'invalid_status' });

    expect(response.status).toBe(422);
    expect(response.body.errors.status).toBeDefined();
  });

  it('stores phone number and email when creating requirement', async () => {
    const create = vi.fn().mockImplementation((input: any) => Promise.resolve({ _id: 'req-contact', ...input }));
    const app = createApp({ repository: { create, findOne: vi.fn() } });
    const payload = {
      ...sampleRequirement,
      phone: '+91 98765 43210',
      email: 'organizer@event.com',
      clientSubmissionId: '123e4567-e89b-12d3-a456-426614174000'
    };

    const response = await request(app)
      .post('/api/requirements')
      .send(payload);

    expect(response.status).toBe(201);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        phone: '+91 98765 43210',
        email: 'organizer@event.com'
      })
    );
  });

  it('accepts phoneNumber and emailId aliases when creating requirement', async () => {
    const create = vi.fn().mockImplementation((input: any) => Promise.resolve({ _id: 'req-aliases', ...input }));
    const app = createApp({ repository: { create, findOne: vi.fn() } });
    const payload = {
      ...sampleRequirement,
      phoneNumber: '9876543210',
      emailId: 'alias@event.com',
      clientSubmissionId: '123e4567-e89b-12d3-a456-426614174001'
    };

    const response = await request(app)
      .post('/api/requirements')
      .send(payload);

    expect(response.status).toBe(201);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        phone: '9876543210',
        email: 'alias@event.com'
      })
    );
  });
});
