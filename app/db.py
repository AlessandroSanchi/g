import sqlite3
import click
from flask import current_app, g


def get_db():
    if 'db' not in g:
        g.db = sqlite3.connect(
            current_app.config['DATABASE'],
            detect_types=sqlite3.PARSE_DECLTYPES
        )
        g.db.row_factory = sqlite3.Row
    return g.db


def close_db(e=None):
    db = g.pop('db', None)
    if db is not None:
        db.close()


def init_db():
    db = get_db()
    # schema.sql is located in the package (app/schema.sql)
    with current_app.open_resource('schema.sql') as f:
        sql = f.read()
        if isinstance(sql, bytes):
            sql = sql.decode('utf8')
        db.executescript(sql)


@click.command('init-db')
def init_db_command():
    """Clear existing data and create new tables."""
    init_db()
    click.echo('Initialized the database.')


def init_app(app):
    app.teardown_appcontext(close_db)
    app.cli.add_command(init_db_command)
import sqlite3
from flask import current_app, g

def get_db():
    """Restituisce la connessione al database per la richiesta corrente."""

    if 'db' not in g:
        g.db = sqlite3.connect(
            current_app.config['DATABASE']
        )
        g.db.row_factory = sqlite3.Row

    return g.db

def close_db(e=None):
    """Chiude la connessione alla fine della richiesta."""
    db = g.pop('db', None)

    if db is not None:
        db.close()

def init_app(app):
    """Registra la funzione di chiusura automatica."""
    app.teardown_appcontext(close_db)