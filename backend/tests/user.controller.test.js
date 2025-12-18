const { createUser } = require('../controllers/userController');
const httpMocks = require('node-mocks-http');

jest.mock('../models/Division');
jest.mock('../models/Section');
jest.mock('../models/Role');
jest.mock('../models/User');

const Division = require('../models/Division');
const Section = require('../models/Section');
const Role = require('../models/Role');
const User = require('../models/User');

describe('createUser controller', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  test('creates user when division and section provided as IDs', async () => {
    const req = httpMocks.createRequest({
      method: 'POST',
      url: '/api/users',
      body: {
        firstName: 'Test',
        lastName: 'User',
        email: 'test.user@example.com',
        employeeId: 'EMP1000',
        password: 'pass123',
        role: 'employee',
        division: 'div-id-1',
        section: 'sec-id-1'
      }
    });
    const res = httpMocks.createResponse();

    // Mock role exists
    Role.findOne = jest.fn().mockResolvedValue({ value: 'employee' });

    // Mock division and section lookups
    Division.findById = jest.fn().mockResolvedValue({ _id: 'div-id-1', name: 'Division' });
    Section.findById = jest.fn().mockResolvedValue({ _id: 'sec-id-1', division: 'div-id-1' });

    // Mock User.findOne (no existing user)
    User.findOne = jest.fn().mockResolvedValue(null);

    // Mock User save behaviour via constructor prototype
    const fakeSavedUser = {
      _id: 'new-user-id',
      firstName: 'Test',
      lastName: 'User',
      email: 'test.user@example.com',
      employeeId: 'EMP1000',
      role: 'employee'
    };

    User.prototype.save = jest.fn().mockResolvedValue(fakeSavedUser);
    User.prototype.populate = jest.fn().mockResolvedValue(fakeSavedUser);

    await createUser(req, res);

    expect(res.statusCode).toBe(201);
    const data = res._getJSONData();
    expect(data.success).toBe(true);
    expect(data.data.email).toBe('test.user@example.com');
    expect(User.findOne).toHaveBeenCalled();
  });

  test('rejects when section does not belong to division', async () => {
    const req = httpMocks.createRequest({
      method: 'POST',
      url: '/api/users',
      body: {
        firstName: 'Test',
        lastName: 'User',
        email: 'test2.user@example.com',
        employeeId: 'EMP1001',
        password: 'pass123',
        role: 'employee',
        division: 'div-id-1',
        section: 'sec-id-2'
      }
    });
    const res = httpMocks.createResponse();

    Role.findOne = jest.fn().mockResolvedValue({ value: 'employee' });
    Division.findById = jest.fn().mockResolvedValue({ _id: 'div-id-1', name: 'Division' });
    Section.findById = jest.fn().mockResolvedValue({ _id: 'sec-id-2', division: 'other-div' });

    await createUser(req, res);

    expect(res.statusCode).toBe(400);
    const data = res._getData();
    expect(JSON.parse(data).message).toMatch(/Section does not belong/);
  });

  test('saves division and section names along with ids', async () => {
    const req = httpMocks.createRequest({
      method: 'POST',
      url: '/api/users',
      body: {
        firstName: 'Name',
        lastName: 'Surname',
        email: 'name.surname@example.com',
        employeeId: 'EMP2000',
        password: 'pass123',
        role: 'employee',
        division: 'div-id-1',
        section: 'sec-id-1'
      }
    });
    const res = httpMocks.createResponse();

    Role.findOne = jest.fn().mockResolvedValue({ value: 'employee' });
    Division.findById = jest.fn().mockResolvedValue({ _id: 'div-id-1', name: 'Division Name', code: 'DN' });
    Section.findById = jest.fn().mockResolvedValue({ _id: 'sec-id-1', name: 'Section Name', code: 'SN', division: 'div-id-1' });
    User.findOne = jest.fn().mockResolvedValue(null);

    // Check that the created user instance contains the name fields
    const fakeSavedUser = {
      _id: 'new-user-id',
      email: 'name.surname@example.com'
    };

    User.prototype.save = jest.fn().mockImplementation(function () {
      // 'this' is the instance being saved
      expect(this.division).toBe('div-id-1');
      expect(this.section).toBe('sec-id-1');
      expect(this.divisionName).toBe('Division Name');
      expect(this.sectionName).toBe('Section Name');
      return Promise.resolve(fakeSavedUser);
    });

    await createUser(req, res);

    expect(res.statusCode).toBe(201);
    const data = res._getJSONData();
    expect(data.success).toBe(true);
    expect(User.prototype.save).toHaveBeenCalled();
  });
});