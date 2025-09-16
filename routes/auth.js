// routes/auth.js
const express = require("express");
const bcrypt = require("bcrypt");
const db = require("../db");

const router = express.Router();

// 登录页
router.get("/", (req, res) => {
  if (req.session.user) return res.redirect("/home");
  res.render("login");
});

// 注册页
router.get("/register", (req, res) => {
  if (req.session.user) return res.redirect("/home");
  res.render("register");
});

// 登录提交
router.post("/login", (req, res) => {
  const { username, password } = req.body;
  const sql = "SELECT * FROM users WHERE username = ?";
  db.query(sql, [username], async (err, result) => {
    if (err) {
      console.error(err);
      return res.send("❌ 登录失败");
    }
    if (result.length === 0) return res.send("❌ 用户不存在");
    const user = result[0];
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.send("❌ 密码错误");
    req.session.user = user;
    res.redirect("/home");
  });
});

// 注册提交
router.post("/register", async (req, res) => {
  const { username, password } = req.body;
  try {
    const hashed = await bcrypt.hash(password, 10);
    const sql = "INSERT INTO users (username, password) VALUES (?, ?)";
    db.query(sql, [username, hashed], (err) => {
      if (err) {
        console.error(err);
        return res.send("❌ 注册失败");
      }
      res.redirect("/");
    });
  } catch (e) {
    console.error(e);
    res.send("❌ 注册失败");
  }
});

module.exports = router;

