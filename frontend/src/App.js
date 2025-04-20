import React from 'react';
import { Routes, Route, Link, Navigate, Outlet } from 'react-router-dom'; // Import Outlet
import './App.css';
import AdminDashboard from './pages/AdminDashboard';
import DefinitionsManager from './components/admin/DefinitionsManager';
import WorkersManager from './components/admin/WorkersManager';
import HouseTypesManager from './components/admin/HouseTypesManager'; // Import new component
import HouseParametersManager from './components/admin/HouseParametersManager'; // Import new component
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


function App() {
  // For now, basic navigation. Auth context will control this later.
  return (
    <div className="App">
        {/* Simple Navigation - Replace with a proper NavBar component later */}
        <nav style={navStyle}>
            <Link to="/" style={linkStyle}>Home (Placeholder)</Link>
            <Link to="/admin" style={linkStyle}>Admin Dashboard</Link>
            {/* Add links for Worker View, Login/Logout later */}
        </nav>

        <Routes>
             {/* Default route could redirect or show a landing page */}
            <Route path="/" element={
                <div>
                    <h2>Welcome to Production Tracker</h2>
                    <p>Select an area from the navigation above.</p>
                    {/* Or redirect immediately: <Navigate replace to="/admin" /> */}
                </div>
            } />

            {/* Admin Route - Now uses nested routes */}
            <Route path="/admin" element={<AdminDashboard />}>
                 {/* Child routes rendered by Outlet in AdminDashboard */}
                 <Route path="definitions" element={<DefinitionsManager />} />
                 <Route path="workers" element={<WorkersManager />} />
                 {/* Index route for /admin (optional, shows welcome message) */}
                 {/* <Route index element={<div>Select an admin section</div>} /> */}
                 {/* Add other admin sub-routes here */}
            </Route>

            {/* Define other top-level routes here later */}
            {/* <Route path="/worker" element={<WorkerDashboard />} /> */}
            {/* <Route path="/login" element={<LoginPage />} /> */}

            {/* Catch-all for not found routes */}
            <Route path="*" element={<div><h2>Page Not Found</h2><Link to="/">Go Home</Link></div>} />
        </Routes>
    </div>
  );
}

export default App;
