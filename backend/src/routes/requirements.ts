import { Router, type Request, type Response, type NextFunction } from 'express';
import { Requirement } from '../models/Requirement.js';
import { requirementSchema, type ValidRequirement } from '../validation/requirement.js';

export type RequirementRepository = {
  create: (input: ValidRequirement) => Promise<{ toObject?: () => unknown; _id?: unknown }>;
  findOne: (filter: { clientSubmissionId: string }) => Promise<{ toObject?: () => unknown; _id?: unknown } | null>;
};

export function requirementRouter(repository: RequirementRepository = Requirement as unknown as RequirementRepository) {
  const router = Router();
  router.post('/', async (req: Request, res: Response, next: NextFunction) => {
    const parsed = requirementSchema.safeParse({ ...req.body, clientSubmissionId: req.get('X-Idempotency-Key') ?? req.body.clientSubmissionId });
    if (!parsed.success) return res.status(422).json({ message: 'Please correct the invalid fields.', errors: parsed.error.flatten().fieldErrors });
    try {
      const created = await repository.create(parsed.data);
      return res.status(201).json({ message: 'Requirement created.', requirement: serialise(created) });
    } catch (error: unknown) {
      if (isDuplicateKey(error)) {
        const existing = await repository.findOne({ clientSubmissionId: parsed.data.clientSubmissionId });
        if (existing) return res.status(200).json({ message: 'Requirement already exists.', duplicate: true, requirement: serialise(existing) });
      }
      return next(error);
    }
  });
  return router;
}

function isDuplicateKey(error: unknown): error is { code: number } {
  return typeof error === 'object' && error !== null && 'code' in error && (error as { code: number }).code === 11000;
}

function serialise(value: { toObject?: () => unknown; _id?: unknown }) { return value.toObject ? value.toObject() : value; }
