from flask import Flask, render_template, request, redirect, url_for, session, jsonify, Blueprint
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime
import sqlite3
import os

# Use the db helper module for connections and initialization
from . import db

# Blueprints
auth_bp = Blueprint('auth', __name__)
game_bp = Blueprint('game', __name__)
api_bp = Blueprint('api', __name__)

@auth_bp.route('/register', methods=['GET', 'POST'])
def register():
    if request.method == 'POST':
        username = request.form['username'].strip()
        password = request.form['password']
        if not username or not password:
            return render_template('register.html', error='Username and password required')
        conn = db.get_db()
        cur = conn.cursor()
        try:
            cur.execute('INSERT INTO users (username, password_hash) VALUES (?, ?)',
                        (username, generate_password_hash(password)))
            conn.commit()
        except sqlite3.IntegrityError:
            # integrity error (username exists); teardown will close DB
            return render_template('register.html', error='Username already taken')
        return redirect(url_for('auth.login'))
    return render_template('register.html')

@auth_bp.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username = request.form['username'].strip()
        password = request.form['password']
        conn = db.get_db()
        cur = conn.cursor()
        cur.execute('SELECT id, password_hash FROM users WHERE username = ?', (username,))
        row = cur.fetchone()
        if row and check_password_hash(row['password_hash'], password):
            session['user_id'] = row['id']
            session['username'] = username
            return redirect(url_for('game.index'))
        return render_template('login.html', error='Invalid credentials')
    return render_template('login.html')

@auth_bp.route('/logout')
def logout():
    session.clear()
    return redirect(url_for('auth.login'))

@game_bp.route('/')
def index():
    if 'user_id' not in session:
        return redirect(url_for('auth.login'))
    return render_template('index.html', username=session.get('username'))

@api_bp.route('/submit_score', methods=['POST'])
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
    conn = db.get_db()
    cur = conn.cursor()
    # Keep only the best (maximum) score per user. If the new time is greater, update; otherwise ignore.
    cur.execute('SELECT MAX(time) as time FROM scores WHERE user_id = ?', (session['user_id'],))
    row = cur.fetchone()
    now = datetime.utcnow().isoformat()
    existing = None
    if row is not None:
        existing = row['time']
    if row is None or existing is None:
        cur.execute('INSERT INTO scores (user_id, time, created_at) VALUES (?, ?, ?)',
                    (session['user_id'], time_val, now))
        conn.commit()
        return jsonify({'status': 'saved', 'action': 'inserted'})
    else:
        if time_val > existing:
            cur.execute('UPDATE scores SET time = ?, created_at = ? WHERE user_id = ?',
                        (time_val, now, session['user_id']))
            conn.commit()
            return jsonify({'status': 'saved', 'action': 'updated'})
        else:
            return jsonify({'status': 'ignored', 'reason': 'not a better time'})

@api_bp.route('/api/leaderboard')
def api_leaderboard():
    limit = request.args.get('limit', 10, type=int)
    # Return one score per user (their best) ordered by time descending (survival: higher is better)
    conn = db.get_db()
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
    result = []
    for r in rows:
        result.append({'username': r['username'], 'time': r['time'], 'created_at': r['created_at']})
    return jsonify(result)

@game_bp.route('/leaderboard')
def leaderboard_page():
    return render_template('leaderboard.html')

def create_app():
    # Use instance_relative_config so we can store the sqlite file in the instance folder
    app = Flask(__name__, instance_relative_config=True,
                template_folder=os.path.join('app', 'templates'),
                static_folder=os.path.join('app', 'static'))
    app.config.from_mapping(
        SECRET_KEY=os.environ.get('FLASK_SECRET_KEY', 'dev-secret-key-change-me'),
        DATABASE=os.path.join(app.instance_path, 'game.sqlite'),
    )
    # Ensure instance folder exists
    try:
        os.makedirs(app.instance_path, exist_ok=True)
    except OSError:
        pass

    # Register db helper with this app
    db.init_app(app)
    app.register_blueprint(auth_bp)
    app.register_blueprint(game_bp)
    app.register_blueprint(api_bp)

    # Create tables immediately so the app can be used without requiring a first HTTP request
    with app.app_context():
        db.init_db()

    return app


if __name__ == '__main__':
    application = create_app()
    application.run(debug=True, port=5002)
