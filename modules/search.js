// modules/search.js

function initSearchRoutes(app, db) {
    app.get('/api/search', (req, res) => {
        const query = req.query.q;
        const searchType = req.query.type || 'all';

        if (!query) return res.json({ posts: [] });

        const { sql, params } = buildSearchQuery(query, searchType);

        db.query(sql, params, (err, rows) => {
            if (err) return res.status(500).json({ error: 'DB error' });

            const posts = (rows || []).map(p => ({
                id: p.id,
                username: p.username,
                content: p.content,
                created_at: p.created_at
            }));

            res.json({ posts });
        });
    });
}

function buildSearchQuery(query, searchType) {
    const searchTerm = `%${query}%`;
    let sql = `SELECT posts.*, users.username FROM posts JOIN users ON posts.user_id = users.id`;
    let params = [];

    if (searchType === 'username') {
        sql += ' WHERE users.username LIKE ?';
        params = [searchTerm];
    } else if (searchType === 'content') {
        sql += ' WHERE posts.content LIKE ?';
        params = [searchTerm];
    } else {
        sql += ' WHERE posts.content LIKE ? OR users.username LIKE ?';
        params = [searchTerm, searchTerm];
    }

    sql += ' ORDER BY posts.created_at DESC LIMIT 10';
    return { sql, params };
}

module.exports = { initSearchRoutes };
