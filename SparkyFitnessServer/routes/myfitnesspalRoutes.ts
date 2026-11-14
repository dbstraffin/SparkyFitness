import express from 'express';
// @ts-expect-error TS(7016): Could not find a declaration file for module 'multer'
import multer from 'multer';
import { myFitnessPalImportRequestSchema } from '@workspace/shared';
import { authenticate } from '../middleware/authMiddleware.js';
import requireSelfActor from '../middleware/requireSelfMiddleware.js';
import { importMyFitnessPalExport } from '../services/myfitnesspalImportService.js';
import { log } from '../config/logging.js';

const mfpUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
});

const router = express.Router();

/**
 * @swagger
 * /integrations/myfitnesspal/import:
 *   post:
 *     summary: Import a MyFitnessPal Premium export ZIP
 *     description: >
 *       Uploads the MyFitnessPal Premium export ZIP (Nutrition-Summary,
 *       Measurement-Summary, Exercise-Summary) and ingests the selected
 *       domains into the food diary, check-in measurements, and exercise
 *       history. Owner-only.
 *     tags: [External Integrations]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [file]
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *               weightUnit:
 *                 type: string
 *                 enum: [kg, lb]
 *                 description: Unit the weight figures were recorded in
 *               domains:
 *                 type: array
 *                 items:
 *                   type: string
 *                   enum: [nutrition, measurement, exercise]
 *                 description: Which domains to import
 *     responses:
 *       200:
 *         description: Per-domain import counts
 *       400:
 *         description: Invalid request (missing file or bad body)
 */
router.post(
  '/import',
  authenticate,
  requireSelfActor,
  mfpUpload.single('file'),
  async (req, res, next) => {
    try {
      const uploadedFile = (req as unknown as { file?: { buffer: Buffer } })
        .file;
      if (!uploadedFile?.buffer) {
        return res
          .status(400)
          .json({ error: 'Missing file. Upload the MyFitnessPal export ZIP.' });
      }

      const weightUnit = req.body?.weightUnit === 'kg' ? 'kg' : 'lb';
      const rawDomains = req.body?.domains;
      const domains = Array.isArray(rawDomains)
        ? rawDomains
        : typeof rawDomains === 'string'
          ? rawDomains
              .split(',')
              .map((d: string) => d.trim())
              .filter(Boolean)
          : undefined;

      const validation = myFitnessPalImportRequestSchema.safeParse({
        weightUnit,
        domains,
      });
      if (!validation.success) {
        return res.status(400).json({
          error: 'Invalid request body',
          details: validation.error.issues,
        });
      }

      const result = await importMyFitnessPalExport(
        req.userId,
        req.authenticatedUserId || req.userId,
        uploadedFile.buffer,
        validation.data
      );
      return res.json(result);
    } catch (error) {
      log('error', 'MyFitnessPal import failed:', error);
      next(error);
    }
  }
);

export default router;
