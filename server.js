// server.js
const express = require("express");
const session = require("express-session");
const bodyParser = require("body-parser");
const mysql = require("mysql2");
const bcrypt = require("bcrypt");
const path = require("path");
const multer = require("multer");

const app = express();
const PORT = 3001;

// 配置 MySQL
const db = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "root", // TODO: 修root改为你的真实密码
  database: "ntunest"
});

db.connect(err => {
  if (err) throw err;
  console.log("✅ MySQL connected");
});

// 中间件
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
  secret: "ntunest-secret",
  resave: false,
  saveUninitialized: true
}));

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.static("public"));

// 配置 multer 上传目录
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, "public", "uploads"));
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage: storage });

// ========== 登录注册 ==========
app.get("/", (req, res) => {
  if (req.session.user) return res.redirect("/home");
  res.render("login");
});

app.get("/register", (req, res) => {
  res.render("register");
});

app.post("/login", (req, res) => {
  const { username, password } = req.body;
  const sql = "SELECT * FROM users WHERE username = ?";
  db.query(sql, [username], async (err, result) => {
    if (err) throw err;
    if (result.length === 0) return res.send("❌ 用户不存在");
    const user = result[0];
    const match = await bcrypt.compare(password, user.password);
    if (match) {
      req.session.user = user;
      res.redirect("/home");
    } else {
      res.send("❌ 密码错误");
    }
  });
});

app.post("/register", async (req, res) => {
  const { username, password } = req.body;
  const hashed = await bcrypt.hash(password, 10);
  const sql = "INSERT INTO users (username, password) VALUES (?, ?)";
  db.query(sql, [username, hashed], (err) => {
    if (err) {
      console.error(err);
      return res.send("❌ 注册失败");
    }
    res.redirect("/");
  });
});

// ========== 主页 ==========
app.get("/home", (req, res) => {
  if (!req.session.user) return res.redirect("/");
  
  // 获取帖子和话题
  db.query(
    "SELECT posts.*, users.username, topics.display_name as topic_name FROM posts JOIN users ON posts.user_id=users.id JOIN topics ON posts.topic_id=topics.id ORDER BY posts.created_at DESC LIMIT 20",
    (err, posts) => {
      if (err) throw err;
      
      // 获取所有话题供发帖选择
      db.query("SELECT * FROM topics", (err, topics) => {
        if (err) throw err;
        res.render("home", { 
          user: req.session.user, 
          posts: posts || [], 
          topics: topics || [] 
        });
      });
    }
  );
});

// ========== 话题列表页 ==========
app.get("/topics", (req, res) => {
  if (!req.session.user) return res.redirect("/");
  db.query("SELECT * FROM topics", (err, topics) => {
    if (err) throw err;
    res.render("topics", { user: req.session.user, topics: topics || [] });
  });
});

// 从主页发帖接口
app.post("/home/post", upload.single("media"), (req, res) => {
  console.log("=== 发帖请求开始 ===");
  console.log("用户会话:", req.session.user);
  console.log("请求体:", req.body);
  console.log("上传文件:", req.file);
  
  if (!req.session.user) {
    console.log("用户未登录，重定向到首页");
    return res.redirect("/");
  }
  
  const { content, topic_id } = req.body;
  const mediaPath = req.file ? "/uploads/" + req.file.filename : null;
  
  console.log("解析后的数据:");
  console.log("- 内容:", content);
  console.log("- 话题ID:", topic_id);
  console.log("- 媒体路径:", mediaPath);
  console.log("- 用户ID:", req.session.user.id);

  if (!content || !topic_id) {
    console.log("数据不完整，返回错误");
    return res.send("❌ 请填写完整信息");
  }

  console.log("开始执行数据库插入...");
  db.query(
    "INSERT INTO posts (user_id, topic_id, content, media_path) VALUES (?, ?, ?, ?)",
    [req.session.user.id, topic_id, content, mediaPath],
    (err, result) => {
      if (err) {
        console.error("数据库插入错误:", err);
        return res.send("❌ 发帖失败: " + err.message);
      }
      console.log("数据库插入成功，插入ID:", result.insertId);
      console.log("=== 发帖请求结束 ===");
      res.redirect("/home");
    }
  );
});

// ========== 话题页 ==========
app.get("/topic/:name", (req, res) => {
  if (!req.session.user) return res.redirect("/");
  const topicName = req.params.name;
  db.query("SELECT * FROM topics WHERE name=?", [topicName], (err, rows) => {
    if (err) throw err;
    if (rows.length === 0) return res.send("❌ 话题不存在");
    const topic = rows[0];
    db.query(
      "SELECT posts.*, users.username FROM posts JOIN users ON posts.user_id=users.id WHERE topic_id=? ORDER BY created_at DESC",
      [topic.id],
      (err, posts) => {
        if (err) throw err;
        res.render("topic", { user: req.session.user, topic, posts });
      }
    );
  });
});

// 发帖接口（支持文件上传）
app.post("/topic/:name/post", upload.single("media"), (req, res) => {
  if (!req.session.user) return res.redirect("/");
  const topicName = req.params.name;
  const { content } = req.body;
  const mediaPath = req.file ? "/uploads/" + req.file.filename : null;

  db.query("SELECT * FROM topics WHERE name=?", [topicName], (err, rows) => {
    if (err) throw err;
    if (rows.length === 0) return res.send("❌ 话题不存在");
    const topic = rows[0];
    db.query(
      "INSERT INTO posts (user_id, topic_id, content, media_path) VALUES (?, ?, ?, ?)",
      [req.session.user.id, topic.id, content, mediaPath],
      (err) => {
        if (err) {
          console.error(err);
          return res.send("❌ 发帖失败");
        }
        res.redirect("/topic/" + topicName);
      }
    );
  });
});

// 退出
app.get("/logout", (req, res) => {
  req.session.destroy();
  res.redirect("/");
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
