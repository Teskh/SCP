import os
import os
from flask import Flask
from flask_cors import CORS
from .database.connection import init_db_command
# config.py is in the parent directory (backend/), so import it directly
from config import AppConfig

def create_app(config_class=AppConfig):
    """Creates and configures the Flask application."""
    app = Flask(__name__, static_folder='../../frontend/build', static_url_path='/')
    app.config.from_object(config_class)

    # Enable CORS for all domains on all routes. For development purposes.
    # TODO: Restrict CORS origins in production.
    CORS(app, resources={r"/api/*": {"origins": "*"}}) # Allow frontend dev server

    # Initialize database
    try:
        # Ensure the data directory exists
        data_dir = os.path.join(os.path.dirname(os.path.dirname(app.root_path)), 'data')
        os.makedirs(data_dir, exist_ok=True)
        with app.app_context():
            init_db_command() # Initialize DB if needed
    except Exception as e:
        app.logger.error(f"Database initialization failed: {e}")


    # Register blueprints
    from .api.admin import admin_bp
    app.register_blueprint(admin_bp, url_prefix='/api/admin')

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
