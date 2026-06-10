import express, { type Request, type Response } from 'express';
import mongoose from 'mongoose';
import type {
  CreateSelectionProcessRequest,
  UpdateSelectionProcessRequest,
} from '@openats/types';
import SelectionProcess from '../models/SelectionProcess.js';

const router = express.Router();

// POST /selection-processes
router.post('/', async (req: Request<{}, unknown, CreateSelectionProcessRequest>, res: Response) => {
  try {
    const process = await SelectionProcess.create({ ...req.body, tenantId: req.tenantId });
    res.status(201).json(process);
  } catch (err: unknown) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// GET /selection-processes
router.get('/', async (req: Request, res: Response) => {
  try {
    const processes = await SelectionProcess.find({ tenantId: req.tenantId });
    res.json(processes);
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// GET /selection-processes/:id
router.get('/:id', async (req: Request<{ id: string }>, res: Response) => {
  try {
    const process = await SelectionProcess.findOne({ _id: req.params.id, tenantId: req.tenantId });
    if (!process) return res.status(404).json({ error: 'Selection process not found' });
    res.json(process);
  } catch (err: unknown) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// PUT /selection-processes/:id
router.put(
  '/:id',
  async (
    req: Request<{ id: string }, unknown, UpdateSelectionProcessRequest & { tenantId?: unknown }>,
    res: Response
  ) => {
    try {
      const { tenantId, ...updates } = req.body;
      const process = await SelectionProcess.findOneAndUpdate(
        { _id: req.params.id, tenantId: req.tenantId },
        updates,
        { new: true, runValidators: true }
      );
      if (!process) return res.status(404).json({ error: 'Selection process not found' });
      res.json(process);
    } catch (err: unknown) {
      res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
    }
  }
);

// DELETE /selection-processes/:id
router.delete('/:id', async (req: Request<{ id: string }>, res: Response) => {
  try {
    const positionCount = await mongoose.connection.collection('positions').countDocuments({
      selectionProcessId: new mongoose.Types.ObjectId(req.params.id),
      tenantId: req.tenantId,
    });
    if (positionCount > 0) {
      return res.status(400).json({ error: 'Remove its positions first' });
    }
    const process = await SelectionProcess.findOneAndDelete({ _id: req.params.id, tenantId: req.tenantId });
    if (!process) return res.status(404).json({ error: 'Selection process not found' });
    res.json({ deleted: true });
  } catch (err: unknown) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

export default router;
