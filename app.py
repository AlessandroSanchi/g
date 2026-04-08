from flask import Flask, render_template, request, redirect, url_for, session, jsonify
import sqlite3
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime
import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, 'instance', 'game.sqlite')

# Ensure instance folder exists
try:
    os.makedirs(os.path.join(BASE_DIR, 'instance'), exist_ok=True)
except OSError:
    pass

app = Flask(__name__)
app.secret_key = os.environ.get('FLASK_SECRET_KEY', 'dev-secret-key-change-me')

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute('''
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL
    )
    ''')
    cur.execute('''
    CREATE TABLE IF NOT EXISTS scores (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        time REAL NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY(user_id) REFERENCES users(id)
    )
    ''')
    conn.commit()
    conn.close()

@app.before_first_request
def startup():
    init_db()

# Auth routes
@app.route('/register', methods=['GET', 'POST'])
def register():
    if request.method == 'POST':
        username = request.form['username'].strip()
        password = request.form['password']
        if not username or not password:
            return render_template('register.html', error='Username and password required')
        conn = get_db_connection()
        cur = conn.cursor()
        try:
            cur.execute('INSERT INTO users (username, password_hash) VALUES (?, ?)',
                        (username, generate_password_hash(password)))
            conn.commit()
        except sqlite3.IntegrityError:
            conn.close()
            return render_template('register.html', error='Username already taken')
        conn.close()
        return redirect(url_for('login'))
    return render_template('register.html')

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username = request.form['username'].strip()
        password = request.form['password']
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute('SELECT id, password_hash FROM users WHERE username = ?', (username,))
        row = cur.fetchone()
        conn.close()
        if row and check_password_hash(row['password_hash'], password):
            session['user_id'] = row['id']
            session['username'] = username
            return redirect(url_for('index'))
        return render_template('login.html', error='Invalid credentials')
    return render_template('login.html')

@app.route('/logout')
def logout():
    session.clear()
    return redirect(url_for('login'))

# Protected game page
@app.route('/')
def index():
    if 'user_id' not in session:
        return redirect(url_for('login'))
    return render_template('index.html', username=session.get('username'))

# API to submit score (expects JSON: {time: number})
@app.route('/submit_score', methods=['POST'])
def submit_score():
    if 'user_id' not in session:
        return jsonify({'error': 'unauthenticated'}), 401
    data = request.get_json()
    if not data or 'time' not in data:
        return jsonify({'error': 'invalid payload'}), 400
    try:
        time_val = float(data['time'])
    except (ValueError, TypeError):
        return jsonify({'error': 'invalid time'}), 400
    conn = get_db_connection()
    cur = conn.cursor()
    # Keep only the best (maximum) score per user. If the new time is greater, update; otherwise ignore.
    cur.execute('SELECT time FROM scores WHERE user_id = ?', (session['user_id'],))
    row = cur.fetchone()
    now = datetime.utcnow().isoformat()
    if row is None:
        cur.execute('INSERT INTO scores (user_id, time, created_at) VALUES (?, ?, ?)',
                    (session['user_id'], time_val, now))
        conn.commit()
        conn.close()
        return jsonify({'status': 'saved', 'action': 'inserted'})
    else:
        existing = row['time']
        if time_val > existing:
            cur.execute('UPDATE scores SET time = ?, created_at = ? WHERE user_id = ?',
                        (time_val, now, session['user_id']))
            conn.commit()
            conn.close()
            return jsonify({'status': 'saved', 'action': 'updated'})
        else:
            conn.close()
            return jsonify({'status': 'ignored', 'reason': 'not a better time'})

# Leaderboard API
@app.route('/api/leaderboard')
def api_leaderboard():
    limit = request.args.get('limit', 10, type=int)
    # Return one score per user (their best) ordered by time descending (survival: higher is better)
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute('''
        SELECT u.username, MAX(s.time) as time, MAX(s.created_at) as created_at
        FROM scores s
        JOIN users u ON u.id = s.user_id
        GROUP BY u.username
        ORDER BY time DESC
        LIMIT ?
    ''', (limit,))
    rows = cur.fetchall()
    conn.close()
    result = []
    for r in rows:
        result.append({'username': r['username'], 'time': r['time'], 'created_at': r['created_at']})
    return jsonify(result)

# Simple page to view leaderboard (optional)
@app.route('/leaderboard')
def leaderboard_page():
    return render_template('leaderboard.html')

if __name__ == '__main__':
    app.run(debug=True)
