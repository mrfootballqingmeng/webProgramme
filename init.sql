-- 使用目标数据库
USE qzrdb;

-- 1. 基础表：users / topics / posts
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  password VARCHAR(255) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS topics (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  display_name VARCHAR(100) NOT NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS posts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  topic_id INT NOT NULL,
  content TEXT NOT NULL,
  media_path VARCHAR(255) NULL,
  media_paths TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (topic_id) REFERENCES topics(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 2. 扩展列（若不存在再添加）
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar VARCHAR(255) NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS display_name VARCHAR(100) NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS metamask VARCHAR(255) NULL UNIQUE;

-- 让 password 可为 NULL（MetaMask 创建账号需要）
ALTER TABLE users MODIFY COLUMN password VARCHAR(255) NULL;

ALTER TABLE posts ADD COLUMN IF NOT EXISTS media_paths TEXT NULL;

-- 3. 社交与互动表
CREATE TABLE IF NOT EXISTS likes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  post_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY ux_like_user_post (user_id, post_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS comments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  post_id INT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS shares (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  post_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS drafts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  content TEXT NULL,
  media_paths TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 4. 默认话题（仅在不存在时插入）
INSERT IGNORE INTO topics (name, display_name) VALUES
('trade', 'Second-hand Trading'),
('food', 'Food Sharing'),
('study', 'Learning Exchange'),
('events', 'Campus Events'),
('lost', 'Lost Property'),
('living', 'Accommodation & Living'),
('hobbies', 'Hobbies & Interests'),
('chat', 'Casual Chat');

-- 5. 索引（若未来查询频繁可添加更多）
-- 5. 索引（若未来查询频繁可添加更多）
-- NOTE: MySQL does not support `ADD INDEX IF NOT EXISTS` on all versions.
-- The following blocks are compatible: they check information_schema and only create
-- the index when it does not already exist. They are idempotent and safe to run
-- multiple times.

-- posts.created_at
SET @db := DATABASE();
SELECT COUNT(1) INTO @exists FROM information_schema.statistics
 WHERE table_schema = @db AND table_name = 'posts' AND index_name = 'idx_posts_created_at';
IF @exists = 0 THEN
  SET @s = 'CREATE INDEX idx_posts_created_at ON posts (created_at)';
  PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;
END IF;

-- posts.user_id
SELECT COUNT(1) INTO @exists FROM information_schema.statistics
 WHERE table_schema = @db AND table_name = 'posts' AND index_name = 'idx_posts_user_id';
IF @exists = 0 THEN
  SET @s = 'CREATE INDEX idx_posts_user_id ON posts (user_id)';
  PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;
END IF;

-- comments.post_id
SELECT COUNT(1) INTO @exists FROM information_schema.statistics
 WHERE table_schema = @db AND table_name = 'comments' AND index_name = 'idx_comments_post_id';
IF @exists = 0 THEN
  SET @s = 'CREATE INDEX idx_comments_post_id ON comments (post_id)';
  PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;
END IF;

-- likes.post_id
SELECT COUNT(1) INTO @exists FROM information_schema.statistics
 WHERE table_schema = @db AND table_name = 'likes' AND index_name = 'idx_likes_post_id';
IF @exists = 0 THEN
  SET @s = 'CREATE INDEX idx_likes_post_id ON likes (post_id)';
  PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;
END IF;

-- shares.post_id
SELECT COUNT(1) INTO @exists FROM information_schema.statistics
 WHERE table_schema = @db AND table_name = 'shares' AND index_name = 'idx_shares_post_id';
IF @exists = 0 THEN
  SET @s = 'CREATE INDEX idx_shares_post_id ON shares (post_id)';
  PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;
END IF;

-- 6. 可选：清理空的占位旧数据（按需启用）
-- DELETE FROM drafts WHERE content IS NULL AND media_paths IS NULL;