// import environment variables from .env file
require('dotenv').config();
// server.js
const express = require("express");
const session = require("express-session");
const bodyParser = require("body-parser");
const mysql = require("mysql2");
const bcrypt = require("bcrypt");
const path = require("path");
const multer = require("multer");
// 引入模块
const { initMetaMaskRoutes } = require('./modules/metamask');
const { initSearchRoutes } = require('./modules/search');

const app = express();
const PORT = 3001;
// 启动时自动创建 uploads 目录
const fs = require('fs');
const uploadsDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, {recursive: true});
    console.log('✔ 自动创建 uploads 目录');
}


// 配置 MySQL
const db = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
});

db.connect(err => {
    if (err) {
        console.error("❌ MySQL connection failed:", err.message);
        console.log("💡 请先运行: node setup-database.js");
        process.exit(1);
    }
    console.log("✅ MySQL connected");
});


// 中间件
app.use(bodyParser.urlencoded({extended: true}));
app.use(session({
    secret: process.env.SESSION_SECRET,
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
const upload = multer({storage: storage});

// ===== 初始化模块路由 =====
initMetaMaskRoutes(app, db, express);
initSearchRoutes(app, db);

// ===== Drafts APIs =====
// 获取当前用户草稿列表
app.get('/api/drafts', (req, res) => {
    if (!req.session.user) return res.status(401).json({error: 'Login required'});
    db.query('SELECT id, content, media_paths, created_at, updated_at FROM drafts WHERE user_id = ? ORDER BY updated_at DESC', [req.session.user.id], (err, rows) => {
        if (err) return res.status(500).json({error: 'DB error'});
        res.json({
            drafts: (rows || []).map(r => ({
                id: r.id, content: r.content || '', files: r.media_paths ? (() => {
                    try {
                        return JSON.parse(r.media_paths);
                    } catch (e) {
                        return [];
                    }
                })() : [], created_at: r.created_at, updated_at: r.updated_at
            }))
        });
    });
});

// 新建或更新草稿（若传 draft_id 则更新）— 接收多图
app.post('/api/drafts', upload.array('files'), (req, res) => {
    if (!req.session.user) return res.status(401).json({error: 'Login required'});
    const userId = req.session.user.id;
    const draftId = req.body.draft_id ? parseInt(req.body.draft_id, 10) : null;
    const content = req.body.content || '';
    // 已保留的服务器文件（前端传 JSON 字符串 kept_files）
    let kept = [];
    if (req.body.kept_files) {
        try {
            kept = JSON.parse(req.body.kept_files);
        } catch (e) {
            kept = [];
        }
    }
    const newFiles = (req.files || []).map(f => '/uploads/' + f.filename);
    const all = kept.concat(newFiles);
    const mediaPathsJson = all.length ? JSON.stringify(all) : null;
    if (draftId) {
        db.query('UPDATE drafts SET content = ?, media_paths = ? WHERE id = ? AND user_id = ?', [content, mediaPathsJson, draftId, userId], (err) => {
            if (err) return res.status(500).json({error: 'Update failed'});
            res.json({success: true, id: draftId, files: all});
        });
    } else {
        db.query('INSERT INTO drafts (user_id, content, media_paths) VALUES (?, ?, ?)', [userId, content, mediaPathsJson], (err, insertRes) => {
            if (err) return res.status(500).json({error: 'Insert failed'});
            res.json({success: true, id: insertRes.insertId, files: all});
        });
    }
});

// 删除草稿
app.delete('/api/drafts/:id', (req, res) => {
    if (!req.session.user) return res.status(401).json({error: 'Login required'});
    const id = parseInt(req.params.id, 10);
    db.query('DELETE FROM drafts WHERE id = ? AND user_id = ?', [id, req.session.user.id], (err, result) => {
        if (err) return res.status(500).json({error: 'Delete failed'});
        if (result.affectedRows === 0) return res.status(404).json({error: 'Not found'});
        res.json({success: true});
    });
});

// 发布草稿 -> posts 表
app.post('/api/drafts/:id/publish', (req, res) => {
    if (!req.session.user) return res.status(401).json({error: 'Login required'});
    const id = parseInt(req.params.id, 10);
    db.query('SELECT * FROM drafts WHERE id = ? AND user_id = ?', [id, req.session.user.id], (err, rows) => {
        if (err) return res.status(500).json({error: 'DB error'});
        if (!rows || rows.length === 0) return res.status(404).json({error: 'Draft not found'});
        const draft = rows[0];
        // 默认发布到 chat 话题（或第一个）
        db.query('SELECT id FROM topics WHERE name = ? LIMIT 1', ['chat'], (tErr, tRows) => {
            if (tErr) return res.status(500).json({error: 'DB error'});
            const next = (topicId) => {
                db.query('INSERT INTO posts (user_id, topic_id, content, media_paths) VALUES (?, ?, ?, ?)', [req.session.user.id, topicId, draft.content || '', draft.media_paths], (iErr, insertRes) => {
                    if (iErr) return res.status(500).json({error: 'Publish failed'});
                    // 删除草稿
                    db.query('DELETE FROM drafts WHERE id = ?', [id], () => {
                    });
                    res.json({success: true, post_id: insertRes.insertId});
                });
            };
            if (tRows && tRows.length > 0) return next(tRows[0].id);
            db.query('SELECT id FROM topics LIMIT 1', (ttErr, ttRows) => {
                if (ttErr || !ttRows || !ttRows.length) return res.status(500).json({error: 'No topic'});
                next(ttRows[0].id);
            });
        });
    });
});

// ========== 登录注册 ==========
app.get("/", (req, res) => {
    if (req.session.user) return res.redirect("/home");
    res.render("login");
});

app.get("/register", (req, res) => {
    res.render("register");
});

app.post("/login", (req, res) => {
    const {username, password} = req.body;
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
    const {username, password} = req.body;
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

// ========== Posts API (list + create with multiple files) ==========
app.get('/api/posts', (req, res) => {
    const topic = req.query.topic || null;
    const params = [];
    let sql = `SELECT posts.*,
                      users.username,
                      (SELECT COUNT(*) FROM likes WHERE likes.post_id = posts.id)       AS likes_count,
                      (SELECT COUNT(*) FROM comments WHERE comments.post_id = posts.id) AS comments_count,
                      (SELECT COUNT(*) FROM shares WHERE shares.post_id = posts.id)     AS shares_count
               FROM posts
                        JOIN users ON posts.user_id = users.id`;
    if (topic) {
        sql += ' WHERE posts.topic_id = (SELECT id FROM topics WHERE name = ? LIMIT 1)';
        params.push(topic);
    }
    sql += ' ORDER BY posts.created_at DESC LIMIT 100';
    db.query(sql, params, (err, rows) => {
        if (err) return res.status(500).json({error: 'DB error'});
        const mapped = (rows || []).map(p => ({
            id: p.id,
            user: {id: p.user_id, name: p.username},
            content: p.content,
            files: p.media_paths ? (() => {
                try {
                    return JSON.parse(p.media_paths);
                } catch (e) {
                    return p.media_path ? [p.media_path] : [];
                }
            })() : (p.media_path ? [p.media_path] : []),
            createdAt: p.created_at,
            likes: p.likes_count || 0,
            comments: p.comments_count || 0,
            shares: p.shares_count || 0
        }));
        res.json({posts: mapped});
    });
});

app.post('/api/posts', upload.array('files'), (req, res) => {
    if (!req.session.user) return res.status(401).json({error: 'Login required'});
    const content = req.body.content || '';
    const files = (req.files || []).map(f => '/uploads/' + f.filename);
    const mediaPathsJson = files.length ? JSON.stringify(files) : null;
    const topicName = req.body.topic || 'chat';
    db.query('SELECT id FROM topics WHERE name = ? LIMIT 1', [topicName], (err, rows) => {
        if (err) return res.status(500).json({error: 'DB error'});
        const topicId = (rows && rows[0]) ? rows[0].id : 1;
        db.query('INSERT INTO posts (user_id, topic_id, content, media_paths) VALUES (?, ?, ?, ?)', [req.session.user.id, topicId, content, mediaPathsJson], (iErr, insertRes) => {
            if (iErr) return res.status(500).json({error: 'Insert failed'});
            return res.json({success: true, id: insertRes.insertId, files});
        });
    });
});

// Get user's own posts API
app.get('/api/user/posts', (req, res) => {
    if (!req.session.user) return res.status(401).json({error: 'Login required'});
    const userId = req.session.user.id;
    
    const sql = `SELECT posts.*,
                        topics.display_name AS topic_name,
                        (SELECT COUNT(*) FROM likes WHERE likes.post_id = posts.id) AS likes_count,
                        (SELECT COUNT(*) FROM comments WHERE comments.post_id = posts.id) AS comments_count,
                        (SELECT COUNT(*) FROM shares WHERE shares.post_id = posts.id) AS shares_count
                 FROM posts
                 LEFT JOIN topics ON posts.topic_id = topics.id
                 WHERE posts.user_id = ?
                 ORDER BY posts.created_at DESC
                 LIMIT 50`;
    
    db.query(sql, [userId], (err, rows) => {
        if (err) return res.status(500).json({error: 'DB error'});
        
        const posts = (rows || []).map(p => ({
            id: p.id,
            content: p.content,
            files: p.media_paths ? (() => {
                try {
                    return JSON.parse(p.media_paths);
                } catch (e) {
                    return p.media_path ? [p.media_path] : [];
                }
            })() : (p.media_path ? [p.media_path] : []),
            createdAt: p.created_at,
            topic_name: p.topic_name,
            likes: p.likes_count || 0,
            comments: p.comments_count || 0,
            shares: p.shares_count || 0
        }));
        
        res.json({posts});
    });
});

// Delete post API
app.delete('/api/posts/:id', (req, res) => {
    if (!req.session.user) return res.status(401).json({error: 'Login required'});
    const postId = parseInt(req.params.id, 10);
    const userId = req.session.user.id;
    
    // First check if the post exists and belongs to the current user
    db.query('SELECT user_id FROM posts WHERE id = ?', [postId], (err, rows) => {
        if (err) return res.status(500).json({error: 'DB error'});
        if (!rows || rows.length === 0) return res.status(404).json({error: 'Post not found'});
        
        const post = rows[0];
        if (post.user_id !== userId) return res.status(403).json({error: 'Not authorized to delete this post'});
        
        // Delete related data first (comments, likes, shares)
        db.query('DELETE FROM comments WHERE post_id = ?', [postId], (cErr) => {
            if (cErr) console.error('Error deleting comments:', cErr);
            
            db.query('DELETE FROM likes WHERE post_id = ?', [postId], (lErr) => {
                if (lErr) console.error('Error deleting likes:', lErr);
                
                db.query('DELETE FROM shares WHERE post_id = ?', [postId], (sErr) => {
                    if (sErr) console.error('Error deleting shares:', sErr);
                    
                    // Finally delete the post
                    db.query('DELETE FROM posts WHERE id = ?', [postId], (pErr, result) => {
                        if (pErr) return res.status(500).json({error: 'Failed to delete post'});
                        if (result.affectedRows === 0) return res.status(404).json({error: 'Post not found'});
                        
                        res.json({success: true, message: 'Post deleted successfully'});
                    });
                });
            });
        });
    });
});





// ========== Social Interaction APIs ==========
// like/unlike toggle
app.post('/api/posts/:id/like', (req, res) => {
    if (!req.session.user) return res.status(401).json({error: 'Login required'});
    const postId = parseInt(req.params.id, 10);
    const userId = req.session.user.id;
    db.query('SELECT id FROM likes WHERE user_id = ? AND post_id = ?', [userId, postId], (err, rows) => {
        if (err) return res.status(500).json({error: 'DB error'});
        if (rows && rows.length > 0) {
            db.query('DELETE FROM likes WHERE id=?', [rows[0].id], dErr => {
                if (dErr) return res.status(500).json({error: 'Delete failed'});
                db.query('SELECT COUNT(*) AS cnt FROM likes WHERE post_id=?', [postId], (cErr, cRes) => {
                    if (cErr) return res.json({likes: 0});
                    res.json({likes: cRes[0].cnt, liked: false});
                });
            });
        } else {
            db.query('INSERT INTO likes (user_id, post_id) VALUES (?, ?)', [userId, postId], iErr => {
                if (iErr) return res.status(500).json({error: 'Insert failed'});
                db.query('SELECT COUNT(*) AS cnt FROM likes WHERE post_id=?', [postId], (cErr, cRes) => {
                    if (cErr) return res.json({likes: 1});
                    res.json({likes: cRes[0].cnt, liked: true});
                });
            });
        }
    });
});

// comment
app.post('/api/posts/:id/comment', express.json(), (req, res) => {
    if (!req.session.user) return res.status(401).json({error: 'Login required'});
    const postId = parseInt(req.params.id, 10), userId = req.session.user.id;
    const content = (req.body.content || '').trim();
    if (!content) return res.status(400).json({error: 'Empty comment'});
    db.query('INSERT INTO comments (user_id, post_id, content) VALUES (?, ?, ?)', [userId, postId, content], (iErr, insertRes) => {
        if (iErr) return res.status(500).json({error: 'Insert failed'});
        db.query('SELECT comments.*, users.username FROM comments JOIN users ON comments.user_id=users.id WHERE comments.id = ?', [insertRes.insertId], (qErr, rows) => {
            if (qErr) return res.status(500).json({error: 'DB error'});
            db.query('SELECT COUNT(*) AS cnt FROM comments WHERE post_id = ?', [postId], (cErr, cRes) => {
                if (cErr) return res.json({comment: rows[0], comments: 1});
                res.json({comment: rows[0], comments: cRes[0].cnt});
            });
        });
    });
});

// share (repost)
app.post('/api/posts/:id/share', (req, res) => {
    if (!req.session.user) return res.status(401).json({error: 'Login required'});
    const postId = parseInt(req.params.id, 10), userId = req.session.user.id;
    db.query('INSERT INTO shares (user_id, post_id) VALUES (?, ?)', [userId, postId], (sErr) => {
        if (sErr) return res.status(500).json({error: 'Share failed'});
        db.query('SELECT * FROM posts WHERE id=?', [postId], (qErr, rows) => {
            if (qErr || !rows || rows.length === 0) return res.status(500).json({error: 'Original not found'});
            const original = rows[0];
            const repostContent = `Repost: ${original.content}`;
            db.query('INSERT INTO posts (user_id, topic_id, content, media_path) VALUES (?, ?, ?, ?)', [userId, original.topic_id, repostContent, original.media_path], (iErr) => {
                if (iErr) return res.status(500).json({error: 'Repost failed'});
                db.query('SELECT COUNT(*) AS cnt FROM shares WHERE post_id=?', [postId], (cErr, cRes) => {
                    if (cErr) return res.json({shares: 1});
                    res.json({shares: cRes[0].cnt});
                });
            });
        });
    });
});

// ========== 主页 ==========
app.get("/home", (req, res) => {
    if (!req.session.user) return res.redirect("/");
    // 获取所有话题
    db.query('SELECT * FROM topics', (tErr, topics) => {
        if (tErr) return res.status(500).send('数据库错误');
        const sql = `SELECT posts.*,
                            users.username,
                            topics.display_name                                               AS topic_name,
                            (SELECT COUNT(*) FROM likes WHERE likes.post_id = posts.id)       AS likes_count,
                            (SELECT COUNT(*) FROM comments WHERE comments.post_id = posts.id) AS comments_count,
                            (SELECT COUNT(*) FROM shares WHERE shares.post_id = posts.id)     AS shares_count
                     FROM posts
                              JOIN users ON posts.user_id = users.id
                              JOIN topics ON posts.topic_id = topics.id
                     ORDER BY posts.created_at DESC LIMIT 50`;
        db.query(sql, (pErr, posts) => {
            if (pErr) return res.status(500).send('数据库错误');
            const postIds = (posts || []).map(p => p.id);
            const finish = (commentsByPost) => {
                const mapped = (posts || []).map(p => ({
                    id: p.id,
                    user_id: p.user_id,
                    username: p.username,
                    topic_name: p.topic_name,
                    content: p.content,
                    files: p.media_paths ? (() => {
                        try {
                            return JSON.parse(p.media_paths);
                        } catch (e) {
                            return p.media_path ? [p.media_path] : [];
                        }
                    })() : (p.media_path ? [p.media_path] : []),
                    created_at: p.created_at,
                    likes: p.likes_count || 0,
                    comments: p.comments_count || 0,
                    shares: p.shares_count || 0,
                    comments_list: (commentsByPost[p.id] || [])
                }));
                res.render('home', {user: req.session.user, topics: topics || [], posts: mapped});
            };
            if (postIds.length === 0) return finish({});
            db.query(`SELECT comments.*, users.username
                      FROM comments
                               JOIN users ON comments.user_id = users.id
                      WHERE comments.post_id IN (${postIds.map(() => '?').join(',')})
                      ORDER BY comments.created_at ASC`, postIds, (cErr, cRows) => {
                if (cErr) return finish({});
                const commentsByPost = {};
                (cRows || []).forEach(c => {
                    (commentsByPost[c.post_id] = commentsByPost[c.post_id] || []).push({
                        id: c.id,
                        user_id: c.user_id,
                        username: c.username,
                        content: c.content,
                        created_at: c.created_at
                    });
                });
                finish(commentsByPost);
            });
        });
    });
});

// ========== 话题列表页 ==========
app.get("/topics", (req, res) => {
    if (!req.session.user) return res.redirect("/");
    db.query("SELECT * FROM topics", (err, topics) => {
        if (err) throw err;
        res.render("topics", {user: req.session.user, topics: topics || []});
    });
});

// 从主页发帖接口 (多图支持: 字段名 files)
app.post("/home/post", upload.array("files"), (req, res) => {
    if (!req.session.user) return res.redirect("/");
    const {content, topic_id} = req.body;
    const files = (req.files || []).map(f => '/uploads/' + f.filename);
    // 只要内容或图片有其一即可
    if ((!content || !content.trim()) && (!files || files.length === 0)) {
        return res.send("❌ 请填写内容或至少上传一张图片");
    }
    if (!topic_id) return res.send("❌ 请选择话题");
    const mediaPathsJson = files.length ? JSON.stringify(files) : null;
    db.query(
        "INSERT INTO posts (user_id, topic_id, content, media_paths) VALUES (?, ?, ?, ?)",
        [req.session.user.id, topic_id, content, mediaPathsJson],
        (err) => {
            if (err) {
                console.error(err);
                return res.send("❌ 发帖失败");
            }
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
                res.render("topic", {user: req.session.user, topic, posts});
            }
        );
    });
});

// 话题内发帖 (多图)
app.post("/topic/:name/post", upload.array("files"), (req, res) => {
    if (!req.session.user) return res.redirect("/");
    const topicName = req.params.name;
    const {content} = req.body;
    const files = (req.files || []).map(f => '/uploads/' + f.filename);
    const mediaPathsJson = files.length ? JSON.stringify(files) : null;
    db.query("SELECT * FROM topics WHERE name= ?", [topicName], (err, rows) => {
        if (err) throw err;
        if (rows.length === 0) return res.send("❌ 话题不存在");
        const topic = rows[0];
        db.query(
            "INSERT INTO posts (user_id, topic_id, content, media_paths) VALUES (?, ?, ?, ?)",
            [req.session.user.id, topic.id, content, mediaPathsJson],
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

// ========== 私信功能 ==========
app.get("/messages", (req, res) => {
    if (!req.session.user) return res.redirect("/");
    res.render("messages", {user: req.session.user});
});

// 获取对话列表
app.get('/api/messages/conversations', (req, res) => {
    if (!req.session.user) return res.status(401).json({error: 'Login required'});
    const userId = req.session.user.id;
    
    // 先获取所有对话的用户ID
    const conversationsQuery = `
        SELECT DISTINCT
            CASE 
                WHEN m.sender_id = ? THEN m.receiver_id 
                ELSE m.sender_id 
            END as user_id
        FROM messages m
        WHERE m.sender_id = ? OR m.receiver_id = ?
    `;
    
    console.log('Loading conversations for user:', userId);
    
    db.query(conversationsQuery, [userId, userId, userId], (err, conversationRows) => {
        if (err) {
            console.error('Database error in conversations query:', err);
            return res.status(500).json({error: 'DB error'});
        }
        
        if (!conversationRows || conversationRows.length === 0) {
            return res.json({conversations: []});
        }
        
        // 为每个对话获取详细信息
        const conversations = [];
        let completed = 0;
        
        conversationRows.forEach(conv => {
            const detailQuery = `
                SELECT 
                    u.id as user_id,
                    u.username,
                    u.avatar,
                    (SELECT content FROM messages 
                     WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)
                     ORDER BY created_at DESC LIMIT 1) as last_message,
                    (SELECT created_at FROM messages 
                     WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)
                     ORDER BY created_at DESC LIMIT 1) as last_message_time,
                    (SELECT COUNT(*) FROM messages 
                     WHERE receiver_id = ? AND sender_id = ? AND is_read = FALSE) as unread_count
                FROM users u
                WHERE u.id = ?
            `;
            
            db.query(detailQuery, [userId, conv.user_id, conv.user_id, userId, userId, conv.user_id, conv.user_id, userId, userId, conv.user_id, conv.user_id], (detailErr, detailRows) => {
                completed++;
                
                if (!detailErr && detailRows && detailRows.length > 0) {
                    conversations.push(detailRows[0]);
                }
                
                if (completed === conversationRows.length) {
                    // 按最后消息时间排序
                    conversations.sort((a, b) => new Date(b.last_message_time) - new Date(a.last_message_time));
                    console.log('Conversations result:', conversations);
                    res.json({conversations: conversations});
                }
            });
        });
    });
});

// 获取与特定用户的对话消息
app.get('/api/messages/conversation/:userId', (req, res) => {
    if (!req.session.user) return res.status(401).json({error: 'Login required'});
    const currentUserId = req.session.user.id;
    const otherUserId = parseInt(req.params.userId, 10);
    
    const sql = `
        SELECT m.*, 
               CASE WHEN m.sender_id = ? THEN TRUE ELSE FALSE END as is_sender
        FROM messages m
        WHERE (m.sender_id = ? AND m.receiver_id = ?) 
           OR (m.sender_id = ? AND m.receiver_id = ?)
        ORDER BY m.created_at ASC
    `;
    
    console.log('Loading messages between users:', currentUserId, 'and', otherUserId);
    console.log('SQL query:', sql);
    console.log('SQL params:', [currentUserId, currentUserId, otherUserId, otherUserId, currentUserId]);
    
    db.query(sql, [currentUserId, currentUserId, otherUserId, otherUserId, currentUserId], (err, rows) => {
        if (err) {
            console.error('Database error in messages query:', err);
            return res.status(500).json({error: 'DB error'});
        }
        
        console.log('Messages query result:', rows);
        
        // 标记消息为已读
        db.query('UPDATE messages SET is_read = TRUE WHERE sender_id = ? AND receiver_id = ? AND is_read = FALSE', 
                [otherUserId, currentUserId], (updateErr) => {
            if (updateErr) console.error('Error marking messages as read:', updateErr);
        });
        
        res.json({messages: rows || []});
    });
});

// 发送消息（通过用户ID）
app.post('/api/messages/send', express.json(), (req, res) => {
    if (!req.session.user) return res.status(401).json({error: 'Login required'});
    const senderId = req.session.user.id;
    const {receiver_id, content} = req.body;
    
    if (!receiver_id || !content || !content.trim()) {
        return res.status(400).json({error: 'Receiver ID and content are required'});
    }
    
    // 检查接收者是否存在
    db.query('SELECT id FROM users WHERE id = ?', [receiver_id], (err, rows) => {
        if (err) return res.status(500).json({error: 'DB error'});
        if (!rows || rows.length === 0) return res.status(404).json({error: 'Receiver not found'});
        
        // 插入消息
        db.query('INSERT INTO messages (sender_id, receiver_id, content) VALUES (?, ?, ?)', 
                [senderId, receiver_id, content.trim()], (insertErr, result) => {
            if (insertErr) return res.status(500).json({error: 'Failed to send message'});
            res.json({success: true, message_id: result.insertId});
        });
    });
});

// 发送消息（通过用户名）
app.post('/api/messages/send-to-username', express.json(), (req, res) => {
    if (!req.session.user) return res.status(401).json({error: 'Login required'});
    const senderId = req.session.user.id;
    const {username, content} = req.body;
    
    if (!username || !content || !content.trim()) {
        return res.status(400).json({error: 'Username and content are required'});
    }
    
    // 查找接收者
    db.query('SELECT id FROM users WHERE username = ?', [username], (err, rows) => {
        if (err) return res.status(500).json({error: 'DB error'});
        if (!rows || rows.length === 0) return res.status(404).json({error: 'User not found'});
        
        const receiverId = rows[0].id;
        
        if (receiverId === senderId) {
            return res.status(400).json({error: 'Cannot send message to yourself'});
        }
        
        // 插入消息
        db.query('INSERT INTO messages (sender_id, receiver_id, content) VALUES (?, ?, ?)', 
                [senderId, receiverId, content.trim()], (insertErr, result) => {
            if (insertErr) return res.status(500).json({error: 'Failed to send message'});
            res.json({success: true, message_id: result.insertId});
        });
    });
});

// ========== 用户资料 ==========
app.get('/profile', (req, res) => {
    if (!req.session.user) return res.redirect('/');
    const id = req.session.user.id;
    db.query('SELECT id, username, display_name, avatar, bio, created_at FROM users WHERE id = ?', [id], (err, rows) => {
        if (err) return res.status(500).send('DB error');
        if (!rows || rows.length === 0) return res.status(404).send('User not found');
        res.render('profile', {user: req.session.user, profile: rows[0]});
    });
});

app.get('/profile/:id', (req, res) => {
    const id = parseInt(req.params.id, 10);
    db.query('SELECT id, username, display_name, avatar, bio, created_at FROM users WHERE id = ?', [id], (err, rows) => {
        if (err) return res.status(500).send('DB error');
        if (!rows || rows.length === 0) return res.status(404).send('User not found');
        res.render('profile', {user: req.session.user || null, profile: rows[0]});
    });
});

app.post('/profile', upload.single('avatar'), (req, res) => {
    if (!req.session.user) return res.redirect('/');
    const id = req.session.user.id;
    const {username, display_name, bio} = req.body;
    const avatarPath = req.file ? '/uploads/' + req.file.filename : null;
    const updates = [];
    const params = [];
    if (username) {
        updates.push('username = ?');
        params.push(username);
    }
    if (display_name) {
        updates.push('display_name = ?');
        params.push(display_name);
    }
    if (bio) {
        updates.push('bio = ?');
        params.push(bio);
    }
    if (avatarPath) {
        updates.push('avatar = ?');
        params.push(avatarPath);
    }
    if (updates.length === 0) return res.redirect('/profile');
    params.push(id);
    db.query('UPDATE users SET ' + updates.join(', ') + ' WHERE id = ?', params, (err) => {
        if (err) {
            console.error('profile update error', err);
            return res.status(500).send('Update failed');
        }
        db.query('SELECT id, username, display_name, avatar FROM users WHERE id=?', [id], (qErr, rows) => {
            if (!qErr && rows && rows[0]) req.session.user = Object.assign(req.session.user, rows[0]);
            res.redirect('/profile');
        });
    });
});

app.post('/profile/change-password', (req, res) => {
    if (!req.session.user) return res.redirect('/');
    const id = req.session.user.id;
    const {old_password, new_password, confirm_password} = req.body;
    if (!new_password || new_password.length < 6) return res.send('❌ 新密码长度至少6位');
    if (new_password !== confirm_password) return res.send('❌ 两次密码不一致');
    db.query('SELECT password FROM users WHERE id=?', [id], async (err, rows) => {
        if (err) return res.status(500).send('DB error');
        if (!rows || rows.length === 0) return res.status(404).send('User not found');
        const currentHash = rows[0].password;
        try {
            if (currentHash) { // 已存在密码则校验旧密码
                if (!old_password) return res.send('❌ 请输入原密码');
                const match = await bcrypt.compare(old_password, currentHash);
                if (!match) return res.send('❌ 原密码错误');
            }
            const newHash = await bcrypt.hash(new_password, 10);
            db.query('UPDATE users SET password=? WHERE id=?', [newHash, id], (uErr) => {
                if (uErr) return res.status(500).send('❌ 修改失败');
                req.session.destroy(() => {
                    res.setHeader('Content-Type', 'text/html; charset=utf-8');
                    res.render("refresh");
                });
            });
        } catch (e) {
            console.error(e);
            return res.status(500).send('❌ 内部错误');
        }
    });
});

app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});
