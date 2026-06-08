const mongoose = require('mongoose');

const matchSchema = new mongoose.Schema({
  tenantId: { type: String, required: true, index: true },
  candidateId: { type: mongoose.Schema.Types.ObjectId, ref: 'Candidate' },
  positionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Position' },
  totalScore: Number,
  hardScore: Number,
  softScore: Number,
  rank: Number,
  computedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Match', matchSchema);
