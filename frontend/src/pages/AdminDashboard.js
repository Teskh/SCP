import React from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';

// Basic styling for layout and navigation
const styles = {
    dashboard: { display: 'flex' },
    nav: {
        width: '200px',
        borderRight: '1px solid #ccc',
        padding: '20px',
        height: 'calc(100vh - 80px)', // Adjust based on header/footer height
        background: '#f8f8f8'
    },
    navList: { listStyle: 'none', padding: 0, margin: 0 },
    navItem: { marginBottom: '10px' },
    navLink: {
        textDecoration: 'none',
        color: '#337ab7',
        padding: '8px 12px',
        display: 'block',
        borderRadius: '4px',
    },
    navLinkActive: {
        backgroundColor: '#e7e7e7',
        fontWeight: 'bold',
        color: '#333',
    },
    content: {
        flexGrow: 1,
        padding: '20px',
        overflowY: 'auto', // Allow content scrolling
        height: 'calc(100vh - 80px)', // Match nav height
    },
    header: { marginBottom: '20px', borderBottom: '1px solid #eee', paddingBottom: '10px', marginTop: 0 },
};

function AdminDashboard() {
    const location = useLocation(); // Get current location for active link styling

    // Helper to check if a path is active
    const isActive = (path) => location.pathname === path || location.pathname.startsWith(path + '/');

    return (
        <div style={styles.dashboard}>
            <nav style={styles.nav}>
                <h2 style={{...styles.header, borderBottom: 'none', marginBottom: '20px'}}>Admin Menu</h2>
                <ul style={styles.navList}>
                    <li style={styles.navItem}>
                        <Link
                            to="/admin/definitions"
                            style={{
                                ...styles.navLink,
                                ...(isActive('/admin/definitions') ? styles.navLinkActive : {})
                            }}
                        >
                            Definitions
                        </Link>
                    </li>
                    <li style={styles.navItem}>
                        <Link
                            to="/admin/workers"
                            style={{
                                ...styles.navLink,
                                ...(isActive('/admin/workers') ? styles.navLinkActive : {})
                            }}
                        >
                            Workers
                        </Link>
                    </li>
                    {/* Add links for Projects, Production Planning etc. later */}
                </ul>
            </nav>
            <main style={styles.content}>
                 {/* Render the matched child route component here */}
                 {location.pathname === '/admin' || location.pathname === '/admin/' ? (
                    <div>
                        <h1 style={styles.header}>Admin Dashboard</h1>
                        <p>Select an option from the menu to manage system settings.</p>
                    </div>
                 ) : (
                    <Outlet />
                 )}
            </main>
        </div>
    );
}

export default AdminDashboard;
