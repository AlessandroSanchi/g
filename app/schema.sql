
drop table if exists scores;
drop table if exists users;

-- Users con statistiche e valuta
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    coins INTEGER DEFAULT 0,
    owned_skins TEXT DEFAULT '[]',
    total_games INTEGER DEFAULT 0,
    enemies_defeated INTEGER DEFAULT 0,
    total_playtime REAL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- Scores (statistiche partita singola)
CREATE TABLE IF NOT EXISTS scores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL UNIQUE,
    score REAL NOT NULL,
    enemies_killed INTEGER DEFAULT 0,
    bullets_fired INTEGER DEFAULT 0,
    playtime REAL NOT NULL,
    difficulty TEXT DEFAULT 'normal',
    pattern_used TEXT DEFAULT 'default',
    created_at TEXT NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);


