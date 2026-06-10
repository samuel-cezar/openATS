import express, { type Request, type Response } from 'express';
import type { CreateUserRequest } from '@openats/types';
import User from '../models/User.js';

const router = express.Router();

// POST /users
router.post('/', async (req: Request<{}, unknown, CreateUserRequest>, res: Response) => {
  try {
    const user = await User.create({ ...req.body, tenantId: req.tenantId });
    res.status(201).json(user);
  } catch (err: unknown) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// GET /users
router.get('/', async (req: Request, res: Response) => {
  try {
    const users = await User.find({ tenantId: req.tenantId });
    res.json(users);
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

export default router;
