import React, { useState, useEffect, useCallback } from 'react';
import * as adminService from '../../services/adminService';

// Basic styling (reusing styles concept)
const styles = {
    container: { margin: '20px', padding: '20px', border: '1px solid #ccc', borderRadius: '8px' },
    table: { width: '100%', borderCollapse: 'collapse', marginTop: '15px' },
    th: { border: '1px solid #ddd', padding: '8px', backgroundColor: '#f2f2f2', textAlign: 'left' },
    td: { border: '1px solid #ddd', padding: '8px' },
    button: { marginLeft: '5px', cursor: 'pointer', padding: '5px 10px' },
    form: { marginBottom: '20px', padding: '15px', border: '1px solid #eee', borderRadius: '5px', display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' },
    input: { padding: '8px', border: '1px solid #ccc', borderRadius: '4px', flexGrow: 1, minWidth: '150px' },
    error: { color: 'red', marginTop: '10px', width: '100%' },
    loading: { fontStyle: 'italic' }
};

const initialFormState = { name: '', unit: '' };

function HouseParametersManager() {
    const [parameters, setParameters] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [editMode, setEditMode] = useState(null); // null or parameter_id
    const [formData, setFormData] = useState(initialFormState);

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        setError('');
        try {
            const data = await adminService.getHouseParameters();
            setParameters(data);
        } catch (err) {
            setError(err.message || 'Failed to fetch house parameters');
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

    const handleEdit = (param) => {
        setEditMode(param.parameter_id);
        setFormData({ name: param.name, unit: param.unit || '' });
        window.scrollTo(0, 0);
    };

    const handleCancelEdit = () => {
        setEditMode(null);
        setFormData(initialFormState);
        setError('');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.name) {
            setError('Parameter Name is required.');
            return;
        }
        setError('');
        setIsLoading(true);

        try {
            if (editMode) {
                await adminService.updateHouseParameter(editMode, formData);
            } else {
                await adminService.addHouseParameter(formData);
            }
            handleCancelEdit();
            await fetchData(); // Refresh list
        } catch (err) {
            setError(err.message || `Failed to ${editMode ? 'update' : 'add'} house parameter`);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm('Are you sure you want to delete this parameter? This will remove it from all house types.')) {
            setError('');
            setIsLoading(true);
            try {
                await adminService.deleteHouseParameter(id);
                await fetchData(); // Refresh list
            } catch (err) {
                setError(err.message || 'Failed to delete house parameter');
            } finally {
                setIsLoading(false);
            }
        }
    };

    return (
        <div style={styles.container}>
            <h2>Manage House Parameters</h2>
            {error && <p style={styles.error}>{error}</p>}

            <form onSubmit={handleSubmit} style={styles.form}>
                <h3>{editMode ? 'Edit Parameter' : 'Add New Parameter'}</h3>
                <input
                    type="text"
                    name="name"
                    placeholder="Parameter Name (e.g., Floor Area)"
                    value={formData.name}
                    onChange={handleInputChange}
                    required
                    style={styles.input}
                />
                <input
                    type="text"
                    name="unit"
                    placeholder="Unit (e.g., m², count, meters)"
                    value={formData.unit}
                    onChange={handleInputChange}
                    style={styles.input}
                />
                <button type="submit" disabled={isLoading} style={styles.button}>
                    {isLoading ? 'Saving...' : (editMode ? 'Update Parameter' : 'Add Parameter')}
                </button>
                {editMode && (
                    <button type="button" onClick={handleCancelEdit} style={styles.button} disabled={isLoading}>
                        Cancel
                    </button>
                )}
            </form>

            {isLoading && !parameters.length ? <p style={styles.loading}>Loading parameters...</p> : (
                <table style={styles.table}>
                    <thead>
                        <tr>
                            <th style={styles.th}>Name</th>
                            <th style={styles.th}>Unit</th>
                            <th style={styles.th}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {parameters.map((param) => (
                            <tr key={param.parameter_id}>
                                <td style={styles.td}>{param.name}</td>
                                <td style={styles.td}>{param.unit || 'N/A'}</td>
                                <td style={styles.td}>
                                    <button onClick={() => handleEdit(param)} style={styles.button} disabled={isLoading}>Edit</button>
                                    <button onClick={() => handleDelete(param.parameter_id)} style={styles.button} disabled={isLoading}>Delete</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
            {!isLoading && parameters.length === 0 && <p>No house parameters defined yet.</p>}
        </div>
    );
}

export default HouseParametersManager;
