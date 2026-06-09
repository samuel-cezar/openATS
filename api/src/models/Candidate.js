const mongoose = require('mongoose');

const candidateSchema = new mongoose.Schema({
  tenantId: { type: String, required: true, index: true },
  name: String,
  email: String,
  resumePdfUrl: String,
  extractedText: String,
  hardSkills: [String],
  softSkills: [String],
  embeddingHS: [Number],
  embeddingSS: [Number],
  processed: { type: Boolean, default: false },
  skillsStale: { type: Boolean, default: false }
});

module.exports = mongoose.model('Candidate', candidateSchema);
