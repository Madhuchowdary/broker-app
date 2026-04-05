const express = require("express");
const router = express.Router();
const db = require("../db");

router.post("/login", (req, res) => {
  try {
    const { userId, password } = req.body || {};

    if (!userId || !password) {
      return res.status(400).json({
        status: "ERROR",
        message: "User ID and password are required",
      });
    }

    const user = db.prepare(`
      SELECT id, user_id, password
      FROM app_users
      WHERE user_id = ? AND is_active = 1
    `).get(userId.trim());

    if (!user || user.password !== password.trim()) {
      return res.status(401).json({
        status: "ERROR",
        message: "Invalid credentials",
      });
    }

    return res.json({
      status: "SUCCESS",
      message: "Login successful",
      user: {
        id: user.id,
        userId: user.user_id,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({
      status: "ERROR",
      message: "Login failed",
    });
  }
});

router.put("/update-user", (req, res) => {
  try {
    const { oldUserId, newUserId, newPassword } = req.body || {};

    if (!oldUserId || !newUserId || !newPassword) {
      return res.status(400).json({
        status: "ERROR",
        message: "oldUserId, newUserId and newPassword are required",
      });
    }

    const result = db.prepare(`
      UPDATE app_users
      SET user_id = ?, password = ?
      WHERE user_id = ? AND is_active = 1
    `).run(newUserId.trim(), newPassword.trim(), oldUserId.trim());

    if (result.changes === 0) {
      return res.status(404).json({
        status: "ERROR",
        message: "User not found",
      });
    }

    return res.json({
      status: "SUCCESS",
      message: "Credentials updated successfully",
    });
  } catch (error) {
    console.error("Update user error:", error);
    return res.status(500).json({
      status: "ERROR",
      message: "Failed to update credentials",
    });
  }
});

module.exports = router;