import React, { useState, useEffect } from 'react';
import { Routes, Route, Link, Navigate, Outlet, useNavigate, useLocation } from 'react-router-dom'; // Import Outlet, useNavigate, useLocation
import './App.css';
import AdminDashboard from './pages/AdminDashboard';
import LoginPage from './pages/LoginPage'; // Import LoginPage
import StationPage from './pages/StationPage'; // Import StationPage
import TaskDefinitionManager from './components/admin/TaskDefinitionManager';
import WorkersManager from './components/admin/WorkersManager';
import HouseTypesManager from './components/admin/HouseTypesManager';
import HouseParametersManager from './components/admin/HouseParametersManager';
import SpecialtiesManager from './components/admin/SpecialtiesManager';
import AdminTeamManager from './components/admin/AdminTeamManager';
import ProjectsManager from './components/admin/ProjectsManager';
import ActiveProductionDashboard from './components/admin/ActiveProductionDashboard'; // Import ActiveProductionDashboard
import StationContextSelector from './components/admin/StationContextSelector'; // Import StationContextSelector
// Import other pages/components as needed

// Basic Nav styling
const navStyle = {
    padding: '10px',
    background: '#f0f0f0',
    marginBottom: '20px',
    borderBottom: '1px solid #ccc'
};

const linkStyle = {
    margin: '0 10px',
    textDecoration: 'none',
    color: '#333'
};

// Key for localStorage, same as in StationContextSelector.js
const STATION_CONTEXT_STORAGE_KEY = 'currentStationSequenceOrder';

function App() {
    const [currentUser, setCurrentUser] = useState(null);
    const [userType, setUserType] = useState(null); // To store 'worker', 'Supervisor', etc.
    const [activeStationSequenceOrder, setActiveStationSequenceOrder] = useState(null);
    const navigate = useNavigate();
    const location = useLocation();

    // Persist user state and load station context on refresh
    useEffect(() => {
        const storedUser = localStorage.getItem('currentUser');
        const storedUserType = localStorage.getItem('userType');
        if (storedUser && storedUserType) {
            setCurrentUser(JSON.parse(storedUser));
            setUserType(storedUserType);
        }

        const storedSequenceOrder = localStorage.getItem(STATION_CONTEXT_STORAGE_KEY);
        if (storedSequenceOrder) {
            setActiveStationSequenceOrder(storedSequenceOrder);
        }
        
        // Listen for changes to station context from other components (e.g. StationContextSelector)
        const handleStorageChange = () => {
            const updatedSequenceOrder = localStorage.getItem(STATION_CONTEXT_STORAGE_KEY);
            setActiveStationSequenceOrder(updatedSequenceOrder);
        };

        window.addEventListener('storage', handleStorageChange);
        // Also check when App mounts or visibility changes, as 'storage' event might not fire for same-page changes in all browsers.
        // For simplicity, we rely on components updating localStorage to also potentially trigger re-renders or context updates.
        // A more robust solution might involve a shared context for station selection.

        return () => {
            window.removeEventListener('storage', handleStorageChange);
        };

    }, []);

    const handleLoginSuccess = (userData, type) => {
        setCurrentUser(userData);
        setUserType(type);
        localStorage.setItem('currentUser', JSON.stringify(userData));
        localStorage.setItem('userType', type);
        // currentStation is already set or can be set here based on login/tablet context
    };

    const handleLogout = () => {
        setCurrentUser(null);
        setUserType(null);
        localStorage.removeItem('currentUser');
        localStorage.removeItem('userType');
        navigate('/'); // Navigate to login page after logout
    };

    // Determine if admin panel should be shown based on user type
    // Admin panel link is always visible, access control can be handled by routes/components if needed later.
    // For now, the requirement is visibility.
    return (
        <div className="App">
            <nav style={navStyle}>
                <Link to="/" style={linkStyle}>Inicio</Link>
                <Link to="/admin" style={linkStyle}>Panel de Administración</Link>
                {currentUser && (
                    <button onClick={handleLogout} style={{ ...linkStyle, background: 'none', border: 'none', cursor: 'pointer', color: '#333' }}>
                        Cerrar Sesión ({currentUser.first_name}) ({userType})
                    </button>
                )}
            </nav>

            <Routes>
                <Route
                    path="/"
                    element={
                        currentUser ? (
                            <Navigate to="/station" replace />
                        ) : (
                            <LoginPage onLoginSuccess={handleLoginSuccess} />
                        )
                    }
                />
                <Route
                    path="/station"
                    element={
                        currentUser ? (
                            <StationPage user={currentUser} activeStationSequenceOrder={activeStationSequenceOrder} />
                        ) : (
                            <Navigate to="/" replace />
                        )
                    }
                />

                {/* Admin Route - Always defined, visibility of link is handled above */}
                <Route path="/admin" element={<AdminDashboard />}>
                    <Route path="definitions" element={<TaskDefinitionManager />} />
                    <Route path="workers" element={<WorkersManager />} />
                    <Route path="house-types" element={<HouseTypesManager />} />
                    <Route path="house-parameters" element={<HouseParametersManager />} />
                    <Route path="specialties" element={<SpecialtiesManager />} />
                    <Route path="admin-team" element={<AdminTeamManager />} />
                    <Route path="projects" element={<ProjectsManager />} />
                    <Route path="production-status" element={<ActiveProductionDashboard />} />
                    <Route path="station-context" element={<StationContextSelector />} />
                    <Route index element={
                        <div>
                            <h1 style={{ marginBottom: '20px', borderBottom: '1px solid #eee', paddingBottom: '10px', marginTop: 0 }}>Panel de Administración</h1>
                            <p>Seleccione una opción del menú para gestionar la configuración del sistema o ver el estado de producción.</p>
                        </div>
                    } />
                </Route>
                {/* Catch-all for not found routes */}
                <Route path="*" element={
                    <div>
                        <h2>Página No Encontrada</h2>
                        <Link to="/">Ir a Inicio</Link>
                    </div>
                } />
            </Routes>
        </div>
    );
}

export default App;
