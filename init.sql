-- 关闭外键检查
SET FOREIGN_KEY_CHECKS = 0;

-- 创建数据库
CREATE DATABASE IF NOT EXISTS ntunest;
USE ntunest;

-- 用户表
DROP TABLE IF EXISTS users;
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
);

-- 话题表
DROP TABLE IF EXISTS topics;
CREATE TABLE topics (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  display_name VARCHAR(100) NOT NULL
);

-- 帖子表
DROP TABLE IF EXISTS posts;
CREATE TABLE posts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  topic_id INT NOT NULL,
  content TEXT NOT NULL,
  media_path VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (topic_id) REFERENCES topics(id)
);

-- 插入 8 个固定话题
INSERT INTO topics (name, display_name) VALUES
('trade', 'Second-hand Trading'),
('food', 'Food Sharing'),
('study', 'Learning Exchange'),
('events', 'Campus Events'),
('lost', 'Lost Property'),
('living', 'Accommodation & Living'),
('hobbies', 'Hobbies & Interests'),
('chat', 'Casual Chat');

-- 重新开启外键检查
SET FOREIGN_KEY_CHECKS = 1;
