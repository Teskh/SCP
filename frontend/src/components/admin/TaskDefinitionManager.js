import React, { useState, useEffect, useCallback } from 'react';
import * as adminService from '../../services/adminService';

// Basic styling
const styles = {
    container: { margin: '20px', padding: '20px', border: '1px solid #ccc', borderRadius: '8px' },
    table: { width: '100%', borderCollapse: 'collapse', marginTop: '15px' },
    th: { border: '1px solid #ddd', padding: '8px', backgroundColor: '#f2f2f2', textAlign: 'left' },
    td: { border: '1px solid #ddd', padding: '8px', verticalAlign: 'top' }, // Align top for better readability if desc is long
    button: { marginLeft: '5px', cursor: 'pointer', padding: '5px 10px' },
    form: { marginBottom: '20px', padding: '15px', border: '1px solid #eee', borderRadius: '5px', display: 'flex', flexDirection: 'column', gap: '10px' },
    formRow: { display: 'flex', gap: '10px', alignItems: 'center' },
    label: { minWidth: '100px', textAlign: 'right' },
    input: { padding: '8px', border: '1px solid #ccc', borderRadius: '4px', flexGrow: 1 },
    select: { padding: '8px', border: '1px solid #ccc', borderRadius: '4px', flexGrow: 1 },
    textarea: { padding: '8px', border: '1px solid #ccc', borderRadius: '4px', flexGrow: 1, minHeight: '60px' },
    error: { color: 'red', marginTop: '10px' },
    loading: { fontStyle: 'italic' }
};

const initialFormState = {
    name: '',
    description: '',
    module_type_id: '', // Use empty string for 'None' option
    specialty_id: '',   // Use empty string for 'None' option
    station_id: '',     // Use empty string for 'None' option
};

function TaskDefinitionManager() {
    const [taskDefs, setTaskDefs] = useState([]);
    const [moduleTypes, setModuleTypes] = useState([]);
    const [specialties, setSpecialties] = useState([]);
    const [stations, setStations] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [editMode, setEditMode] = useState(null); // null or task_definition_id
    const [formData, setFormData] = useState(initialFormState);

    // Fetch all necessary data (task defs and related entities for dropdowns)
    const fetchData = useCallback(async () => {
        setIsLoading(true);
        setError('');
        try {
            const [defsData, typesData, specsData, stationsData] = await Promise.all([
                adminService.getTaskDefinitions(),
                adminService.getModuleTypes(),
                adminService.getSpecialties(), // Reuse specialty fetch
                adminService.getStations()
            ]);
            setTaskDefs(defsData);
            setModuleTypes(typesData);
            setSpecialties(specsData);
            setStations(stationsData);
        } catch (err) {
            setError(err.message || 'Failed to fetch data');
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleEdit = (taskDef) => {
        setEditMode(taskDef.task_definition_id);
        setFormData({
            name: taskDef.name || '',
            description: taskDef.description || '',
            // Ensure IDs are strings for select value matching, handle nulls
            module_type_id: taskDef.module_type_id?.toString() || '',
            specialty_id: taskDef.specialty_id?.toString() || '',
            station_id: taskDef.station_id || '', // station_id is TEXT
        });
        window.scrollTo(0, 0); // Scroll to top to see the form
    };

    const handleCancelEdit = () => {
        setEditMode(null);
        setFormData(initialFormState);
        setError('');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        // Convert empty strings back to null for IDs if necessary, or handle in service
        const payload = {
            ...formData,
            module_type_id: formData.module_type_id || null,
            specialty_id: formData.specialty_id || null,
            station_id: formData.station_id || null,
        };

        try {
            if (editMode) {
                await adminService.updateTaskDefinition(editMode, payload);
            } else {
                await adminService.addTaskDefinition(payload);
            }
            handleCancelEdit();
            await fetchData(); // Refresh list and related data
        } catch (err) {
            setError(err.message || `Failed to ${editMode ? 'update' : 'add'} task definition`);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm('Are you sure you want to delete this task definition?')) {
            setError('');
            setIsLoading(true); // Prevent other actions during delete
            try {
                await adminService.deleteTaskDefinition(id);
                await fetchData(); // Refresh list
            } catch (err) {
                setError(err.message || 'Failed to delete task definition');
            } finally {
                 setIsLoading(false);
            }
        }
    };

    return (
        <div style={styles.container}>
            <h2>Manage Task Definitions</h2>
            {error && <p style={styles.error}>{error}</p>}

            <form onSubmit={handleSubmit} style={styles.form}>
                 <h3>{editMode ? 'Edit Task Definition' : 'Add New Task Definition'}</h3>
                 <div style={styles.formRow}>
                     <label style={styles.label} htmlFor="taskName">Name:</label>
                     <input
                         id="taskName"
                         type="text"
                         name="name"
                         placeholder="Task Name (e.g., Install Window Frame)"
                         value={formData.name}
                         onChange={handleInputChange}
                         required
                         style={styles.input}
                     />
                 </div>
                 <div style={styles.formRow}>
                     <label style={styles.label} htmlFor="taskDesc">Description:</label>
                     <textarea
                         id="taskDesc"
                         name="description"
                         placeholder="Detailed description (Optional)"
                         value={formData.description}
                         onChange={handleInputChange}
                         style={styles.textarea}
                     />
                 </div>
                 <div style={styles.formRow}>
                     <label style={styles.label} htmlFor="moduleType">Module Type:</label>
                     <select
                         id="moduleType"
                         name="module_type_id"
                         value={formData.module_type_id}
                         onChange={handleInputChange}
                         style={styles.select}
                     >
                         <option value="">-- Optional: Select Module Type --</option>
                         {moduleTypes.map(mt => (
                             <option key={mt.module_type_id} value={mt.module_type_id}>
                                 {mt.name}
                             </option>
                         ))}
                     </select>
                 </div>
                 <div style={styles.formRow}>
                     <label style={styles.label} htmlFor="specialty">Specialty:</label>
                     <select
                         id="specialty"
                         name="specialty_id"
                         value={formData.specialty_id}
                         onChange={handleInputChange}
                         style={styles.select}
                     >
                         <option value="">-- Optional: Select Specialty --</option>
                         {specialties.map(spec => (
                             <option key={spec.specialty_id} value={spec.specialty_id}>
                                 {spec.name}
                             </option>
                         ))}
                     </select>
                 </div>
                 <div style={styles.formRow}>
                     <label style={styles.label} htmlFor="station">Station:</label>
                     <select
                         id="station"
                         name="station_id"
                         value={formData.station_id}
                         onChange={handleInputChange}
                         style={styles.select}
                     >
                         <option value="">-- Optional: Select Station --</option>
                         {stations.map(st => (
                             <option key={st.station_id} value={st.station_id}>
                                 {st.station_id} - {st.name}
                             </option>
                         ))}
                     </select>
                 </div>
                 <div>
                     <button type="submit" disabled={isLoading} style={styles.button}>
                         {isLoading ? 'Saving...' : (editMode ? 'Update Task Definition' : 'Add Task Definition')}
                     </button>
                     {editMode && (
                         <button type="button" onClick={handleCancelEdit} style={styles.button} disabled={isLoading}>
                             Cancel
                         </button>
                     )}
                 </div>
            </form>

            {isLoading && !taskDefs.length ? <p style={styles.loading}>Loading task definitions...</p> : (
                <table style={styles.table}>
                    <thead>
                        <tr>
                            <th style={styles.th}>Name</th>
                            <th style={styles.th}>Description</th>
                            <th style={styles.th}>Module Type</th>
                            <th style={styles.th}>Specialty</th>
                            <th style={styles.th}>Station</th>
                            <th style={styles.th}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {taskDefs.map((td) => (
                            <tr key={td.task_definition_id}>
                                <td style={styles.td}>{td.name}</td>
                                <td style={styles.td}>{td.description}</td>
                                <td style={styles.td}>{td.module_type_name || 'N/A'}</td>
                                <td style={styles.td}>{td.specialty_name || 'N/A'}</td>
                                <td style={styles.td}>{td.station_name ? `${td.station_id} (${td.station_name})` : (td.station_id || 'N/A')}</td>
                                <td style={styles.td}>
                                    <button onClick={() => handleEdit(td)} style={styles.button} disabled={isLoading}>Edit</button>
                                    <button onClick={() => handleDelete(td.task_definition_id)} style={styles.button} disabled={isLoading}>Delete</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
            { !isLoading && taskDefs.length === 0 && <p>No task definitions found.</p>}
        </div>
    );
}

export default TaskDefinitionManager;
