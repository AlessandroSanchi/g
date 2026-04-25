import os
from flask import Flask

def create_app():
    # Crea l'istanza Flask con percorsi corretti per template e static
    app = Flask(__name__, 
                instance_relative_config=True,
                template_folder=os.path.join(os.path.dirname(__file__), 'templates'),
                static_folder=os.path.join(os.path.dirname(__file__), 'static'))

    app.config.from_mapping(
        SECRET_KEY=os.environ.get('FLASK_SECRET_KEY', 'dev-secret-key-change-me'),
        DATABASE=os.path.join(app.instance_path, 'game.sqlite'),
    )
    
    # Assicura che la cartella instance esista
    try:
        os.makedirs(app.instance_path, exist_ok=True)
    except OSError:
        pass
    
    # Inizializza il database
    from . import db
    db.init_app(app)
    
    # Importa e registra i blueprint
    from . import main
    app.register_blueprint(main.auth_bp)
    app.register_blueprint(main.game_bp)
    app.register_blueprint(main.profile_bp)
    app.register_blueprint(main.api_bp)
    
    # Inizializza le tabelle del database
    with app.app_context():
        db.init_db()

    return app