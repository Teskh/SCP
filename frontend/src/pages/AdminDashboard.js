import React from 'react';
import SpecialtiesManager from '../components/admin/SpecialtiesManager';
import TaskDefinitionManager from '../components/admin/TaskDefinitionManager';

// Basic styling for layout
const styles = {
    dashboard: { padding: '20px' },
    header: { marginBottom: '30px', borderBottom: '1px solid #eee', paddingBottom: '10px' },
    section: { marginBottom: '40px' } // Add space between manager components
};

function AdminDashboard() {
    return (
        <div style={styles.dashboard}>
            <h1 style={styles.header}>Admin Dashboard</h1>

            <div style={styles.section}>
                <TaskDefinitionManager />
            </div>

            <div style={styles.section}>
                <SpecialtiesManager />
            </div>

            {/* Add other admin components here later (Workers, Projects, etc.) */}
        </div>
    );
}

export default AdminDashboard;
