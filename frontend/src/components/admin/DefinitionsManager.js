import React from 'react';
import SpecialtiesManager from './SpecialtiesManager';
import TaskDefinitionManager from './TaskDefinitionManager';

// Basic styling for layout within this section
const styles = {
    container: { padding: '0 20px' }, // Add some padding if needed
    header: { marginTop: '0', marginBottom: '20px', borderBottom: '1px solid #eee', paddingBottom: '10px' },
    section: { marginBottom: '40px' }
};

function DefinitionsManager() {
    return (
        <div style={styles.container}>
            <h2 style={styles.header}>Manage Definitions</h2>

            <div style={styles.section}>
                <TaskDefinitionManager />
            </div>

            <div style={styles.section}>
                <SpecialtiesManager />
            </div>
        </div>
    );
}

export default DefinitionsManager;
