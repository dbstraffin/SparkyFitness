import { beforeEach, describe, expect, it, vi } from 'vitest';
// @ts-expect-error TS(7016): Could not find a declaration file for module 'supertest'
import request from 'supertest';
import express from 'express';
import { myFitnessPalImportResponseSchema } from '@workspace/shared';
import type { MyFitnessPalImportResponse } from '@workspace/shared';
import myfitnesspalRoutes from '../routes/myfitnesspalRoutes.js';
import { importMyFitnessPalExport } from '../services/myfitnesspalImportService.js';

vi.mock('../middleware/authMiddleware.js', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  authenticate: vi.fn((req: any, _res: any, next: any) => {
    req.userId = 'user-123';
    req.authenticatedUserId = 'actor-123';
    req.originalUserId = 'actor-123';
    next();
  }),
}));
vi.mock('../middleware/requireSelfMiddleware.js', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  default: vi.fn((_req: any, _res: any, next: any) => next()),
}));
vi.mock('../services/myfitnesspalImportService.js', () => ({
  importMyFitnessPalExport: vi.fn(),
}));
vi.mock('../config/logging.js', () => ({ log: vi.fn() }));

const app = express();
app.use('/integrations/myfitnesspal', myfitnesspalRoutes);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
app.use((err: any, _req: any, res: any, _next: any) => {
  res.status(500).json({ error: err.message });
});

const validResponse: MyFitnessPalImportResponse = {
  message: 'Imported 2 of 3 domains.',
  nutrition: { selected: true, imported: 1, skipped: 1, failed: 0 },
  measurement: { selected: true, imported: 1, skipped: 0, failed: 0 },
  exercise: { selected: false, imported: 0, skipped: 0, failed: 0 },
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('POST /integrations/myfitnesspal/import', () => {
  it('returns 200 with the service result and forwards the acting user', async () => {
    vi.mocked(importMyFitnessPalExport).mockResolvedValue(validResponse);

    const res = await request(app)
      .post('/integrations/myfitnesspal/import')
      .attach('file', Buffer.from('fake-zip-bytes'), 'export.zip')
      .field('weightUnit', 'lb')
      .field('domains', 'nutrition,measurement');

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual(validResponse);
    expect(myFitnessPalImportResponseSchema.safeParse(res.body).success).toBe(
      true
    );
    expect(importMyFitnessPalExport).toHaveBeenCalledWith(
      'user-123',
      'actor-123',
      expect.any(Buffer),
      { weightUnit: 'lb', domains: ['nutrition', 'measurement'] }
    );
  });

  it('defaults weightUnit to lb and domains to all three when omitted', async () => {
    vi.mocked(importMyFitnessPalExport).mockResolvedValue(validResponse);

    const res = await request(app)
      .post('/integrations/myfitnesspal/import')
      .attach('file', Buffer.from('fake-zip-bytes'), 'export.zip');

    expect(res.statusCode).toBe(200);
    expect(importMyFitnessPalExport).toHaveBeenCalledWith(
      'user-123',
      'actor-123',
      expect.any(Buffer),
      { weightUnit: 'lb', domains: ['nutrition', 'measurement', 'exercise'] }
    );
  });

  it('returns 400 when no file is attached', async () => {
    const res = await request(app)
      .post('/integrations/myfitnesspal/import')
      .field('weightUnit', 'kg');

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/Missing file/);
    expect(importMyFitnessPalExport).not.toHaveBeenCalled();
  });

  it('returns 400 when a domain value is invalid', async () => {
    const res = await request(app)
      .post('/integrations/myfitnesspal/import')
      .attach('file', Buffer.from('fake-zip-bytes'), 'export.zip')
      .field('domains', 'bogus');

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/Invalid request body/);
    expect(importMyFitnessPalExport).not.toHaveBeenCalled();
  });
});
