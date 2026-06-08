const mongoose = require('mongoose');

const selectionProcessSchema = new mongoose.Schema({
  tenantId: { type: String, required: true, index: true },
  name: String,
  description: String,
  startDate: Date,
  endDate: Date
});

module.exports = mongoose.model('SelectionProcess', selectionProcessSchema);
