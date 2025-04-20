import React, { useState, useEffect, useCallback } from 'react';
import * as adminService from '../../services/adminService';

// --- Sub-component for Editing Parameters per Module ---
const ParameterEditor = ({ houseType, parameters, existingValues, onSave, onCancel, isLoading, error }) => {
    const [values, setValues] = useState({}); // Store { 'paramId_moduleSeq': value }

    // Initialize state with existing values
    useEffect(() => {
        const initialValues = {};
        existingValues.forEach(ev => {
            initialValues[`${ev.parameter_id}_${ev.module_sequence_number}`] = ev.value;
        });
        setValues(initialValues);
    }, [existingValues]);

    const handleValueChange = (parameterId, moduleSequence, value) => {
        setValues(prev => ({
            ...prev,
            [`${parameterId}_${moduleSequence}`]: value
        }));
    };

    const handleSave = () => {
        // Prepare payload for the service calls
        const changes = [];
        parameters.forEach(param => {
            for (let i = 1; i <= houseType.number_of_modules; i++) {
                const key = `${param.parameter_id}_${i}`;
                const currentValue = values[key];
                const originalValue = existingValues.find(ev => ev.parameter_id === param.parameter_id && ev.module_sequence_number === i)?.value;

                // Check if value changed or is newly added (and not empty)
                if (currentValue !== undefined && currentValue !== '' && currentValue != originalValue) {
                     // Check if it's a valid number before adding
                     if (!isNaN(parseFloat(currentValue)) && isFinite(currentValue)) {
                        changes.push({
                            parameter_id: param.parameter_id,
                            module_sequence_number: i,
                            value: parseFloat(currentValue) // Ensure it's a number
                        });
                     } else {
                         // Optionally show an error message for this specific input
                         console.warn(`Invalid number format for ${param.name} - Module ${i}: ${currentValue}`);
                     }
                }
                // TODO: Handle deletion if value is cleared? Requires a different API call.
                // For now, we only add/update non-empty numeric values.
            }
        });
        onSave(changes);
    };

    // Basic styling for the editor modal/section
    const editorStyles = {
        container: { marginTop: '20px', padding: '15px', border: '1px solid #ddd', borderRadius: '5px', background: '#f9f9f9' },
        moduleSection: { marginBottom: '15px', paddingBottom: '10px', borderBottom: '1px solid #eee' },
        paramRow: { display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '5px' },
        paramLabel: { minWidth: '150px', textAlign: 'right', fontWeight: 'bold' },
        paramUnit: { minWidth: '50px', color: '#666' },
        input: { padding: '5px', border: '1px solid #ccc', borderRadius: '3px', width: '100px' },
        actions: { marginTop: '15px' },
        error: { color: 'red', marginBottom: '10px' }
    };

    return (
        <div style={editorStyles.container}>
            <h4>Edit Parameters for: {houseType.name}</h4>
            {error && <p style={editorStyles.error}>{error}</p>}
            {parameters.length === 0 && <p>No parameters defined yet. Add parameters in the 'House Parameters' section first.</p>}

            {Array.from({ length: houseType.number_of_modules }, (_, i) => i + 1).map(moduleSeq => (
                <div key={moduleSeq} style={editorStyles.moduleSection}>
                    <h5>Module {moduleSeq}</h5>
                    {parameters.map(param => {
                        const key = `${param.parameter_id}_${moduleSeq}`;
                        return (
                            <div key={key} style={editorStyles.paramRow}>
                                <label style={editorStyles.paramLabel} htmlFor={key}>{param.name}:</label>
                                <input
                                    id={key}
                                    type="number" // Use number type for better input control
                                    step="any" // Allow decimals
                                    style={editorStyles.input}
                                    value={values[key] || ''}
                                    onChange={(e) => handleValueChange(param.parameter_id, moduleSeq, e.target.value)}
                                    placeholder="Value"
                                />
                                <span style={editorStyles.paramUnit}>({param.unit || 'N/A'})</span>
                            </div>
                        );
                    })}
                </div>
            ))}
            <div style={editorStyles.actions}>
                <button onClick={handleSave} disabled={isLoading} style={styles.button}>
                    {isLoading ? 'Saving...' : 'Save Parameter Values'}
                </button>
                <button onClick={onCancel} disabled={isLoading} style={styles.button}>
                    Cancel
                </button>
            </div>
        </div>
    );
};


// --- Main HouseTypesManager Component ---
const styles = { // Reusing styles from other managers
    container: { margin: '20px', padding: '20px', border: '1px solid #ccc', borderRadius: '8px' },
    table: { width: '100%', borderCollapse: 'collapse', marginTop: '15px' },
    th: { border: '1px solid #ddd', padding: '8px', backgroundColor: '#f2f2f2', textAlign: 'left' },
    td: { border: '1px solid #ddd', padding: '8px', verticalAlign: 'top' },
    button: { marginLeft: '5px', cursor: 'pointer', padding: '5px 10px' },
    form: { marginBottom: '20px', padding: '15px', border: '1px solid #eee', borderRadius: '5px', display: 'flex', flexDirection: 'column', gap: '10px' },
    formRow: { display: 'flex', gap: '10px', alignItems: 'center' },
    label: { minWidth: '120px', textAlign: 'right' },
    input: { padding: '8px', border: '1px solid #ccc', borderRadius: '4px', flexGrow: 1 },
    textarea: { padding: '8px', border: '1px solid #ccc', borderRadius: '4px', flexGrow: 1, minHeight: '60px' },
    error: { color: 'red', marginTop: '10px' },
    loading: { fontStyle: 'italic' }
};

const initialFormState = { name: '', description: '', number_of_modules: 1 };

function HouseTypesManager() {
    const [houseTypes, setHouseTypes] = useState([]);
    const [allParameters, setAllParameters] = useState([]); // All defined HouseParameters
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [editMode, setEditMode] = useState(null); // null or house_type_id for basic editing
    const [formData, setFormData] = useState(initialFormState);

    // State for the parameter editor
    const [editingParamsFor, setEditingParamsFor] = useState(null); // null or houseType object
    const [existingParamValues, setExistingParamValues] = useState([]);
    const [paramEditorLoading, setParamEditorLoading] = useState(false);
    const [paramEditorError, setParamEditorError] = useState('');

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        setError('');
        try {
            // Fetch both house types and all possible parameters
            const [typesData, paramsData] = await Promise.all([
                adminService.getHouseTypes(),
                adminService.getHouseParameters()
            ]);
            setHouseTypes(typesData);
            setAllParameters(paramsData);
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
        const { name, value, type } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'number' ? parseInt(value, 10) || 1 : value // Ensure number_of_modules is integer >= 1
        }));
    };

    const handleEdit = (houseType) => {
        setEditMode(houseType.house_type_id);
        setFormData({
            name: houseType.name,
            description: houseType.description || '',
            number_of_modules: houseType.number_of_modules || 1
        });
        setEditingParamsFor(null); // Close parameter editor if open
        window.scrollTo(0, 0);
    };

    const handleCancelEdit = () => {
        setEditMode(null);
        setFormData(initialFormState);
        setError('');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.name || formData.number_of_modules < 1) {
            setError('House Type Name is required and Number of Modules must be at least 1.');
            return;
        }
        setError('');
        setIsLoading(true);

        try {
            if (editMode) {
                await adminService.updateHouseType(editMode, formData);
            } else {
                await adminService.addHouseType(formData);
            }
            handleCancelEdit();
            await fetchData(); // Refresh list
        } catch (err) {
            setError(err.message || `Failed to ${editMode ? 'save' : 'add'} house type`);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm('Are you sure you want to delete this house type? This will remove associated modules, parameters, and potentially affect task definitions.')) {
            setError('');
            setIsLoading(true);
            try {
                await adminService.deleteHouseType(id);
                await fetchData(); // Refresh list
                setEditingParamsFor(null); // Close editor if deleting the edited type
            } catch (err) {
                setError(err.message || 'Failed to delete house type');
            } finally {
                setIsLoading(false);
            }
        }
    };

    // --- Parameter Editor Logic ---

    const handleOpenParameterEditor = async (houseType) => {
        setEditingParamsFor(houseType);
        setParamEditorLoading(true);
        setParamEditorError('');
        setEditMode(null); // Close main edit form
        setFormData(initialFormState);
        try {
            const values = await adminService.getParametersForHouseType(houseType.house_type_id);
            setExistingParamValues(values);
        } catch (err) {
            setParamEditorError(err.message || 'Failed to load existing parameter values.');
        } finally {
            setParamEditorLoading(false);
        }
    };

    const handleCancelParameterEditor = () => {
        setEditingParamsFor(null);
        setExistingParamValues([]);
        setParamEditorError('');
    };

    const handleSaveParameterValues = async (changes) => {
        if (!editingParamsFor || changes.length === 0) {
            // No changes detected or editor not open
             handleCancelParameterEditor(); // Close editor even if no changes
            return;
        }
        setParamEditorLoading(true);
        setParamEditorError('');
        let success = true;

        try {
            // Sequentially save each change (or use Promise.all)
            for (const change of changes) {
                await adminService.setHouseTypeParameter(
                    editingParamsFor.house_type_id,
                    change.parameter_id,
                    change.module_sequence_number,
                    change.value
                );
            }
        } catch (err) {
            success = false;
            setParamEditorError(err.message || 'Failed to save one or more parameter values.');
        } finally {
            setParamEditorLoading(false);
            if (success) {
                handleCancelParameterEditor(); // Close editor on success
                // Optionally re-fetch data if needed, but not strictly necessary here
            }
        }
    };


    return (
        <div style={styles.container}>
            <h2>Manage House Types</h2>
            {error && <p style={styles.error}>{error}</p>}

            {/* Form for Adding/Editing House Type basic info */}
            {!editingParamsFor && ( // Only show form if not editing parameters
                <form onSubmit={handleSubmit} style={styles.form}>
                    <h3>{editMode ? 'Edit House Type' : 'Add New House Type'}</h3>
                    <div style={styles.formRow}>
                        <label style={styles.label} htmlFor="htName">Name:</label>
                        <input id="htName" type="text" name="name" placeholder="e.g., Single Family Townhouse A" value={formData.name} onChange={handleInputChange} required style={styles.input} />
                    </div>
                    <div style={styles.formRow}>
                        <label style={styles.label} htmlFor="htDesc">Description:</label>
                        <textarea id="htDesc" name="description" placeholder="Optional description" value={formData.description} onChange={handleInputChange} style={styles.textarea} />
                    </div>
                    <div style={styles.formRow}>
                        <label style={styles.label} htmlFor="htModules">Number of Modules:</label>
                        <input id="htModules" type="number" name="number_of_modules" value={formData.number_of_modules} onChange={handleInputChange} required min="1" style={{...styles.input, flexGrow: 0, width: '80px'}} />
                    </div>
                    <div>
                        <button type="submit" disabled={isLoading} style={styles.button}>
                            {isLoading ? 'Saving...' : (editMode ? 'Update House Type' : 'Add House Type')}
                        </button>
                        {editMode && (
                            <button type="button" onClick={handleCancelEdit} style={styles.button} disabled={isLoading}>Cancel</button>
                        )}
                    </div>
                </form>
            )}

             {/* Parameter Editor Section */}
             {editingParamsFor && (
                <ParameterEditor
                    houseType={editingParamsFor}
                    parameters={allParameters}
                    existingValues={existingParamValues}
                    onSave={handleSaveParameterValues}
                    onCancel={handleCancelParameterEditor}
                    isLoading={paramEditorLoading}
                    error={paramEditorError}
                />
            )}


            {/* Table of House Types */}
            {isLoading && !houseTypes.length ? <p style={styles.loading}>Loading house types...</p> : (
                <table style={styles.table}>
                    <thead>
                        <tr>
                            <th style={styles.th}>Name</th>
                            <th style={styles.th}>Description</th>
                            <th style={styles.th}>Modules</th>
                            <th style={styles.th}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {houseTypes.map((ht) => (
                            <tr key={ht.house_type_id}>
                                <td style={styles.td}>{ht.name}</td>
                                <td style={styles.td}>{ht.description}</td>
                                <td style={styles.td}>{ht.number_of_modules}</td>
                                <td style={styles.td}>
                                    <button onClick={() => handleEdit(ht)} style={styles.button} disabled={isLoading || !!editingParamsFor}>Edit Info</button>
                                    <button onClick={() => handleOpenParameterEditor(ht)} style={styles.button} disabled={isLoading || !!editingParamsFor}>Edit Parameters</button>
                                    <button onClick={() => handleDelete(ht.house_type_id)} style={styles.button} disabled={isLoading || !!editingParamsFor}>Delete</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
            {!isLoading && houseTypes.length === 0 && <p>No house types defined yet.</p>}
        </div>
    );
}

export default HouseTypesManager;
