// modules/metamask.js
const crypto = require('crypto');
const { verifyMessage } = require('ethers');

// Store temporary nonces
const metamaskNonces = {};

/**
 * Initialize MetaMask routes
 * @param {Object} app - Express application instance
 * @param {Object} db - Database connection instance
 * @param {Object} express - Express module
 */
function initMetaMaskRoutes(app, db, express) {
    // Get nonce endpoint
    app.get('/api/metamask-nonce', (req, res) => {
        const { address } = req.query;
        if (!address) return res.status(400).json({ error: 'Missing address' });

        const nonce = 'NTUNEST-' + crypto.randomBytes(8).toString('hex');
        metamaskNonces[address.toLowerCase()] = nonce;
        res.json({ nonce });
    });

    // MetaMask login endpoint
    app.post('/api/metamask-login', express.json(), (req, res) => {
        const { address, signature } = req.body;
        if (!address || !signature) return res.status(400).json({ error: 'Missing parameters' });

        const nonce = metamaskNonces[address.toLowerCase()];
        if (!nonce) return res.status(400).json({ error: 'Please get nonce first' });

        try {
            const recovered = verifyMessage(nonce, signature);
            if (!recovered || recovered.toLowerCase() !== address.toLowerCase()) {
                return res.status(401).json({ error: 'Invalid signature', recovered });
            }

            delete metamaskNonces[address.toLowerCase()];

            // Find or create user
            handleMetaMaskUser(req, res, db, address);
        } catch (e) {
            return res.status(400).json({ error: 'Signature verification failed' });
        }
    });
}

/**
 * Handle MetaMask user login/registration logic
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @param {Object} db - Database connection
 * @param {string} address - MetaMask address
 */
function handleMetaMaskUser(req, res, db, address) {
    const handleUserResults = (err, results) => {
        if (err) return res.status(500).json({ error: 'Database error', detail: err.message });

        if (!results || results.length === 0) {
            // Create new user
            createMetaMaskUser(req, res, db, address);
        } else {
            // User exists, login directly
            req.session.user = results[0];
            return res.json({ success: true });
        }
    };

    db.query('SELECT * FROM users WHERE metamask = ?', [address], (err, rows) => {
        if (err) {
            if (err.code === 'ER_BAD_FIELD_ERROR' || /Unknown column/.test(err.message)) {
                // metamask field doesn't exist, need to add it
                db.query('ALTER TABLE users ADD COLUMN metamask VARCHAR(255) NULL UNIQUE', (alterErr) => {
                    if (alterErr) return res.status(500).json({ error: 'Schema repair failed' });
                    db.query('SELECT * FROM users WHERE metamask = ?', [address], handleUserResults);
                });
                return;
            }
            return handleUserResults(err, rows);
        }
        handleUserResults(null, rows);
    });
}

/**
 * Create new MetaMask user
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @param {Object} db - Database connection
 * @param {string} address - MetaMask address
 */
function createMetaMaskUser(req, res, db, address) {
    const username = address.slice(2, 10);

    db.query('INSERT INTO users (username, metamask) VALUES (?, ?)', [username, address], (iErr, insertRes) => {
        if (iErr) {
            if (iErr.code === 'ER_DUP_ENTRY') {
                // Username or address already exists
                db.query('SELECT * FROM users WHERE metamask = ? OR username=?', [address, username], (qErr, qRows) => {
                    if (qErr || !qRows || !qRows.length) return res.status(500).json({ error: 'Registration failed' });
                    req.session.user = qRows[0];
                    return res.json({ success: true });
                });
                return;
            }

            // If password NOT NULL causes failure, try to modify
            if (iErr.code === 'ER_NO_DEFAULT_FOR_FIELD' || /doesn't have a default value/.test(iErr.message)) {
                db.query('ALTER TABLE users MODIFY password VARCHAR(255) NULL', (alterErr) => {
                    if (alterErr) return res.status(500).json({ error: 'Schema repair failed' });
                    db.query('INSERT INTO users (username, metamask) VALUES (?, ?)', [username, address], (i2, r2) => {
                        if (i2) return res.status(500).json({ error: 'Registration failed' });
                        req.session.user = { id: r2.insertId, username, metamask: address };
                        return res.json({ success: true });
                    });
                });
                return;
            }

            return res.status(500).json({ error: 'Registration failed', detail: iErr.message });
        }

        req.session.user = { id: insertRes.insertId, username, metamask: address };
        return res.json({ success: true });
    });
}

module.exports = {
    initMetaMaskRoutes
};
