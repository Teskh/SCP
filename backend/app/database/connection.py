import sqlite3
import os
import click
from flask import current_app, g
from flask.cli import with_appcontext

def get_db():
    """Connects to the application's configured database. The connection
    is unique for each request and will be reused if this is called
    again.
    """
    if 'db' not in g:
        db_path = current_app.config['DATABASE_URI'].replace('sqlite:///', '')
        # Ensure the directory exists
        db_dir = os.path.dirname(db_path)
        if db_dir: # Check if db_dir is not empty (i.e., not just root)
             os.makedirs(db_dir, exist_ok=True)

        g.db = sqlite3.connect(
            db_path,
            detect_types=sqlite3.PARSE_DECLTYPES
        )
        g.db.row_factory = sqlite3.Row # Return rows that behave like dicts

    return g.db

def close_db(e=None):
    """Closes the database connection."""
    db = g.pop('db', None)

    if db is not None:
        db.close()

def init_db():
    """Initializes the database using schema.sql."""
    db = get_db()
    schema_path = os.path.join(os.path.dirname(__file__), 'schema.sql')
    with open(schema_path, 'r') as f:
        db.executescript(f.read())
    print("Database initialized.")


@click.command('init-db')
@with_appcontext
def init_db_command():
    """Clear existing data and create new tables."""
    db_path = current_app.config['DATABASE_URI'].replace('sqlite:///', '')
    if not os.path.exists(db_path):
        print(f"Database file not found at {db_path}. Initializing...")
        init_db()
    else:
        # Optional: Add logic here if you want to re-initialize even if it exists
        # For now, we just print that it exists.
        # print(f"Database already exists at {db_path}.")
        # Check if tables exist, if not, initialize
        db = get_db()
        cursor = db.cursor()
        try:
            # Check if a key table exists
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='Workers';")
            if cursor.fetchone() is None:
                print("Tables not found in existing database. Initializing schema...")
                init_db()
            # else:
            #     print("Tables found. Database schema appears initialized.")
        except sqlite3.Error as e:
            print(f"Error checking database schema: {e}")
            print("Attempting to initialize schema...")
            init_db()
        finally:
            # The connection is managed by get_db/close_db via app context
            pass


def init_app(app):
    """Register database functions with the Flask app. This is called by
    the application factory.
    """
    app.teardown_appcontext(close_db) # Call close_db when cleaning up after returning the response
    app.cli.add_command(init_db_command) # Add the init-db command
