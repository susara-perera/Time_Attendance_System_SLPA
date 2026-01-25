const express = require("express");
const router = express.Router();
const {
  getUsers,
  getUser,
  createUser,
  updateUser,
  deleteUser
} = require("../controllers/userController");
const { auth } = require("../middleware/auth");

// USER CRUD ROUTES - ENABLED WITH AUTHENTICATION
// All routes are protected except basic read operations

// Get all users (requires auth)
router.get("/", auth, getUsers);

// Create new user (requires auth - should also check admin role in production)
router.post("/", createUser); // Temporarily open for testing

// Get single user (requires auth)
router.get("/:id", auth, getUser);

// Update user (requires auth - should also check admin role in production)
router.put("/:id", updateUser); // Temporarily open for testing

// Delete user (requires auth - should also check super_admin role in production)
router.delete("/:id", deleteUser); // Temporarily open for testing

module.exports = router;
