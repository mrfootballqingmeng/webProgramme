const mysql = require('mysql2/promise');
require('dotenv').config();

async function createTestData() {
    let connection;
    
    try {
        console.log('正在连接数据库...');
        
        connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASS || '',
            database: process.env.DB_NAME || 'qzrdb',
            charset: 'utf8mb4'
        });
        
        console.log('数据库连接成功！');
        
        // 创建测试用户
        const testUsers = [
            { username: 'alice', password: '$2b$10$example1' },
            { username: 'bob', password: '$2b$10$example2' },
            { username: 'charlie', password: '$2b$10$example3' },
            { username: 'diana', password: '$2b$10$example4' }
        ];
        
        console.log('创建测试用户...');
        for (const user of testUsers) {
            try {
                await connection.query(
                    'INSERT IGNORE INTO users (username, password) VALUES (?, ?)',
                    [user.username, user.password]
                );
            } catch (err) {
                console.log(`用户 ${user.username} 可能已存在`);
            }
        }
        
        // 获取用户ID和话题ID
        const [users] = await connection.query('SELECT id, username FROM users');
        const [topics] = await connection.query('SELECT id, name FROM topics');
        
        console.log('创建测试帖子...');
        
        const testPosts = [
            {
                content: '有人想一起去图书馆学习吗？我在准备期末考试，需要一个安静的环境。',
                topic: 'study',
                username: 'alice'
            },
            {
                content: '出售二手MacBook Pro，9成新，价格面议。有意者私信联系！',
                topic: 'trade',
                username: 'bob'
            },
            {
                content: '今天在食堂吃到了超好吃的新菜品！推荐大家去试试西餐厅的意大利面。',
                topic: 'food',
                username: 'charlie'
            },
            {
                content: '明天晚上有篮球比赛，欢迎大家来观看！地点在体育馆。',
                topic: 'events',
                username: 'diana'
            },
            {
                content: '寻找室友！我在校外租了一个两室一厅的公寓，环境很好，交通便利。',
                topic: 'living',
                username: 'alice'
            },
            {
                content: '有人喜欢摄影吗？我刚买了一台新相机，想找人一起去拍照。',
                topic: 'hobbies',
                username: 'bob'
            },
            {
                content: '今天天气真好！适合出去走走，有人想一起去公园吗？',
                topic: 'chat',
                username: 'charlie'
            },
            {
                content: '丢失了一个黑色钱包，里面有学生证和银行卡，如果有人捡到请联系我！',
                topic: 'lost',
                username: 'diana'
            },
            {
                content: '推荐一个很好用的学习APP，可以帮助记忆单词和做笔记。',
                topic: 'study',
                username: 'alice'
            },
            {
                content: '出售全新的编程书籍，《JavaScript高级程序设计》和《Python核心编程》。',
                topic: 'trade',
                username: 'bob'
            },
            {
                content: '食堂的新品奶茶真的很好喝！特别是芋泥波波奶茶，强烈推荐！',
                topic: 'food',
                username: 'charlie'
            },
            {
                content: '下周有一个技术讲座，主题是人工智能的发展趋势，欢迎感兴趣的同学参加。',
                topic: 'events',
                username: 'diana'
            }
        ];
        
        for (const post of testPosts) {
            const user = users.find(u => u.username === post.username);
            const topic = topics.find(t => t.name === post.topic);
            
            if (user && topic) {
                await connection.query(
                    'INSERT INTO posts (user_id, topic_id, content) VALUES (?, ?, ?)',
                    [user.id, topic.id, post.content]
                );
            }
        }
        
        console.log('测试数据创建完成！');
        console.log(`创建了 ${testUsers.length} 个测试用户`);
        console.log(`创建了 ${testPosts.length} 个测试帖子`);
        
    } catch (error) {
        console.error('创建测试数据失败:', error.message);
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

// 如果直接运行此文件，则执行创建测试数据
if (require.main === module) {
    createTestData();
}

module.exports = createTestData;
