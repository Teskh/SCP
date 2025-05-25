import os
import sqlite3
from flask import Flask, current_app
from flask_cors import CORS
from .database.connection import init_db, get_db # Import init_db and get_db directly
# config.py is in the parent directory (backend/), so import it directly
from config import AppConfig

def create_app(config_class=AppConfig):
    """Creates and configures the Flask application."""
    app = Flask(__name__, static_folder='../../frontend/build', static_url_path='/')
    app.config.from_object(config_class)

    CORS(app, resources={r"/api/*": {"origins": "*"}}) # Allow frontend dev server

    # Initialize database check and creation logic
    try:
        # Ensure the data directory exists
        data_dir = os.path.join(os.path.dirname(os.path.dirname(app.root_path)), 'data')
        os.makedirs(data_dir, exist_ok=True)

        # Perform DB initialization check directly here, within app context
        with app.app_context():
            db_path = current_app.config['DATABASE_URI'].replace('sqlite:///', '')
            needs_init = False
            if not os.path.exists(db_path):
                app.logger.info(f"Database file not found at {db_path}. Will initialize.")
                needs_init = True
            else:
                # Check if tables exist if DB file exists
                try:
                    db = get_db() # Get DB connection within context
                    cursor = db.cursor()
                    # Check for a key table (e.g., Workers)
                    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='Workers';")
                    if cursor.fetchone() is None:
                        app.logger.info("Tables not found in existing database. Will initialize schema.")
                        needs_init = True
                    # else:
                    #     app.logger.debug("Database schema appears initialized.")
                except sqlite3.Error as e:
                    app.logger.error(f"Error checking database schema: {e}. Will attempt to initialize.")
                    needs_init = True
                # Connection is managed by the app context (get_db/close_db)

            if needs_init:
                try:
                    init_db() # Call the actual initialization function directly
                    app.logger.info("Database initialized successfully.")
                except Exception as init_e:
                     app.logger.error(f"Database initialization failed during init_db call: {init_e}", exc_info=True)
                     # Optionally re-raise to halt app creation if DB is critical
                     # raise init_e

    except Exception as e:
        # Catch errors during path creation or app_context setup
        app.logger.error(f"Database setup failed: {e}", exc_info=True)
        # Optionally re-raise to halt app creation
        # raise e

    # Register database commands (like 'flask init-db') and teardown
    from .database import connection
    connection.init_app(app) # Registers init_db_command for CLI and close_db

    # Register blueprints
    # Import the individual blueprints from their respective files
    from .api.admin_personnel import admin_personnel_bp
    from .api.admin_projects import admin_projects_bp
    from .api.admin_definitions import admin_definitions_bp
    from .api.auth import auth_bp # Import the new auth blueprint

    # Register each blueprint with the same URL prefix
    app.register_blueprint(admin_personnel_bp, url_prefix='/api/admin')
    app.register_blueprint(admin_projects_bp, url_prefix='/api/admin')
    app.register_blueprint(admin_definitions_bp, url_prefix='/api/admin')
    app.register_blueprint(auth_bp, url_prefix='/api/auth') # Register the auth blueprint
    # Add other blueprints here later (worker, etc.)

    # Serve React App
    @app.route('/', defaults={'path': ''})
    @app.route('/<path:path>')
    def serve(path):
        if path != "" and os.path.exists(os.path.join(app.static_folder, path)):
            return app.send_static_file(path)
        else:
            # Check if index.html exists before sending
            index_path = os.path.join(app.static_folder, 'index.html')
            if os.path.exists(index_path):
                return app.send_static_file('index.html')
            else:
                # Provide a fallback or error if index.html is missing
                # This might happen before the first frontend build
                return "React app not built yet. Run 'npm run build' in the frontend directory.", 404


    # Add a simple health check endpoint
    @app.route('/health')
    def health_check():
        return "OK", 200

    return app
