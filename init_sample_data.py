#!/usr/bin/env python
"""
Script per inizializzare il database con dati di esempio.
Eseguire: python init_sample_data.py
"""

import sqlite3
import os
import json
from datetime import datetime

DB_PATH = os.path.join('app', 'instance', 'game.sqlite')

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_enemies():
    """Aggiunge nemici di esempio al database"""
    enemies = [
        {
            "name": "Cerchio Base",
            "description": "Un semplice nemico circolare con fuoco regolare",
            "hp": 1,
            "speed": 2,
            "fire_rate": 1,
            "bullet_speed": 3,
            "score_value": 10,
            "sprite_url": "🔵",
            "fire_pattern": {"type": "straight", "rate": 1},
            "rarity": "common"
        },
        {
            "name": "Cerchio Veloce",
            "description": "Nemico veloce e aggressivo",
            "hp": 2,
            "speed": 4,
            "fire_rate": 1.5,
            "bullet_speed": 4,
            "score_value": 25,
            "sprite_url": "🟢",
            "fire_pattern": {"type": "spread", "rate": 1.5},
            "rarity": "uncommon"
        },
        {
            "name": "Cerchio Resistente",
            "description": "Un nemico difficile con molto HP",
            "hp": 5,
            "speed": 1,
            "fire_rate": 2,
            "bullet_speed": 3,
            "score_value": 50,
            "sprite_url": "🔴",
            "fire_pattern": {"type": "spiral", "rate": 2},
            "rarity": "rare"
        },
        {
            "name": "Cerchio Elite",
            "description": "Un avversario da non sottovalutare",
            "hp": 3,
            "speed": 3,
            "fire_rate": 3,
            "bullet_speed": 5,
            "score_value": 100,
            "sprite_url": "🟣",
            "fire_pattern": {"type": "pattern", "rate": 3},
            "rarity": "epic"
        },
        {
            "name": "Cerchio Leggendario",
            "description": "Il boss finale del gioco",
            "hp": 10,
            "speed": 2.5,
            "fire_rate": 4,
            "bullet_speed": 6,
            "score_value": 500,
            "sprite_url": "👑",
            "fire_pattern": {"type": "chaos", "rate": 4},
            "rarity": "legendary"
        }
    ]
    
    conn = get_db()
    cur = conn.cursor()
    now = datetime.utcnow().isoformat()
    
    for enemy in enemies:
        try:
            cur.execute('''INSERT INTO enemies 
                          (name, description, hp, speed, fire_rate, bullet_speed, 
                           score_value, sprite_url, fire_pattern, rarity, created_at)
                          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)''',
                       (enemy['name'], enemy['description'], enemy['hp'], enemy['speed'],
                        enemy['fire_rate'], enemy['bullet_speed'], enemy['score_value'],
                        enemy['sprite_url'], json.dumps(enemy['fire_pattern']),
                        enemy['rarity'], now))
        except sqlite3.IntegrityError:
            print(f"⚠️  Nemico '{enemy['name']}' già presente")
    
    conn.commit()
    print("✓ Nemici inizializzati")

def init_powerups():
    """Aggiunge power-up di esempio"""
    powerups = [
        {
            "name": "Scudo",
            "description": "Protegge dalla prossima pallottola",
            "effect": "shield",
            "duration": 5,
            "sprite_url": "🛡️",
            "rarity": "common"
        },
        {
            "name": "Fuoco Rapido",
            "description": "Aumenta la velocità di fuoco",
            "effect": "rapid_fire",
            "duration": 8,
            "sprite_url": "🔥",
            "rarity": "uncommon"
        },
        {
            "name": "Slow Motion",
            "description": "Rallenta i nemici",
            "effect": "slow_motion",
            "duration": 10,
            "sprite_url": "⏱️",
            "rarity": "rare"
        },
        {
            "name": "Guarigione",
            "description": "Ripristina la salute",
            "effect": "heal",
            "duration": 1,
            "sprite_url": "💚",
            "rarity": "uncommon"
        },
        {
            "name": "Esplosione",
            "description": "Uccide tutti i nemici sullo schermo",
            "effect": "bomb",
            "duration": 0.5,
            "sprite_url": "💣",
            "rarity": "epic"
        }
    ]
    
    conn = get_db()
    cur = conn.cursor()
    now = datetime.utcnow().isoformat()
    
    for pu in powerups:
        try:
            cur.execute('''INSERT INTO power_ups 
                          (name, description, effect, duration, sprite_url, rarity, created_at)
                          VALUES (?, ?, ?, ?, ?, ?, ?)''',
                       (pu['name'], pu['description'], pu['effect'], pu['duration'],
                        pu['sprite_url'], pu['rarity'], now))
        except sqlite3.IntegrityError:
            print(f"⚠️  Power-up '{pu['name']}' già presente")
    
    conn.commit()
    print("✓ Power-up inizializzati")

def init_shop_items():
    """Aggiunge oggetti dello shop"""
    items = [
        {"name": "Skin Rosso", "description": "Una bella skin rossa", "category": "skin", "price": 50, "sprite_url": "🔴"},
        {"name": "Skin Blu", "description": "Una bella skin blu", "category": "skin", "price": 50, "sprite_url": "🔵"},
        {"name": "Skin Giallo", "description": "Una bella skin gialla", "category": "skin", "price": 50, "sprite_url": "🟡"},
        {"name": "Arma Veloce", "description": "Aumenta la velocità di fuoco", "category": "weapon", "price": 100, "sprite_url": "⚡"},
        {"name": "Arma Potente", "description": "Proiettili più potenti", "category": "weapon", "price": 150, "sprite_url": "💥"},
        {"name": "Boost Salute", "description": "Aumenta la salute massima", "category": "boost", "price": 75, "sprite_url": "❤️"},
        {"name": "Boost Velocità", "description": "Aumenta la velocità di movimento", "category": "boost", "price": 75, "sprite_url": "💨"},
        {"name": "Tema Scuro", "description": "Interfaccia tema scuro", "category": "other", "price": 25, "sprite_url": "🌙"},
        {"name": "Suoni Custom", "description": "Effetti sonori personalizzati", "category": "other", "price": 40, "sprite_url": "🔊"},
    ]
    
    conn = get_db()
    cur = conn.cursor()
    now = datetime.utcnow().isoformat()
    
    for item in items:
        try:
            cur.execute('''INSERT INTO shop_items 
                          (name, description, category, price, sprite_url, created_at)
                          VALUES (?, ?, ?, ?, ?, ?)''',
                       (item['name'], item['description'], item['category'],
                        item['price'], item['sprite_url'], now))
        except sqlite3.IntegrityError:
            print(f"⚠️  Oggetto '{item['name']}' già presente")
    
    conn.commit()
    print("✓ Oggetti shop inizializzati")

def init_achievements():
    """Aggiunge achievement"""
    achievements = [
        {
            "name": "Primo Sangue",
            "description": "Gioca la tua prima partita",
            "icon_url": "🎮",
            "requirement": {"min_games": 1},
            "reward_coins": 10
        },
        {
            "name": "Cacciatore",
            "description": "Sconfiggi 50 nemici",
            "icon_url": "👾",
            "requirement": {"min_enemies": 50},
            "reward_coins": 25
        },
        {
            "name": "Maratoneta",
            "description": "Gioca per 300 secondi totali",
            "icon_url": "⏱️",
            "requirement": {"min_playtime": 300},
            "reward_coins": 30
        },
        {
            "name": "Esperto",
            "description": "Gioca 10 partite",
            "icon_url": "🏆",
            "requirement": {"min_games": 10},
            "reward_coins": 50
        },
        {
            "name": "Leggenda",
            "description": "Sconfiggi 500 nemici",
            "icon_url": "👑",
            "requirement": {"min_enemies": 500},
            "reward_coins": 100
        },
        {
            "name": "Immortale",
            "description": "Gioca per 1000 secondi totali",
            "icon_url": "🌟",
            "requirement": {"min_playtime": 1000},
            "reward_coins": 150
        }
    ]
    
    conn = get_db()
    cur = conn.cursor()
    now = datetime.utcnow().isoformat()
    
    for ach in achievements:
        try:
            cur.execute('''INSERT INTO achievements 
                          (name, description, icon_url, requirement, reward_coins, created_at)
                          VALUES (?, ?, ?, ?, ?, ?)''',
                       (ach['name'], ach['description'], ach['icon_url'],
                        json.dumps(ach['requirement']), ach['reward_coins'], now))
        except sqlite3.IntegrityError:
            print(f"⚠️  Achievement '{ach['name']}' già presente")
    
    conn.commit()
    print("✓ Achievement inizializzati")

def init_sample_patterns():
    """Aggiunge pattern di esempio"""
    patterns = [
        {
            "name": "Linea Diritta",
            "description": "Nemici in linea retta semplice",
            "pattern_data": {
                "waves": [
                    {"enemies": 5, "type": "basic", "spacing": 50},
                    {"enemies": 3, "type": "fast", "spacing": 40}
                ]
            },
            "difficulty": "easy",
            "is_public": 1
        },
        {
            "name": "Spirale",
            "description": "Nemici in pattern a spirale",
            "pattern_data": {
                "waves": [
                    {"enemies": 8, "type": "basic", "pattern": "spiral"},
                    {"enemies": 5, "type": "strong", "pattern": "spiral"}
                ]
            },
            "difficulty": "normal",
            "is_public": 1
        },
        {
            "name": "Tempesta",
            "description": "Molti nemici contemporaneamente",
            "pattern_data": {
                "waves": [
                    {"enemies": 20, "type": "basic", "pattern": "random"},
                ]
            },
            "difficulty": "hard",
            "is_public": 1
        }
    ]
    
    conn = get_db()
    cur = conn.cursor()
    now = datetime.utcnow().isoformat()
    
    for pattern in patterns:
        try:
            cur.execute('''INSERT INTO enemy_patterns 
                          (user_id, name, description, pattern_data, difficulty, is_public, created_at)
                          VALUES (?, ?, ?, ?, ?, ?, ?)''',
                       (None, pattern['name'], pattern['description'],
                        json.dumps(pattern['pattern_data']), pattern['difficulty'],
                        pattern['is_public'], now))
        except sqlite3.IntegrityError:
            print(f"⚠️  Pattern '{pattern['name']}' già presente")
    
    conn.commit()
    print("✓ Pattern di esempio inizializzati")

def main():
    print("\n🎮 Inizializzazione dei dati di esempio...\n")
    
    if not os.path.exists(DB_PATH):
        print("❌ Database non trovato. Eseguire prima init_db_command()")
        return
    
    init_enemies()
    init_powerups()
    init_shop_items()
    init_achievements()
    init_sample_patterns()
    
    print("\n✅ Inizializzazione completata!\n")

if __name__ == '__main__':
    main()
