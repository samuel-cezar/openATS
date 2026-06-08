const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  tenantId: { type: String, required: true, index: true },
  name: String,
  email: { type: String, required: true },
  role: { type: String, enum: ['recruiter', 'admin'], default: 'recruiter' }
});

module.exports = mongoose.model('User', userSchema);
