// modules/search.js

// 中文注释：提供统一的搜索 API，支持搜索帖子与用户
function initSearchRoutes(app, db) {
    app.get('/api/search', (req, res) => {
        const q = (req.query.q || '').trim();
        const type = (req.query.type || 'all').toLowerCase(); // posts | users | all

        if (!q) return res.json({ posts: [], users: [] });

        const { sql: postSql, params: postParams } = buildSearchPostsQuery(q);
        const { sql: userSql, params: userParams } = buildSearchUsersQuery(q);

        if (type === 'posts') {
            return db.query(postSql, postParams, (err, rows=[]) => {
                if (err) return res.status(500).json({ error: 'DB error' });
                return res.json({ posts: mapPosts(rows) });
            });
        }
        if (type === 'users') {
            return db.query(userSql, userParams, (err, rows=[]) => {
                if (err) return res.status(500).json({ error: 'DB error' });
                return res.json({ users: mapUsers(rows) });
            });
        }
        // all: 并行查询（回调嵌套）
        db.query(postSql, postParams, (e1, r1=[]) => {
            if (e1) return res.status(500).json({ error: 'DB error' });
            db.query(userSql, userParams, (e2, r2=[]) => {
                if (e2) return res.status(500).json({ error: 'DB error' });
                return res.json({ posts: mapPosts(r1), users: mapUsers(r2) });
            });
        });
    });
}

function buildSearchPostsQuery(query) {
    const term = `%${query}%`;
    const sql = `
        SELECT p.id, p.content, p.created_at, u.username, t.display_name AS topic_name
        FROM posts p
        JOIN users u ON p.user_id = u.id
        JOIN topics t ON p.topic_id = t.id
        WHERE p.content LIKE ? OR u.username LIKE ?
        ORDER BY p.created_at DESC
        LIMIT 30`;
    return { sql, params: [term, term] };
}

function buildSearchUsersQuery(query) {
    const term = `%${query}%`;
    const sql = `
        SELECT id, username, display_name, avatar, bio, created_at
        FROM users
        WHERE username LIKE ? OR display_name LIKE ? OR bio LIKE ?
        ORDER BY created_at DESC
        LIMIT 30`;
    return { sql, params: [term, term, term] };
}

function mapPosts(rows) {
    return (rows || []).map(p => ({
        id: p.id,
        username: p.username,
        topic_name: p.topic_name,
        content: p.content,
        created_at: p.created_at
    }));
}

function mapUsers(rows) {
    return (rows || []).map(u => ({
        id: u.id,
        username: u.username,
        display_name: u.display_name,
        avatar: u.avatar,
        bio: u.bio,
        created_at: u.created_at
    }));
}

module.exports = { initSearchRoutes };
