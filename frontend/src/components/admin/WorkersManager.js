import React, { useState, useEffect, useCallback } from 'react';
import * as adminService from '../../services/adminService';

// Basic styling (similar to other managers)
const styles = {
    container: { margin: '20px', padding: '20px', border: '1px solid #ccc', borderRadius: '8px' },
    table: { width: '100%', borderCollapse: 'collapse', marginTop: '15px' },
    th: { border: '1px solid #ddd', padding: '8px', backgroundColor: '#f2f2f2', textAlign: 'left' },
    td: { border: '1px solid #ddd', padding: '8px', verticalAlign: 'top' },
    button: { marginLeft: '5px', cursor: 'pointer', padding: '5px 10px' },
    form: { marginBottom: '20px', padding: '15px', border: '1px solid #eee', borderRadius: '5px', display: 'flex', flexDirection: 'column', gap: '10px' },
    formRow: { display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }, // Allow wrapping for smaller screens
    label: { minWidth: '100px', textAlign: 'right' },
    input: { padding: '8px', border: '1px solid #ccc', borderRadius: '4px', flexGrow: 1, minWidth: '150px' }, // Min width for inputs
    select: { padding: '8px', border: '1px solid #ccc', borderRadius: '4px', flexGrow: 1, minWidth: '150px' },
    checkboxLabel: { display: 'flex', alignItems: 'center', gap: '5px', minWidth: '100px' },
    error: { color: 'red', marginTop: '10px' },
    loading: { fontStyle: 'italic' }
};

const initialFormState = {
    first_name: '',
    last_name: '',
    pin: '',
    specialty_id: '',
    supervisor_id: '',
    is_active: true,
};

function WorkersManager() {
    const [workers, setWorkers] = useState([]);
    const [specialties, setSpecialties] = useState([]);
    const [supervisors, setSupervisors] = useState([]); // List of potential supervisors (other workers)
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [editMode, setEditMode] = useState(null); // null or worker_id
    const [formData, setFormData] = useState(initialFormState);

    // Fetch all necessary data
    const fetchData = useCallback(async () => {
        setIsLoading(true);
        setError('');
        try {
            const [workersData, specialtiesData] = await Promise.all([
                adminService.getWorkers(),
                adminService.getSpecialties() // Needed for dropdown
            ]);
            setWorkers(workersData);
            setSpecialties(specialtiesData);
            // Prepare supervisor list (all workers) - will filter later during edit
            setSupervisors(workersData.map(w => ({ id: w.worker_id, name: `${w.first_name} ${w.last_name}` })));
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
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleEdit = (worker) => {
        setEditMode(worker.worker_id);
        setFormData({
            first_name: worker.first_name || '',
            last_name: worker.last_name || '',
            pin: worker.pin || '', // Be cautious about displaying/editing PINs directly
            specialty_id: worker.specialty_id?.toString() || '',
            supervisor_id: worker.supervisor_id?.toString() || '',
            is_active: worker.is_active ?? true, // Default to true if null/undefined
        });
        // Update supervisor dropdown options to exclude the worker being edited
        setSupervisors(workers
            .filter(w => w.worker_id !== worker.worker_id)
            .map(w => ({ id: w.worker_id, name: `${w.first_name} ${w.last_name}` }))
        );
        window.scrollTo(0, 0); // Scroll to form
    };

    const handleCancelEdit = () => {
        setEditMode(null);
        setFormData(initialFormState);
        setError('');
        // Reset supervisor list to all workers
        setSupervisors(workers.map(w => ({ id: w.worker_id, name: `${w.first_name} ${w.last_name}` })));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        // Basic PIN validation (e.g., length) - enhance as needed
        if (formData.pin.length < 4) {
             setError('PIN must be at least 4 digits.');
             setIsLoading(false);
             return;
        }

        const payload = {
            ...formData,
            specialty_id: formData.specialty_id || null,
            supervisor_id: formData.supervisor_id || null,
        };

        try {
            if (editMode) {
                await adminService.updateWorker(editMode, payload);
            } else {
                await adminService.addWorker(payload);
            }
            handleCancelEdit();
            await fetchData(); // Refresh list
        } catch (err) {
            setError(err.message || `Failed to ${editMode ? 'update' : 'add'} worker`);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm('Are you sure you want to delete this worker? This might affect task logs and supervision.')) {
            setError('');
            setIsLoading(true);
            try {
                await adminService.deleteWorker(id);
                await fetchData(); // Refresh list
            } catch (err) {
                setError(err.message || 'Failed to delete worker');
            } finally {
                setIsLoading(false);
            }
        }
    };

    return (
        <div style={styles.container}>
            <h2>Manage Workers</h2>
            {error && <p style={styles.error}>{error}</p>}

            <form onSubmit={handleSubmit} style={styles.form}>
                <h3>{editMode ? 'Edit Worker' : 'Add New Worker'}</h3>
                <div style={styles.formRow}>
                    <label style={styles.label} htmlFor="firstName">First Name:</label>
                    <input id="firstName" type="text" name="first_name" value={formData.first_name} onChange={handleInputChange} required style={styles.input} />
                    <label style={styles.label} htmlFor="lastName">Last Name:</label>
                    <input id="lastName" type="text" name="last_name" value={formData.last_name} onChange={handleInputChange} required style={styles.input} />
                </div>
                 <div style={styles.formRow}>
                    <label style={styles.label} htmlFor="pin">PIN:</label>
                    <input id="pin" type="password" name="pin" placeholder={editMode ? "Enter new PIN to change" : "Min 4 digits"} value={formData.pin} onChange={handleInputChange} required={!editMode} minLength="4" style={styles.input} />
                     {/* Add PIN confirmation if desired */}
                 </div>
                <div style={styles.formRow}>
                    <label style={styles.label} htmlFor="specialty">Specialty:</label>
                    <select id="specialty" name="specialty_id" value={formData.specialty_id} onChange={handleInputChange} style={styles.select}>
                        <option value="">-- Optional: Select Specialty --</option>
                        {specialties.map(spec => (
                            <option key={spec.specialty_id} value={spec.specialty_id}>{spec.name}</option>
                        ))}
                    </select>
                </div>
                <div style={styles.formRow}>
                    <label style={styles.label} htmlFor="supervisor">Supervisor:</label>
                    <select id="supervisor" name="supervisor_id" value={formData.supervisor_id} onChange={handleInputChange} style={styles.select}>
                        <option value="">-- Optional: Select Supervisor --</option>
                        {supervisors.map(sup => (
                            <option key={sup.id} value={sup.id}>{sup.name}</option>
                        ))}
                    </select>
                </div>
                 <div style={styles.formRow}>
                     <label style={styles.checkboxLabel} htmlFor="isActive">
                         <input id="isActive" type="checkbox" name="is_active" checked={formData.is_active} onChange={handleInputChange} />
                         Active
                     </label>
                 </div>
                <div>
                    <button type="submit" disabled={isLoading} style={styles.button}>
                        {isLoading ? 'Saving...' : (editMode ? 'Update Worker' : 'Add Worker')}
                    </button>
                    {editMode && (
                        <button type="button" onClick={handleCancelEdit} style={styles.button} disabled={isLoading}>Cancel</button>
                    )}
                </div>
            </form>

            {isLoading && !workers.length ? <p style={styles.loading}>Loading workers...</p> : (
                <table style={styles.table}>
                    <thead>
                        <tr>
                            <th style={styles.th}>Name</th>
                            <th style={styles.th}>Specialty</th>
                            <th style={styles.th}>Supervisor</th>
                            <th style={styles.th}>Active</th>
                            <th style={styles.th}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {workers.map((w) => (
                            <tr key={w.worker_id}>
                                <td style={styles.td}>{w.first_name} {w.last_name}</td>
                                <td style={styles.td}>{w.specialty_name || 'N/A'}</td>
                                <td style={styles.td}>{w.supervisor_name || 'N/A'}</td>
                                <td style={styles.td}>{w.is_active ? 'Yes' : 'No'}</td>
                                <td style={styles.td}>
                                    <button onClick={() => handleEdit(w)} style={styles.button} disabled={isLoading}>Edit</button>
                                    <button onClick={() => handleDelete(w.worker_id)} style={styles.button} disabled={isLoading}>Delete</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
            {!isLoading && workers.length === 0 && <p>No workers found.</p>}
        </div>
    );
}

export default WorkersManager;
