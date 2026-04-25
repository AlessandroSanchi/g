from flask import Flask, render_template, request, redirect, url_for, session, jsonify, Blueprint
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime
import json
import sqlite3
import os

# Use the db helper module for connections and initialization
from . import db

# Blueprints
auth_bp = Blueprint('auth', __name__)
game_bp = Blueprint('game', __name__)
profile_bp = Blueprint('profile', __name__)
api_bp = Blueprint('api', __name__, url_prefix='/api')

# ==================== AUTENTICAZIONE ====================

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
            now = datetime.utcnow().isoformat()
            cur.execute('''INSERT INTO users (username, password_hash, created_at, updated_at) 
                          VALUES (?, ?, ?, ?)''',
                        (username, generate_password_hash(password), now, now))
            conn.commit()
        except sqlite3.IntegrityError:
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

# ==================== GAMEPLAY ====================

@game_bp.route('/')
def index():
    if 'user_id' not in session:
        return redirect(url_for('auth.login'))
    return render_template('index.html', username=session.get('username'))

@game_bp.route('/leaderboard')
def leaderboard_page():
    return render_template('leaderboard.html')

@game_bp.route('/armory')
def armory():
    return render_template('armory.html')

@game_bp.route('/shop')
def shop():
    return render_template('shop.html')

@game_bp.route('/pattern-editor')
def pattern_editor():
    return render_template('pattern-editor.html')

# ==================== PROFILO UTENTE ====================

@profile_bp.route('/profile')
def profile():
    if 'user_id' not in session:
        return redirect(url_for('auth.login'))
    
    conn = db.get_db()
    cur = conn.cursor()
    
    # Dati utente
    cur.execute('''SELECT username, coins, total_games, enemies_defeated, total_playtime 
                   FROM users WHERE id = ?''', (session['user_id'],))
    user = cur.fetchone()
    
    # Statistiche
    cur.execute('''SELECT COUNT(*) as total_scores, 
                          MAX(score) as best_score,
                          AVG(score) as avg_score
                   FROM scores WHERE user_id = ?''', (session['user_id'],))
    stats = cur.fetchone()
    
    # Achievements sbloccati
    cur.execute('''SELECT a.name, a.description, a.icon_url, ua.unlocked_at
                   FROM user_achievements ua
                   JOIN achievements a ON ua.achievement_id = a.id
                   WHERE ua.user_id = ?
                   ORDER BY ua.unlocked_at DESC''', (session['user_id'],))
    achievements = cur.fetchall()
    
    # Acquisti nello shop
    cur.execute('''SELECT si.name, si.category, si.sprite_url, up.purchased_at
                   FROM user_purchases up
                   JOIN shop_items si ON up.shop_item_id = si.id
                   WHERE up.user_id = ?
                   ORDER BY up.purchased_at DESC''', (session['user_id'],))
    purchases = cur.fetchall()
    
    return render_template('profile.html',
                         user=user,
                         stats=stats,
                         achievements=achievements,
                         purchases=purchases)

# ==================== API - SCORES ====================

@api_bp.route('/submit-score', methods=['POST'])
def submit_score():
    if 'user_id' not in session:
        return jsonify({'error': 'unauthenticated'}), 401
    
    data = request.get_json()
    
    # Validazione payload
    if not data or 'score' not in data:
        return jsonify({'error': 'invalid payload'}), 400
    
    try:
        score_val = float(data.get('score'))
        enemies_killed = int(data.get('enemies_killed', 0))
        bullets_fired = int(data.get('bullets_fired', 0))
        playtime = float(data.get('playtime', 0))
        difficulty = data.get('difficulty', 'normal')
        pattern_used = data.get('pattern_used', 'default')
        coins = int(data.get('coins', 0))
    except (ValueError, TypeError):
        return jsonify({'error': 'invalid data types'}), 400
    
    conn = db.get_db()
    cur = conn.cursor()
    now = datetime.utcnow().isoformat()
    
    cur.execute('SELECT score FROM scores WHERE user_id = ?', (session['user_id'],))
    existing = cur.fetchone()
    saved = False
    action = 'ignored'

    if existing is None:
        cur.execute('''INSERT INTO scores 
                       (user_id, score, enemies_killed, bullets_fired, playtime, difficulty, pattern_used, created_at)
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?)''',
                    (session['user_id'], score_val, enemies_killed, bullets_fired, playtime, difficulty, pattern_used, now))
        saved = True
        action = 'inserted'
    else:
        current_best = existing['score']
        if score_val > current_best:
            cur.execute('''UPDATE scores SET score = ?, enemies_killed = ?, bullets_fired = ?, playtime = ?, difficulty = ?, pattern_used = ?, created_at = ?
                           WHERE user_id = ?''',
                        (score_val, enemies_killed, bullets_fired, playtime, difficulty, pattern_used, now, session['user_id']))
            saved = True
            action = 'updated'

    # Aggiorna statistiche utente anche per partite giocate
    cur.execute('''UPDATE users 
                   SET total_games = total_games + 1,
                       enemies_defeated = enemies_defeated + ?,
                       total_playtime = total_playtime + ?,
                       coins = coins + ?,
                       updated_at = ?
                   WHERE id = ?''',
                (enemies_killed, playtime, coins, now, session['user_id']))

    # Mantieni solo i migliori 50 punteggi nella leaderboard
    cur.execute('''DELETE FROM scores
                   WHERE id NOT IN (
                       SELECT id FROM scores ORDER BY score DESC LIMIT 50
                   )''')

    check_achievements(session['user_id'], conn)
    conn.commit()

    if saved:
        return jsonify({'status': 'saved', 'action': action})

    return jsonify({'status': 'ignored', 'reason': 'not a better score'})

@api_bp.route('/leaderboard', methods=['GET'])
def api_leaderboard():
    limit = request.args.get('limit', 20, type=int)
    offset = request.args.get('offset', 0, type=int)
    sort_by = request.args.get('sort_by', 'best_score')  # best_score, total_games, enemies_defeated
    
    conn = db.get_db()
    cur = conn.cursor()
    
    if sort_by == 'total_games':
        order_clause = 'u.total_games DESC'
    elif sort_by == 'enemies_defeated':
        order_clause = 'u.enemies_defeated DESC'
    else:  # best_score
        order_clause = 'MAX(s.score) DESC'
    
    cur.execute(f'''SELECT u.id, u.username, MAX(s.score) as best_score,
                           u.total_games, u.enemies_defeated, u.total_playtime
                    FROM users u
                    LEFT JOIN scores s ON u.id = s.user_id
                    GROUP BY u.id
                    ORDER BY {order_clause}
                    LIMIT ? OFFSET ?''', (limit, offset))
    
    rows = cur.fetchall()
    result = [dict(r) for r in rows]
    
    return jsonify(result)

# ==================== API - ARMERIA (Database Nemici/Power-up) ====================

@api_bp.route('/armory/enemies', methods=['GET'])
def get_enemies():
    """Ritorna lista di nemici disponibili per il gioco"""
    conn = db.get_db()
    cur = conn.cursor()
    
    rarity = request.args.get('rarity', None)
    query = 'SELECT * FROM enemies'
    params = []
    
    if rarity:
        query += ' WHERE rarity = ?'
        params.append(rarity)
    
    query += ' ORDER BY rarity ASC, name ASC'
    cur.execute(query, params)
    
    enemies = [dict(row) for row in cur.fetchall()]
    
    # Parsa il fire_pattern da JSON
    for enemy in enemies:
        if enemy['fire_pattern']:
            try:
                enemy['fire_pattern'] = json.loads(enemy['fire_pattern'])
            except:
                enemy['fire_pattern'] = {}
    
    return jsonify(enemies)

@api_bp.route('/armory/powerups', methods=['GET'])
def get_powerups():
    """Ritorna lista di power-up disponibili"""
    conn = db.get_db()
    cur = conn.cursor()
    
    cur.execute('SELECT * FROM power_ups ORDER BY rarity ASC, name ASC')
    powerups = [dict(row) for row in cur.fetchall()]
    
    return jsonify(powerups)

@api_bp.route('/armory/enemies', methods=['POST'])
def create_enemy():
    """Admin: Crea un nuovo nemico [REQUIRES ADMIN]"""
    data = request.get_json()
    
    if not data or not all(k in data for k in ['name', 'hp', 'speed', 'fire_rate', 'bullet_speed']):
        return jsonify({'error': 'missing required fields'}), 400
    
    conn = db.get_db()
    cur = conn.cursor()
    now = datetime.utcnow().isoformat()
    
    fire_pattern_json = json.dumps(data.get('fire_pattern', {}))
    
    try:
        cur.execute('''INSERT INTO enemies 
                       (name, description, hp, speed, fire_rate, bullet_speed, 
                        score_value, sprite_url, fire_pattern, rarity, created_at)
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)''',
                    (data['name'], data.get('description', ''),
                     data['hp'], data['speed'], data['fire_rate'], data['bullet_speed'],
                     data.get('score_value', 100), data.get('sprite_url', ''),
                     fire_pattern_json, data.get('rarity', 'common'), now))
        conn.commit()
        return jsonify({'status': 'success', 'enemy_id': cur.lastrowid}), 201
    except sqlite3.IntegrityError:
        return jsonify({'error': 'enemy name already exists'}), 409

# ==================== API - SHOP ====================

@api_bp.route('/shop/items', methods=['GET'])
def get_shop_items():
    """Ritorna lista di skin disponibili nello shop"""
    # Hardcoded skins
    skins = [
        {'id': 'default', 'name': 'Default Skin', 'price': 0, 'description': 'The default player skin', 'sprite_url': '🎮'},
        {'id': 'red', 'name': 'Red Skin', 'price': 100, 'description': 'A fiery red skin', 'sprite_url': '🔴'},
        {'id': 'blue', 'name': 'Blue Skin', 'price': 150, 'description': 'A cool blue skin', 'sprite_url': '🔵'},
        {'id': 'green', 'name': 'Green Skin', 'price': 200, 'description': 'A nature green skin', 'sprite_url': '🟢'},
    ]
    items = skins.copy()
    if 'user_id' in session:
        conn = db.get_db()
        cur = conn.cursor()
        cur.execute('SELECT owned_skins FROM users WHERE id = ?', (session['user_id'],))
        user = cur.fetchone()
        owned = json.loads(user['owned_skins']) if user and user['owned_skins'] else []
        for item in items:
            item['owned'] = item['id'] in owned
    return jsonify(items)

@api_bp.route('/shop/buy/<item_id>', methods=['POST'])
def buy_item(item_id):
    """Acquista una skin dallo shop"""
    if 'user_id' not in session:
        return jsonify({'error': 'unauthenticated'}), 401
    
    # Hardcoded skins
    skins = [
        {'id': 'default', 'name': 'Default Skin', 'price': 0, 'description': 'The default player skin', 'sprite_url': '🎮'},
        {'id': 'red', 'name': 'Red Skin', 'price': 100, 'description': 'A fiery red skin', 'sprite_url': '🔴'},
        {'id': 'blue', 'name': 'Blue Skin', 'price': 150, 'description': 'A cool blue skin', 'sprite_url': '🔵'},
        {'id': 'green', 'name': 'Green Skin', 'price': 200, 'description': 'A nature green skin', 'sprite_url': '🟢'},
    ]
    item = next((i for i in skins if i['id'] == item_id), None)
    if not item:
        return jsonify({'error': 'item not found'}), 404
    
    conn = db.get_db()
    cur = conn.cursor()
    user_id = session['user_id']
    cur.execute('SELECT coins, owned_skins FROM users WHERE id = ?', (user_id,))
    user = cur.fetchone()
    owned = json.loads(user['owned_skins']) if user['owned_skins'] else []
    if item['id'] in owned:
        return jsonify({'error': 'already owned'}), 409
    if user['coins'] < item['price']:
        return jsonify({'error': 'insufficient coins'}), 402
    # Buy
    owned.append(item['id'])
    cur.execute('UPDATE users SET coins = coins - ?, owned_skins = ? WHERE id = ?', (item['price'], json.dumps(owned), user_id))
    conn.commit()
    return jsonify({'status': 'success', 'new_balance': user['coins'] - item['price']})

# ==================== API - EDITOR PATTERN ====================

@api_bp.route('/patterns', methods=['GET'])
def get_patterns():
    """Ritorna lista di pattern disponibili"""
    conn = db.get_db()
    cur = conn.cursor()
    
    difficulty = request.args.get('difficulty', None)
    query = 'SELECT * FROM enemy_patterns WHERE is_public = 1'
    params = []
    
    if difficulty:
        query += ' AND difficulty = ?'
        params.append(difficulty)
    
    query += ' ORDER BY plays DESC, rating DESC'
    cur.execute(query, params)
    
    patterns = [dict(row) for row in cur.fetchall()]
    
    # Parsa pattern_data da JSON
    for pattern in patterns:
        try:
            pattern['pattern_data'] = json.loads(pattern['pattern_data'])
        except:
            pattern['pattern_data'] = {}
    
    return jsonify(patterns)

@api_bp.route('/patterns', methods=['POST'])
def create_pattern():
    """Crea un nuovo pattern"""
    if 'user_id' not in session:
        return jsonify({'error': 'unauthenticated'}), 401
    
    data = request.get_json()
    
    if not data or 'name' not in data or 'pattern_data' not in data:
        return jsonify({'error': 'missing required fields'}), 400
    
    conn = db.get_db()
    cur = conn.cursor()
    now = datetime.utcnow().isoformat()
    
    pattern_json = json.dumps(data['pattern_data'])
    
    cur.execute('''INSERT INTO enemy_patterns 
                   (user_id, name, description, pattern_data, difficulty, is_public, created_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?)''',
                (session['user_id'], data['name'], data.get('description', ''),
                 pattern_json, data.get('difficulty', 'normal'),
                 data.get('is_public', 1), now))
    
    conn.commit()
    
    return jsonify({'status': 'success', 'pattern_id': cur.lastrowid}), 201

@api_bp.route('/patterns/<int:pattern_id>/play', methods=['POST'])
def play_pattern(pattern_id):
    """Registra che un utente ha giocato un pattern"""
    if 'user_id' not in session:
        return jsonify({'error': 'unauthenticated'}), 401
    
    conn = db.get_db()
    cur = conn.cursor()
    
    # Aggiorna contatore play
    cur.execute('UPDATE enemy_patterns SET plays = plays + 1 WHERE id = ?', (pattern_id,))
    
    # Registra il play
    now = datetime.utcnow().isoformat()
    cur.execute('INSERT INTO user_patterns (user_id, pattern_id, played_at) VALUES (?, ?, ?)',
               (session['user_id'], pattern_id, now))
    
    conn.commit()
    
    return jsonify({'status': 'success'})

# ==================== API - ACHIEVEMENTS ====================

@api_bp.route('/achievements', methods=['GET'])
def get_achievements():
    """Ritorna lista di achievement disponibili"""
    conn = db.get_db()
    cur = conn.cursor()
    
    cur.execute('SELECT * FROM achievements ORDER BY reward_coins DESC')
    achievements = [dict(row) for row in cur.fetchall()]
    
    # Parsa il requirement da JSON
    for ach in achievements:
        try:
            ach['requirement'] = json.loads(ach['requirement'])
        except:
            ach['requirement'] = {}
    
    return jsonify(achievements)

@api_bp.route('/achievements/my', methods=['GET'])
def get_my_achievements():
    """Ritorna gli achievement sbloccati dall'utente"""
    if 'user_id' not in session:
        return jsonify({'error': 'unauthenticated'}), 401
    
    conn = db.get_db()
    cur = conn.cursor()
    
    cur.execute('''SELECT a.*, ua.unlocked_at
                   FROM user_achievements ua
                   JOIN achievements a ON ua.achievement_id = a.id
                   WHERE ua.user_id = ?
                   ORDER BY ua.unlocked_at DESC''', (session['user_id'],))
    
    achievements = [dict(row) for row in cur.fetchall()]
    
    return jsonify(achievements)

def check_achievements(user_id, conn):
    """Controlla e sblocca achievement se necessari"""
    cur = conn.cursor()
    
    # Prendi statistiche utente
    cur.execute('SELECT total_games, enemies_defeated, total_playtime FROM users WHERE id = ?', (user_id,))
    user = cur.fetchone()
    
    if not user:
        return
    
    # Prendi gli achievement non ancora sbloccati
    cur.execute('''SELECT id, requirement FROM achievements 
                   WHERE id NOT IN (SELECT achievement_id FROM user_achievements WHERE user_id = ?)''',
               (user_id,))
    
    achievements = cur.fetchall()
    now = datetime.utcnow().isoformat()
    
    for ach in achievements:
        try:
            req = json.loads(ach['requirement'])
        except:
            continue
        
        # Controlla se i requisiti sono soddisfatti
        unlocked = True
        
        if 'min_games' in req and user['total_games'] < req['min_games']:
            unlocked = False
        if 'min_enemies' in req and user['enemies_defeated'] < req['min_enemies']:
            unlocked = False
        if 'min_playtime' in req and user['total_playtime'] < req['min_playtime']:
            unlocked = False
        
        if unlocked:
            # Sblocca l'achievement
            try:
                cur.execute('''INSERT INTO user_achievements (user_id, achievement_id, unlocked_at)
                             VALUES (?, ?, ?)''', (user_id, ach['id'], now))
                
                # Premia i coin
                reward = 0
                cur.execute('SELECT reward_coins FROM achievements WHERE id = ?', (ach['id'],))
                reward_row = cur.fetchone()
                if reward_row:
                    reward = reward_row['reward_coins']
                
                if reward > 0:
                    cur.execute('UPDATE users SET coins = coins + ? WHERE id = ?', (reward, user_id))
            except sqlite3.IntegrityError:
                pass
# ==================== APP FACTORY ====================
# La factory è stata spostata in __init__.py per gestire meglio i percorsi dei template



