import express, { type Request, type Response } from 'express';
import type { CreateTenantRequest, UpdateTenantWeightsRequest } from '@openats/types';
import Tenant from '../models/Tenant.js';

const router = express.Router();

// POST /tenants — create tenant (no X-Tenant-Id required)
router.post('/', async (req: Request<{}, unknown, CreateTenantRequest>, res: Response) => {
  try {
    const tenant = await Tenant.create(req.body);
    res.status(201).json(tenant);
  } catch (err: unknown) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// GET /tenants/current — read the tenant keyed by the X-Tenant-Id header.
// Falls back to default weights (without creating a document) when none exists,
// so the frontend can always render current weights.
router.get('/current', async (req: Request, res: Response) => {
  try {
    const tenant = await Tenant.findOne({ key: req.tenantId });
    if (tenant) return res.json(tenant);
    res.json({ key: req.tenantId, name: req.tenantId, alpha: 0.6, beta: 0.4 });
  } catch (err: unknown) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// PUT /tenants/current/weights — upsert the weights for the header-keyed tenant.
router.put(
  '/current/weights',
  async (req: Request<{}, unknown, UpdateTenantWeightsRequest>, res: Response) => {
    try {
      const { alpha, beta } = req.body;
      if (Math.abs(alpha + beta - 1) > 1e-9) {
        return res.status(400).json({ error: 'alpha + beta must equal 1' });
      }
      const tenant = await Tenant.findOneAndUpdate(
        { key: req.tenantId },
        { key: req.tenantId, name: req.tenantId, alpha, beta },
        { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true }
      );
      res.json(tenant);
    } catch (err: unknown) {
      res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
    }
  }
);

// GET /tenants/:id
router.get('/:id', async (req: Request<{ id: string }>, res: Response) => {
  try {
    const tenant = await Tenant.findById(req.params.id);
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });
    res.json(tenant);
  } catch (err: unknown) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// PUT /tenants/:id/weights — update alpha and beta
router.put(
  '/:id/weights',
  async (req: Request<{ id: string }, unknown, UpdateTenantWeightsRequest>, res: Response) => {
    try {
      const { alpha, beta } = req.body;
      if (Math.abs(alpha + beta - 1) > 1e-9) {
        return res.status(400).json({ error: 'alpha + beta must equal 1' });
      }
      const tenant = await Tenant.findByIdAndUpdate(
        req.params.id,
        { alpha, beta },
        { new: true, runValidators: true }
      );
      if (!tenant) return res.status(404).json({ error: 'Tenant not found' });
      res.json(tenant);
    } catch (err: unknown) {
      res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
    }
  }
);

export default router;
