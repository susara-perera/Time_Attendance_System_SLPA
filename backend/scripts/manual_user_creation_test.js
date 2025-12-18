const { createUser } = require('../controllers/userController');
const Division = require('../models/Division');
const Section = require('../models/Section');
const Role = require('../models/Role');
const User = require('../models/User');

// Monkey patch model methods to avoid DB calls
Division.findById = async (id) => ({ _id: id, name: 'Division Name', code: 'DN' });
Division.findOne = async (q) => ({ _id: 'div-id-1', name: 'Division Name', code: 'DN' });
Section.findById = async (id) => ({ _id: id, name: 'Section Name', code: 'SN', division: 'div-id-1' });
Section.findOne = async (q) => ({ _id: 'sec-id-1', name: 'Section Name', code: 'SN', division: 'div-id-1' });
Role.findOne = async (query) => ({ value: query && query.value ? query.value : 'employee' });
User.findOne = async () => null;
User.prototype.save = async function() { return this; };

// Minimal mock of AuditLog.createLog if referenced
const AuditLog = require('../models/AuditLog');
if (AuditLog && typeof AuditLog.createLog === 'function') {
  // leave as-is
} else {
  if (AuditLog) AuditLog.createLog = async () => {};
}

// Mock request/response objects
const makeReqRes = () => {
  const req = {
    body: {
      firstName: 'Script',
      lastName: 'Runner',
      email: `script.runner+${Date.now()}@example.com`,
      employeeId: `EMP${Date.now()}`,
      password: 'pass123',
      role: 'employee',
      division: 'div-id-1',
      section: 'sec-id-1',
      phone: '0123456789'
    },
    user: { _id: 'test-admin', email: 'admin@example.com' },
    // Minimal header getter used in controllers
    get: (header) => ''
  };
  let statusCode = 200;
  const res = {
    status(code) { statusCode = code; return this; },
    json(payload) { console.log('STATUS', statusCode, 'RESPONSE', JSON.stringify(payload, null, 2)); return payload; },
    _getStatus() { return statusCode; }
  };

  return { req, res };
};

(async () => {
  try {
    const { req, res } = makeReqRes();
    console.log('Running createUser with mocked models...');
    await createUser(req, res);
    console.log('Manual test completed');
  } catch (err) {
    console.error('Manual test failed:', err);
  }
})();