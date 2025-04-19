import os
from app import create_app

# Load environment variables if using a .env file (optional)
# from dotenv import load_dotenv
# load_dotenv()

app = create_app()

if __name__ == '__main__':
    # Use environment variables for host and port if available, otherwise default
    host = os.environ.get('FLASK_RUN_HOST', '127.0.0.1')
    port = int(os.environ.get('FLASK_RUN_PORT', 5001)) # Use 5001 to avoid conflict with React's 3000
    debug = os.environ.get('FLASK_DEBUG', 'True').lower() == 'true' # Default to debug mode

    print(f" * Starting Flask server on http://{host}:{port}")
    print(f" * Debug mode: {'on' if debug else 'off'}")

    # Note: For production, use a WSGI server like Gunicorn or Waitress
    # Example: gunicorn -w 4 -b 0.0.0.0:5001 run:app
    app.run(host=host, port=port, debug=debug)
