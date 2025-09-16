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
        
        // 创建用户表
        await connection.query('DROP TABLE IF EXISTS posts');
        await connection.query('DROP TABLE IF EXISTS users');
        await connection.query('DROP TABLE IF EXISTS topics');
        
        await connection.query(`
            CREATE TABLE users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                username VARCHAR(50) UNIQUE,
                password VARCHAR(255),
                wallet_address VARCHAR(42) UNIQUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT check_login_method CHECK (
                    (username IS NOT NULL AND password IS NOT NULL) OR
                    (wallet_address IS NOT NULL)
                )
            )
        `);
        
        // 创建话题表
        await connection.query(`
            CREATE TABLE topics (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(100) NOT NULL UNIQUE,
                display_name VARCHAR(100) NOT NULL
            )
        `);
        
        // 创建帖子表
        await connection.query(`
            CREATE TABLE posts (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                topic_id INT NOT NULL,
                content TEXT NOT NULL,
                media_path VARCHAR(255),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id),
                FOREIGN KEY (topic_id) REFERENCES topics(id)
            )
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
        
        console.log('数据库初始化完成！');
        console.log('创建的表：');
        console.log('- users (用户表)');
        console.log('- topics (话题表)');
        console.log('- posts (帖子表)');
        console.log('');
        console.log('插入的默认话题：');
        console.log('- trade: Second-hand Trading');
        console.log('- food: Food Sharing');
        console.log('- study: Learning Exchange');
        console.log('- events: Campus Events');
        console.log('- lost: Lost Property');
        console.log('- living: Accommodation & Living');
        console.log('- hobbies: Hobbies & Interests');
        console.log('- chat: Casual Chat');
        
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