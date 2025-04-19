production-tracker/
│
├── backend/                      # Flask backend application
│   ├── app/                      # Core application package
│   │   ├── __init__.py           # Application factory (create_app function)
│   │   │
│   │   ├── api/                  # API Blueprints/routes
│   │   │   ├── __init__.py
│   │   │   ├── auth.py           # Login (PIN, QR), logout endpoints
│   │   │   ├── worker.py         # Endpoints for the worker view (get module, tasks, complete)
│   │   │   ├── admin.py          # Endpoints specifically for the admin panel (CRUD operations)
│   │   │   └── modules.py        # Endpoints for module state and movement
│   │   │
│   │   ├── services/             # Business logic layer (optional, good practice)
│   │   │   ├── __init__.py
│   │   │   ├── task_service.py
│   │   │   ├── module_service.py
│   │   │   └── user_service.py
│   │   │
│   │   ├── database/             # Database interaction layer
│   │   │   ├── __init__.py
│   │   │   ├── connection.py     # Setup/manage SQLite connection & session/context
│   │   │   ├── schema.sql        # SQL schema definition
│   │   │   ├── queries.py        # Or models.py if using an ORM like SQLAlchemy
│   │   │
│   │   ├── utils/                # Shared utility functions for the backend
│   │   │   ├── __init__.py
│   │   │   └── helpers.py
│   │   │
│   │   └── main/                 # Blueprint for serving the SPA and potentially other core routes
│   │       ├── __init__.py
│   │       └── routes.py         # Route(s) to serve React's index.html
│   │
│   ├── config.py                 # Flask configuration (database URI, secret key, etc.)
│   ├── run.py                    # Entry point to run the Flask app (e.g., for development server)
│   └── requirements.txt          # Backend Python dependencies
│
├── frontend/                     # React SPA frontend application
│   ├── public/                   # Static assets (favicon, manifest.json, index.html template)
│   │   └── index.html            # HTML shell for the React app
│   │
│   ├── src/                      # React source code
│   │   ├── index.js              # Main entry point, renders App component
│   │   ├── App.js                # Root application component, sets up routing
│   │   │
│   │   ├── assets/               # Static assets processed by build tool (CSS, images, fonts)
│   │   │   └── styles/
│   │   │
│   │   ├── components/           # Reusable UI components
│   │   │   ├── common/           # Buttons, Modals, Loaders etc.
│   │   │   ├── worker/           # Worker-specific: TaskList, TaskItem, ModuleInfo
│   │   │   ├── admin/            # Admin-specific: UserTable, TaskEditor, ModuleManager
│   │   │   └── auth/             # LoginForm, PinPad, QrScanner (if used)
│   │   │
│   │   ├── contexts/             # React Context API providers/consumers (for state sharing if needed)
│   │   │   └── AuthContext.js    # Example: Managing logged-in user state
│   │   │
│   │   ├── hooks/                # Custom React hooks (e.g., useFetch, useAuth)
│   │   │
│   │   ├── pages/                # Top-level page/screen components (routed views)
│   │   │   ├── WorkerDashboard.js
│   │   │   ├── AdminDashboard.js
│   │   │   ├── LoginPage.js
│   │   │   └── NotFoundPage.js
│   │   │
│   │   ├── services/             # Frontend services (API communication)
│   │   │   ├── api.js            # Base API client setup (Axios instance or fetch wrapper)
│   │   │   ├── authService.js
│   │   │   ├── taskService.js
│   │   │   ├── moduleService.js
│   │   │   └── adminService.js
│   │   │
│   │   ├── router/               # Frontend routing configuration (using React Router)
│   │   │   └── index.js
│   │   │
│   │   └── utils/                # Shared utility functions for the frontend
│   │       └── helpers.js
│   │
│   ├── build/                    # React build output (generated, add to .gitignore) - IMPORTANT
│   │
│   ├── package.json              # Frontend dependencies and scripts (build, start, test)
│   └── jsconfig.json             # Or tsconfig.json if using TypeScript
│
├── data/                         # Runtime data (add to .gitignore)
│   └── database.db               # The SQLite database file
│
├── scripts/                      # Helper scripts
│   └── setup_database.py         # Script to initialize DB
│
├── ssl/                          # SSL certificates (add to .gitignore) - For HTTPS
│   ├── certificate.crt           # Placeholder
│   └── private.key               # Placeholder
│
├── .gitignore                    # Ignore node_modules, data/, backend/__pycache__, frontend/build/, ssl/, .env etc.
├── gunicorn_config.py            # Configuration for Gunicorn (workers, binding, SSL settings) - For Deployment
└── README.md                     # Project overview, setup, deployment instructions