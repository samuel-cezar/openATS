const mongoose = require('mongoose');

const positionSchema = new mongoose.Schema({
  tenantId: { type: String, required: true, index: true },
  selectionProcessId: { type: mongoose.Schema.Types.ObjectId, ref: 'SelectionProcess' },
  title: String,
  jobDescription: String,
  hardSkillsRequired: [String],
  softSkillsRequired: [String],
  embeddingHS: [Number],
  embeddingSS: [Number],
  processed: { type: Boolean, default: false }
});

module.exports = mongoose.model('Position', positionSchema);
