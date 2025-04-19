import React, { useState, useEffect, useCallback } from 'react';
import * as adminService from '../../services/adminService';

// Basic styling (inline for simplicity, consider CSS modules or styled-components)
const styles = {
    container: { margin: '20px', padding: '20px', border: '1px solid #ccc', borderRadius: '8px' },
    table: { width: '100%', borderCollapse: 'collapse', marginTop: '15px' },
    th: { border: '1px solid #ddd', padding: '8px', backgroundColor: '#f2f2f2', textAlign: 'left' },
    td: { border: '1px solid #ddd', padding: '8px' },
    button: { marginLeft: '5px', cursor: 'pointer' },
    form: { marginBottom: '15px', display: 'flex', gap: '10px', alignItems: 'center' },
    input: { padding: '8px', border: '1px solid #ccc', borderRadius: '4px' },
    error: { color: 'red', marginTop: '10px' },
    loading: { fontStyle: 'italic' }
};

function SpecialtiesManager() {
    const [specialties, setSpecialties] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [editMode, setEditMode] = useState(null); // null or specialty_id
    const [formData, setFormData] = useState({ name: '', description: '' });

    const fetchSpecialties = useCallback(async () => {
        setIsLoading(true);
        setError('');
        try {
            const data = await adminService.getSpecialties();
            setSpecialties(data);
        } catch (err) {
            setError(err.message || 'Failed to fetch specialties');
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchSpecialties();
    }, [fetchSpecialties]);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleEdit = (specialty) => {
        setEditMode(specialty.specialty_id);
        setFormData({ name: specialty.name, description: specialty.description || '' });
    };

    const handleCancelEdit = () => {
        setEditMode(null);
        setFormData({ name: '', description: '' });
        setError('');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setIsLoading(true); // Indicate activity

        try {
            if (editMode) {
                await adminService.updateSpecialty(editMode, formData);
            } else {
                await adminService.addSpecialty(formData);
            }
            handleCancelEdit(); // Reset form
            await fetchSpecialties(); // Refresh list
        } catch (err) {
            setError(err.message || `Failed to ${editMode ? 'update' : 'add'} specialty`);
        } finally {
             setIsLoading(false);
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm('Are you sure you want to delete this specialty?')) {
            setError('');
            try {
                await adminService.deleteSpecialty(id);
                await fetchSpecialties(); // Refresh list
            } catch (err) {
                setError(err.message || 'Failed to delete specialty');
            }
        }
    };

    return (
        <div style={styles.container}>
            <h2>Manage Specialties</h2>
            {error && <p style={styles.error}>{error}</p>}

            <form onSubmit={handleSubmit} style={styles.form}>
                <input
                    type="text"
                    name="name"
                    placeholder="Specialty Name"
                    value={formData.name}
                    onChange={handleInputChange}
                    required
                    style={styles.input}
                />
                <input
                    type="text"
                    name="description"
                    placeholder="Description (Optional)"
                    value={formData.description}
                    onChange={handleInputChange}
                    style={styles.input}
                />
                <button type="submit" disabled={isLoading} style={styles.button}>
                    {isLoading ? 'Saving...' : (editMode ? 'Update Specialty' : 'Add Specialty')}
                </button>
                {editMode && (
                    <button type="button" onClick={handleCancelEdit} style={styles.button}>
                        Cancel
                    </button>
                )}
            </form>

            {isLoading && !specialties.length ? <p style={styles.loading}>Loading specialties...</p> : (
                <table style={styles.table}>
                    <thead>
                        <tr>
                            <th style={styles.th}>Name</th>
                            <th style={styles.th}>Description</th>
                            <th style={styles.th}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {specialties.map((spec) => (
                            <tr key={spec.specialty_id}>
                                <td style={styles.td}>{spec.name}</td>
                                <td style={styles.td}>{spec.description}</td>
                                <td style={styles.td}>
                                    <button onClick={() => handleEdit(spec)} style={styles.button} disabled={isLoading}>Edit</button>
                                    <button onClick={() => handleDelete(spec.specialty_id)} style={styles.button} disabled={isLoading}>Delete</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
             { !isLoading && specialties.length === 0 && <p>No specialties found.</p>}
        </div>
    );
}

export default SpecialtiesManager;
