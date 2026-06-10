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
      if (alpha + beta !== 1) {
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
