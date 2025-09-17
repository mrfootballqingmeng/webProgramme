const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function setupDatabase() {
    let connection;
    
    try {
        console.log('正在连接 MySQL 服务器...');
        
        // 首先连接到 MySQL 服务器（不指定数据库）
        connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASS || '',
            charset: 'utf8mb4',
            multipleStatements: true
        });
        
        console.log('MySQL 连接成功！');
        
        console.log('正在执行数据库初始化脚本...');
        
        // 分步执行 SQL 语句
        await connection.query('SET FOREIGN_KEY_CHECKS = 0');
        
        // 创建数据库
        await connection.query(`CREATE DATABASE IF NOT EXISTS ${process.env.DB_NAME || 'qzrdb'}`);
        await connection.query(`USE ${process.env.DB_NAME || 'qzrdb'}`);

        // 删除现有表（按依赖顺序）
        await connection.query('DROP TABLE IF EXISTS messages');
        await connection.query('DROP TABLE IF EXISTS shares');
        await connection.query('DROP TABLE IF EXISTS comments');
        await connection.query('DROP TABLE IF EXISTS likes');
        await connection.query('DROP TABLE IF EXISTS drafts');
        await connection.query('DROP TABLE IF EXISTS posts');
        await connection.query('DROP TABLE IF EXISTS users');
        await connection.query('DROP TABLE IF EXISTS topics');

        // 创建用户表
        await connection.query(`
            CREATE TABLE users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                username VARCHAR(50) NOT NULL UNIQUE,
                password VARCHAR(255) NULL,
                avatar VARCHAR(255) NULL,
                bio TEXT NULL,
                display_name VARCHAR(100) NULL,
                metamask VARCHAR(255) NULL UNIQUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB
        `);

        // 创建话题表
        await connection.query(`
            CREATE TABLE topics (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(100) NOT NULL UNIQUE,
                display_name VARCHAR(100) NOT NULL
            ) ENGINE=InnoDB
        `);

        // 创建帖子表
        await connection.query(`
            CREATE TABLE posts (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                topic_id INT NOT NULL,
                content TEXT NOT NULL,
                media_path VARCHAR(255) NULL,
                media_paths TEXT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (topic_id) REFERENCES topics(id) ON DELETE CASCADE
            ) ENGINE=InnoDB
        `);

        // 创建点赞表
        await connection.query(`
            CREATE TABLE likes (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                post_id INT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY ux_like_user_post (user_id, post_id),
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
            ) ENGINE=InnoDB
        `);

        // 创建评论表
        await connection.query(`
            CREATE TABLE comments (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                post_id INT NOT NULL,
                content TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
            ) ENGINE=InnoDB
        `);

        // 创建分享表
        await connection.query(`
            CREATE TABLE shares (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                post_id INT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
            ) ENGINE=InnoDB
        `);

        // 创建草稿表
        await connection.query(`
            CREATE TABLE drafts (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                content TEXT NULL,
                media_paths TEXT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            ) ENGINE=InnoDB
        `);

        // 创建私信表
        await connection.query(`
            CREATE TABLE messages (
                id INT AUTO_INCREMENT PRIMARY KEY,
                sender_id INT NOT NULL,
                receiver_id INT NOT NULL,
                content TEXT NOT NULL,
                is_read BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE,
                INDEX idx_receiver_created (receiver_id, created_at),
                INDEX idx_sender_created (sender_id, created_at)
            ) ENGINE=InnoDB
        `);
        
        // 插入默认话题
        await connection.query(`
            INSERT INTO topics (name, display_name) VALUES
            ('trade', 'Second-hand Trading'),
            ('food', 'Food Sharing'),
            ('study', 'Learning Exchange'),
            ('events', 'Campus Events'),
            ('lost', 'Lost Property'),
            ('living', 'Accommodation & Living'),
            ('hobbies', 'Hobbies & Interests'),
            ('chat', 'Casual Chat')
        `);
        
        await connection.query('SET FOREIGN_KEY_CHECKS = 1');
        
        console.log('✅ 数据库初始化完成！');
        console.log('');
        console.log('📋 创建的表：');
        console.log('- users (用户表) - 支持传统登录和MetaMask登录');
        console.log('- topics (话题表)');
        console.log('- posts (帖子表) - 支持多图片上传');
        console.log('- likes (点赞表)');
        console.log('- comments (评论表)');
        console.log('- shares (分享表)');
        console.log('- drafts (草稿表)');
        console.log('- messages (私信表)');
        console.log('');
        console.log('🏷️ 插入的默认话题：');
        console.log('- trade: Second-hand Trading');
        console.log('- food: Food Sharing');
        console.log('- study: Learning Exchange');
        console.log('- events: Campus Events');
        console.log('- lost: Lost Property');
        console.log('- living: Accommodation & Living');
        console.log('- hobbies: Hobbies & Interests');
        console.log('- chat: Casual Chat');
        console.log('');
        console.log('🚀 现在可以运行 npm start 启动服务器！');
        
    } catch (error) {
        console.error('数据库设置失败:', error.message);
        
        if (error.code === 'ER_ACCESS_DENIED_ERROR') {
            console.error('');
            console.error('❌ 数据库访问被拒绝。请检查：');
            console.error('1. MySQL 服务是否正在运行');
            console.error('2. .env 文件中的数据库用户名和密码是否正确');
            console.error('3. 数据库用户是否有足够的权限');
        } else if (error.code === 'ECONNREFUSED') {
            console.error('');
            console.error('❌ 无法连接到 MySQL 服务器。请检查：');
            console.error('1. MySQL 服务是否正在运行');
            console.error('2. 连接地址和端口是否正确');
        }
        
        process.exit(1);
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

// 如果直接运行此文件，则执行数据库设置
if (require.main === module) {
    setupDatabase();
}

module.exports = setupDatabase;