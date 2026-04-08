import os
from flask import Flask

def create_app():
    # 1. Creiamo l'istanza di Flask
    # instance_relative_config=True dice a Flask: 
    # "Cerca la cartella 'instance' fuori da 'app', non dentro."
    app = Flask(__name__, instance_relative_config=True)

    app.config.from_mapping(
        # SECRET_KEY serve a Flask per firmare i dati sicuri (es. sessioni).
        # 'dev' va bene per sviluppare, ma in produzione andrà cambiata.
        SECRET_KEY='dev',
    # Diciamo a Flask dove salvare il file del database SQLite
    DATABASE=os.path.join(app.instance_path, 'game.sqlite'),
    )
    # Ensure the instance folder exists
    try:
        os.makedirs(app.instance_path, exist_ok=True)
    except OSError:
        pass
    # --- AGGIUNGI QUESTO ---
    from . import db
    db.init_app(app)
   # -----------------------
    from . import main
    # Register blueprints defined in app.main
    if hasattr(main, 'auth_bp'):
        app.register_blueprint(main.auth_bp)
    if hasattr(main, 'game_bp'):
        app.register_blueprint(main.game_bp)
    if hasattr(main, 'api_bp'):
        app.register_blueprint(main.api_bp)

    return app