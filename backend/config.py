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


AppConfig = Config