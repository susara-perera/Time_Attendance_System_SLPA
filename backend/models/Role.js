const mongoose = require('mongoose');

const RoleSchema = new mongoose.Schema({
  value: { type: String, required: true, unique: true },
  label: { type: String, required: true },
  // legacy/index compatibility: some deployments may have a unique index on `name`.
  // Store a copy of the label in `name` to avoid null/duplicate key issues.
  name: { type: String, default: '' },
  description: { type: String, default: '' },
  // permissions is a free-form object describing allowed actions.
  // Example shape:
  // { users: { create: true, edit: false, delete: false }, reports: { view: true } }
  permissions: { type: Object, default: {} },
  updatedAt: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Role', RoleSchema);
