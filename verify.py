#!/usr/bin/env python
"""
Script di verifica per Circles Madness.
Testa che tutto è configurato correttamente.
"""

import sys
import os

def check_imports():
    """Verifica che le importazioni critiche funzionano"""
    print("🔍 Verifica importazioni...")
    errors = []
    
    try:
        import flask
        print(f"   ✓ Flask {flask.__version__}")
    except ImportError as e:
        errors.append(f"   ✗ Flask: {e}")
    
    try:
        import werkzeug
        print(f"   ✓ Werkzeug")
    except ImportError as e:
        errors.append(f"   ✗ Werkzeug: {e}")
    
    try:
        from app import create_app
        print(f"   ✓ App package")
    except ImportError as e:
        errors.append(f"   ✗ App package: {e}")
    
    return errors

def check_templates():
    """Verifica che i template esistono"""
    print("\n📄 Verifica template...")
    templates = [
        'app/templates/base.html',
        'app/templates/index.html',
        'app/templates/login.html',
        'app/templates/register.html',
        'app/templates/profile.html',
        'app/templates/leaderboard.html',
        'app/templates/armory.html',
        'app/templates/shop.html',
        'app/templates/pattern-editor.html',
    ]
    
    errors = []
    for template in templates:
        if os.path.exists(template):
            print(f"   ✓ {template}")
        else:
            errors.append(f"   ✗ {template} mancante")
    
    return errors

def check_static_files():
    """Verifica file statici"""
    print("\n🎨 Verifica file statici...")
    files = [
        'app/static/js/phaser_game.js',
    ]
    
    errors = []
    for file in files:
        if os.path.exists(file):
            print(f"   ✓ {file}")
        else:
            errors.append(f"   ✗ {file} mancante")
    
    return errors

def check_python_files():
    """Verifica syntax dei file Python"""
    print("\n🐍 Verifica syntax Python...")
    
    import py_compile
    files = [
        'app/__init__.py',
        'app/main.py',
        'app/db.py',
        'run.py',
        'init_sample_data.py',
        'setup.py',
    ]
    
    errors = []
    for file in files:
        try:
            py_compile.compile(file, doraise=True)
            print(f"   ✓ {file}")
        except py_compile.PyCompileError as e:
            errors.append(f"   ✗ {file}: {e}")
    
    return errors

def check_database():
    """Verifica che il database schema è valido"""
    print("\n🗄️  Verifica database schema...")
    errors = []
    
    try:
        with open('app/schema.sql', 'r') as f:
            schema = f.read()
            
        # Conta le tabelle
        table_count = schema.count('CREATE TABLE')
        print(f"   ✓ Schema contiene {table_count} tabelle")
        
        # Verifica tabelle critiche
        tables = [
            'users', 'scores', 'enemies', 'power_ups',
            'enemy_patterns', 'shop_items', 'achievements'
        ]
        
        for table in tables:
            if f'CREATE TABLE IF NOT EXISTS {table}' in schema:
                print(f"   ✓ Tabella '{table}'")
            else:
                errors.append(f"   ✗ Tabella '{table}' mancante")
        
    except FileNotFoundError:
        errors.append("   ✗ app/schema.sql non trovato")
    
    return errors

def main():
    print("\n" + "="*60)
    print("🎮 VERIFICA SETUP - CIRCLES MADNESS")
    print("="*60 + "\n")
    
    all_errors = []
    
    all_errors.extend(check_imports())
    all_errors.extend(check_templates())
    all_errors.extend(check_static_files())
    all_errors.extend(check_python_files())
    all_errors.extend(check_database())
    
    print("\n" + "="*60)
    if not all_errors:
        print("✅ TUTTO OK! Setup corretto")
        print("="*60)
        print("\n🚀 Puoi iniziare con:")
        print("   python setup.py  # Setup automatico")
        print("   python run.py    # Avvia server")
        print("\n")
        return 0
    else:
        print("❌ ERRORI TROVATI:")
        print("="*60)
        for error in all_errors:
            print(error)
        print("\n💡 Risolvi gli errori sopra e riprova")
        print("\n")
        return 1

if __name__ == '__main__':
    sys.exit(main())
