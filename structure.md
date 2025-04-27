.
├── .env                                                                      # Stores environment variables (e.g., secrets, database paths) - Not committed to Git
├── .gitignore                                                                # Specifies intentionally untracked files that Git should ignore
├── backend                                                                   # Root directory for the Flask backend application
│   ├── app                                                                   # Main application package for the backend
│   │   ├── api                                                               # Contains Flask Blueprints defining API endpoints
│   │   │   ├── admin_definitions.py                                          # API routes for managing definitions (House Types, Parameters, Panels, Multiwalls, Task
│   │   │   ├── admin_personnel.py                                            # API routes for managing personnel (Workers, Specialties, Admin Team)
│   │   │   ├── admin_projects.py                                             # API routes for managing projects and the production plan/status
│   │   │   └── __init__.py                                                   # Makes the 'api' directory a Python package
│   │   ├── database                                                          # Package for database interactions
│   │   │   ├── connection.py                                                 # Handles establishing and closing the database connection (SQLite)
│   │   │   ├── queries.py                                                    # Contains functions executing specific SQL queries against the database
│   │   │   ├── schema.sql                                                    # SQL script to define the database schema (tables, constraints, initial data)
│   │   │   └── __init__.py                                                   # Makes the 'database' directory a Python package (currently empty)
│   │   ├── main                                                              # Placeholder for core application logic (if needed beyond APIs) - Currently empty
│   │   ├── services                                                          # Placeholder for business logic services (if needed) - Currently empty
│   │   ├── utils                                                             # Placeholder for utility functions (if needed) - Currently empty
│   │   └── __init__.py                                                       # Application factory (__init__.py): Creates and configures the Flask app instance, registers     
blueprints, sets up DB
├── config.py                                                                 # Defines configuration classes for the Flask application (e.g., database URI, secret key)
├── requirements.txt                                                          # Lists Python dependencies for the backend
└── run.py                                                                    # Entry point script to run the Flask development server
├── data                                                                      # Directory to store persistent data (like the database file) - Not committed to Git
│   └── database.db                                                           # The SQLite database file
├── data_dump_excluding_stations.sql                                          # SQL dump file containing data (excluding Stations table)
├── dump.sql                                                                  # SQL dump file containing data (likely including Stations)
├── frontend                                                                  # Root directory for the React frontend application
│   ├── .gitignore                                                            # Specifies intentionally untracked files for the frontend (e.g., node_modules)
│   ├── package-lock.json                                                     # Records exact versions of frontend dependencies
│   ├── package.json                                                          # Defines frontend project metadata, dependencies, and scripts (npm/yarn)
│   ├── public                                                                # Contains static assets served directly by the webserver
│   │   ├── favicon.ico
│   │   ├── index.html                                                        # The main HTML template for the React SPA
│   │   ├── manifest.json                                                     # Web app manifest file (PWA features)
│   │   └── robots.txt                                                        # Instructions for web crawlers
│   ├── src                                                                   # Contains the React application source code
│   │   ├── App.css                                                           # General CSS styles for the main App component
│   │   ├── App.js                                                            # The root component of the React application, defines routing
│   │   ├── App.test.js                                                       # Basic test file for the App component
│   │   ├── components                                                        # Reusable UI components
│   │   │   └── admin                                                         # Components specifically for the Admin Dashboard section
│   │   │       ├── ActiveProductionDashboard.js                              # Component displaying the current state of the production line and upcoming plan
│   │   │       ├── AdminComponentStyles.js                                   # Shared JavaScript-based styles for Admin components
│   │   │       ├── AdminTeamManager.js                                       # Component for managing Admin Team members (CRUD)
│   │   │       ├── HouseParametersManager.js                                 # Component for managing global House Parameter definitions (CRUD)
│   │   │       ├── HouseTypePanelsModal.js                                   # Modal component for managing Panels and Multiwalls within a specific House Type and Module   
│   │   │       ├── HouseTypesManager.js                                      # Component for managing House Types, their Tipologias, and linking Parameters (CRUD)
│   │   │       ├── ProjectsManager.js                                        # Component for managing Projects and their associated House Types (CRUD)
│   │   │       ├── SpecialtiesManager.js                                     # Component for managing Worker Specialties (CRUD)
│   │   │       ├── TaskDefinitionManager.js                                  # Component for managing Task Definitions (CRUD)
│   │   │       └── WorkersManager.js                                         # Component for managing Workers (CRUD)
│   │   ├── index.css                                                         # Global CSS styles applied to the entire application
│   │   ├── index.js                                                          # Entry point for the React application, renders the App component into the DOM
│   │   ├── logo.svg                                                          # Example SVG logo (can be removed/replaced)
│   │   ├── pages                                                             # Components representing distinct pages/views in the application
│   │   │   └── AdminDashboard.js                                             # Page component acting as the layout for the admin section, including navigation
│   │   ├── reportWebVitals.js                                                # Utility for measuring web performance metrics
│   │   ├── services                                                          # Modules for interacting with the backend API
│   │   │   └── adminService.js                                               # Functions for making API calls to the backend admin endpoints
│   │   └── setupTests.js                                                     # Configuration file for React Testing Library / Jest
│   └── README.md                                                             # README file specifically for the frontend (if needed, currently seems empty)
└── ssl                                                                       # Directory likely intended for SSL certificate files (e.g., for HTTPS) - Contents not show
