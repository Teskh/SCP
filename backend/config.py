import os

# Get the absolute path of the directory where this file is located
basedir = os.path.abspath(os.path.dirname(__file__))
# Construct the path to the parent directory (the project root)
project_root = os.path.dirname(basedir)
# Define the database path relative to the project root
DATABASE_PATH = os.path.join(project_root, 'data', 'database.db')

class Config:
    """Base configuration."""
    SECRET_KEY = os.environ.get('SECRET_KEY', 'you-should-really-change-this')
    DATABASE_URI = f'sqlite:///{DATABASE_PATH}'
    # Disable modification tracking for SQLAlchemy if not needed, reduces overhead
    SQLALCHEMY_TRACK_MODIFICATIONS = False # Although we are not using SQLAlchemy yet, good practice

    # Default path for the external projects database, relative to the 'backend' directory's parent
    # e.g., if backend is /app/backend/, this will resolve to /app/2025.03.04 SPGXI/projects.db
    DEFAULT_EXTERNAL_PROJECTS_DB_PATH = os.path.join(project_root, '..', '2025.03.04 SPGXI', 'projects.db')
    EXTERNAL_PROJECTS_DB_PATH = os.environ.get('EXTERNAL_EXTERNAL_PROJECTS_DB_PATH', DEFAULT_EXTERNAL_PROJECTS_DB_PATH)

    # Default path for the main database, relative to the 'backend' directory's parent
    DEFAULT_MAIN_DB_PATH = os.path.join(project_root, '..', 'main.db')
    MAIN_DB_PATH = os.environ.get('EXTERNAL_MAIN_DB_PATH', DEFAULT_MAIN_DB_PATH)


AppConfig = Config
