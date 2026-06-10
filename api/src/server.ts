import 'dotenv/config';
import express, { type NextFunction, type Request, type Response } from 'express';
import mongoose from 'mongoose';
import cors from 'cors';

import tenantsRouter from './routes/tenants.js';
// import usersRouter from './routes/users.js';
// import selectionProcessesRouter from './routes/selectionProcesses.js';
// import positionsRouter from './routes/positions.js';
// import candidatesRouter from './routes/candidates.js';
// import matchesRouter from './routes/matches.js';

const app = express();
app.use(cors());
app.use(express.json());

// Tenant middleware — skipped for tenant creation endpoint
app.use((req: Request, res: Response, next: NextFunction) => {
  if (req.method === 'POST' && req.path === '/api/v1/tenants') return next();

  const tenantIdHeader = req.headers['x-tenant-id'];
  const tenantId = Array.isArray(tenantIdHeader) ? tenantIdHeader[0] : tenantIdHeader;
  if (!tenantId) return res.status(400).json({ error: 'X-Tenant-Id header required' });

  req.tenantId = tenantId;
  next();
});

app.use('/api/v1/tenants', tenantsRouter);
// app.use('/api/v1/users', usersRouter);
// app.use('/api/v1/selection-processes', selectionProcessesRouter);
// app.use('/api/v1/positions', positionsRouter);
// app.use('/api/v1/candidates', candidatesRouter);
// app.use('/api/v1/matches', matchesRouter);

const mongoUri = process.env.MONGO_URI;
if (!mongoUri) {
  console.error('MONGO_URI environment variable is required');
  process.exit(1);
}

mongoose
  .connect(mongoUri)
  .then(() => {
    const port = process.env.PORT || 3000;
    app.listen(port, () => console.log(`API running on port ${port}`));
  })
  .catch((err: unknown) => {
    console.error('MongoDB connection error:', err instanceof Error ? err.message : err);
    process.exit(1);
  });
