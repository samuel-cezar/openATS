require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// Tenant middleware — skipped for tenant creation endpoint
app.use((req, res, next) => {
  if (req.method === 'POST' && req.path === '/api/v1/tenants') return next();
  const tenantId = req.headers['x-tenant-id'];
  if (!tenantId) return res.status(400).json({ error: 'X-Tenant-Id header required' });
  req.tenantId = tenantId;
  next();
});

app.use('/api/v1/tenants', require('./routes/tenants'));
app.use('/api/v1/users', require('./routes/users'));
app.use('/api/v1/selection-processes', require('./routes/selectionProcesses'));
app.use('/api/v1/positions', require('./routes/positions'));
app.use('/api/v1/candidates', require('./routes/candidates'));
app.use('/api/v1/matches', require('./routes/matches'));

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    const port = process.env.PORT || 3000;
    app.listen(port, () => console.log(`API running on port ${port}`));
  })
  .catch(err => {
    console.error('MongoDB connection error:', err.message);
    process.exit(1);
  });
