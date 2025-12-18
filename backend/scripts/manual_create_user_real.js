const { createUser } = require('../controllers/userController');
const User = require('../models/User');
const connectDB = require('../config/database');

const makeReqRes = (body) => {
  const req = {
    body,
    user: { _id: '689ebb067f15f1a2e6209f99', email: 'bawantha@slpa.com' }, // existing super_admin from DB
    get: (h) => ''
  };

  let statusCode = 200;
  let payload = null;
  const res = {
    status(code) { statusCode = code; return this; },
    json(obj) { payload = obj; console.log('STATUS', statusCode, 'PAYLOAD', JSON.stringify(obj, null, 2)); return obj; }
  };

  return { req, res };
};

(async () => {
  try {
    await connectDB();
    const { req, res } = makeReqRes({
      firstName: 'E2E',
      lastName: 'Tester',
      email: `e2e.tester.${Date.now()}@example.com`,
      employeeId: `E2E${Date.now()}`,
      password: 'pass123',
      role: 'employee',
      division: '53',
      section: '131',
      phone: '0770000000'
    });

    await createUser(req, res);
  } catch (err) {
    console.error('Manual real test failed:', err);
  }
})();