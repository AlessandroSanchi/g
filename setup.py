#!/usr/bin/env python
"""
Script di setup automatico per Circles Madness.
Esegui: python setup_db.py
"""

import os
import sqlite3
from pathlib import Path

def setup_project():
    """Configura il progetto dall'inizio"""
    
    print("\n" + "="*50)
    print("🎮 CIRCLES MADNESS - SETUP")
    print("="*50 + "\n")
    
    # 1. Crea cartelle necessarie
    print("📁 Creazione cartelle...")
    instance_path = Path('app/instance')
    instance_path.mkdir(parents=True, exist_ok=True)
    print(f"   ✓ Cartella {instance_path} creata")
    
    # 2. Verifica dipendenze
    print("\n📦 Verifica dipendenze Python...")
    try:
        import flask
        print(f"   ✓ Flask {flask.__version__} installato")
    except ImportError:
        print("   ✗ Flask non trovato. Eseguire: pip install -r requirements.txt")
        return False
    
    # 3. Inizializza database
    print("\n🗄️  Inizializzazione database...")
    from app import create_app
    app = create_app()
    
    with app.app_context():
        from app.db import init_db
        init_db()
        print("   ✓ Database inizializzato")
    
    # 4. Popola dati di esempio
    print("\n💾 Caricamento dati di esempio...")
    os.system('python init_sample_data.py')
    
    # 5. Mostra informazioni
    print("\n" + "="*50)
    print("✅ SETUP COMPLETATO!")
    print("="*50)
    print("\n📝 Prossimi passi:")
    print("   1. Esegui: python run.py")
    print("   2. Apri: http://localhost:5002")
    print("   3. Registrati o accedi")
    print("\n💡 Suggerimenti:")
    print("   - Copia .env.example a .env per personalizzare")
    print("   - Consulta README_NEW.md per la documentazione completa")
    print("   - Prova gli endpoint API con Postman")
    print("\n" + "="*50 + "\n")
    
    return True

if __name__ == '__main__':
    success = setup_project()
    exit(0 if success else 1)
