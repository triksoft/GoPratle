import { Router, type Request, type Response, type NextFunction } from 'express';
import { isValidObjectId } from 'mongoose';
import { Requirement } from '../models/Requirement.js';
import {
  requirementQuerySchema,
  requirementSchema,
  statusUpdateSchema,
  type ValidRequirement
} from '../validation/requirement.js';

export type RequirementRepository = {
  create: (input: ValidRequirement) => Promise<any>;
  findOne: (filter: any) => Promise<any>;
  find?: (filter: any) => any;
  findById?: (id: string) => Promise<any>;
  findByIdAndUpdate?: (id: string, update: any, options?: any) => Promise<any>;
  countDocuments?: (filter: any) => Promise<number>;
};

function escapeRegex(text: string): string {
  return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
}

function isValidId(id: string): boolean {
  if (!id || typeof id !== 'string') return false;
  return isValidObjectId(id) || /^[a-zA-Z0-9_-]{3,}$/.test(id);
}

function serialise(value: any) {
  if (!value) return value;
  return typeof value.toObject === 'function' ? value.toObject() : value;
}

function isDuplicateKey(error: unknown): error is { code: number } {
  return typeof error === 'object' && error !== null && 'code' in error && (error as { code: number }).code === 11000;
}

export function requirementRouter(repository: RequirementRepository = Requirement as unknown as RequirementRepository) {
  const router = Router();

  // POST /api/requirements - Create requirement (Idempotent)
  router.post('/', async (req: Request, res: Response, next: NextFunction) => {
    const idempotencyKey = req.get('X-Idempotency-Key') ?? req.body?.clientSubmissionId;
    const body = {
      ...req.body,
      phone: req.body?.phone ?? req.body?.phoneNumber,
      email: req.body?.email ?? req.body?.emailId,
      clientSubmissionId: idempotencyKey
    };
    const parsed = requirementSchema.safeParse(body);
    if (!parsed.success) {
      return res.status(422).json({
        message: 'Please correct the invalid fields.',
        errors: parsed.error.flatten().fieldErrors
      });
    }

    try {
      const created = await repository.create(parsed.data);
      return res.status(201).json({ message: 'Requirement created.', requirement: serialise(created) });
    } catch (error: unknown) {
      if (isDuplicateKey(error)) {
        const existing = await repository.findOne({ clientSubmissionId: parsed.data.clientSubmissionId });
        if (existing) {
          return res.status(200).json({
            message: 'Requirement already exists.',
            duplicate: true,
            requirement: serialise(existing)
          });
        }
      }
      return next(error);
    }
  });

  // GET /api/requirements - List requirements with filtering, pagination, search, summary
  router.get('/', async (req: Request, res: Response, next: NextFunction) => {
    const parsedQuery = requirementQuerySchema.safeParse(req.query);
    if (!parsedQuery.success) {
      return res.status(422).json({
        message: 'Invalid query parameters.',
        errors: parsedQuery.error.flatten().fieldErrors
      });
    }

    const { page, limit, category, eventType, location, status, excludeStatus, dateFrom, dateTo, search, sortBy, sortOrder } =
      parsedQuery.data;

    const filter: Record<string, any> = {};
    if (category) filter.category = category;
    if (status) {
      filter.status = status;
    } else if (excludeStatus) {
      filter.status = { $ne: excludeStatus };
    }
    if (eventType) filter.eventType = new RegExp(escapeRegex(eventType), 'i');
    if (location) filter.location = new RegExp(escapeRegex(location), 'i');

    if (dateFrom || dateTo) {
      filter.startDate = {};
      if (dateFrom) filter.startDate.$gte = dateFrom;
      if (dateTo) filter.startDate.$lte = dateTo;
    }

    if (search) {
      const s = new RegExp(escapeRegex(search), 'i');
      filter.$or = [
        { eventName: s },
        { eventType: s },
        { location: s },
        { venue: s },
        { notes: s }
      ];
    }

    try {
      const today = new Date().toISOString().slice(0, 10);

      // Summary metrics
      let totalAll = 0;
      let plannerCount = 0;
      let performerCount = 0;
      let crewCount = 0;
      let upcomingCount = 0;
      let filteredTotal = 0;
      let rawData: any[] = [];

      if (typeof repository.countDocuments === 'function') {
        [totalAll, plannerCount, performerCount, crewCount, upcomingCount, filteredTotal] = await Promise.all([
          repository.countDocuments({}),
          repository.countDocuments({ category: 'planner' }),
          repository.countDocuments({ category: 'performer' }),
          repository.countDocuments({ category: 'crew' }),
          repository.countDocuments({
            $or: [{ startDate: { $gte: today } }, { dateType: 'range', endDate: { $gte: today } }]
          }),
          repository.countDocuments(filter)
        ]);
      }

      if (typeof repository.find === 'function') {
        const queryChain = repository.find(filter);
        if (queryChain && typeof queryChain.sort === 'function') {
          rawData = await queryChain
            .sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .lean ? await queryChain.sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1 }).skip((page - 1) * limit).limit(limit).lean() : await queryChain.sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1 }).skip((page - 1) * limit).limit(limit);
        } else if (Array.isArray(queryChain)) {
          rawData = queryChain;
          if (filteredTotal === 0) filteredTotal = rawData.length;
        } else {
          rawData = await queryChain;
        }
      }

      const totalPages = Math.max(1, Math.ceil(filteredTotal / limit));
      const pagination = {
        page,
        limit,
        total: filteredTotal,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      };

      const summary = {
        total: totalAll || filteredTotal,
        planner: plannerCount,
        performer: performerCount,
        crew: crewCount,
        upcoming: upcomingCount
      };

      // Protect contact data in list response: omit phone and email
      const data = Array.isArray(rawData)
        ? rawData.map(serialise).map((item: any) => {
            const { phone, email, ...rest } = item;
            return rest;
          })
        : [];

      return res.status(200).json({
        data,
        pagination,
        summary
      });
    } catch (error) {
      return next(error);
    }
  });

  // GET /api/requirements/:id - Get requirement details by ID
  router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
    const id = typeof req.params.id === 'string' ? req.params.id : String(req.params.id || '');
    if (!isValidId(id)) {
      return res.status(404).json({ message: 'Requirement not found.' });
    }

    try {
      if (typeof repository.findById !== 'function') {
        return res.status(404).json({ message: 'Requirement not found.' });
      }
      const found = await repository.findById(id);
      if (!found) {
        return res.status(404).json({ message: 'Requirement not found.' });
      }
      return res.status(200).json({ requirement: serialise(found) });
    } catch (error) {
      return next(error);
    }
  });

  // PATCH /api/requirements/:id/status - Update requirement status
  router.patch('/:id/status', async (req: Request, res: Response, next: NextFunction) => {
    const id = typeof req.params.id === 'string' ? req.params.id : String(req.params.id || '');
    if (!isValidId(id)) {
      return res.status(404).json({ message: 'Requirement not found.' });
    }

    const parsed = statusUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(422).json({
        message: 'Please provide a valid status.',
        errors: parsed.error.flatten().fieldErrors
      });
    }

    try {
      if (typeof repository.findByIdAndUpdate !== 'function') {
        return res.status(404).json({ message: 'Requirement not found.' });
      }
      const updated = await repository.findByIdAndUpdate(
        id,
        { $set: { status: parsed.data.status } },
        { new: true }
      );
      if (!updated) {
        return res.status(404).json({ message: 'Requirement not found.' });
      }
      return res.status(200).json({
        message: 'Status updated.',
        requirement: serialise(updated)
      });
    } catch (error) {
      return next(error);
    }
  });

  return router;
}
