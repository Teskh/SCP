import React, { useState, useEffect, useCallback, Fragment } from 'react';
import * as adminService from '../../services/adminService';
import HouseTypePanelsModal from './HouseTypePanelsModal'; // Assuming this will be refactored or used as is

// --- Sub-component for Editing Parameters per Module ---
const ParameterEditor = ({ houseType, parameters, subTypes, existingValues, onSave, onCancel, isLoading, error }) => {
    // State structure for values: { 'paramId_moduleSeq_subTypeId': value }
    // subTypeId can be 'null' for the general value or the actual sub_type_id
    const [values, setValues] = useState({});
    const [isGeneric, setIsGeneric] = useState({}); // { 'paramId_moduleSeq': boolean }

    useEffect(() => {
        const initialValues = {};
        const initialIsGeneric = {};

        existingValues.forEach(ev => {
            const subTypeKey = ev.sub_type_id === null ? 'null' : ev.sub_type_id; // Use sub_type_id
            initialValues[`${ev.parameter_id}_${ev.module_sequence_number}_${subTypeKey}`] = ev.value;
        });

        parameters.forEach(param => {
            for (let modSeq = 1; modSeq <= houseType.number_of_modules; modSeq++) {
                const genericKey = `${param.parameter_id}_${modSeq}`;
                initialIsGeneric[genericKey] = true; 
            }
        });

        setValues(initialValues);
        setIsGeneric(initialIsGeneric);
    }, [existingValues, parameters, houseType.number_of_modules, subTypes]);

    const handleValueChange = (parameterId, moduleSequence, subTypeId, value) => {
        const subTypeKey = subTypeId === null ? 'null' : subTypeId;
        const key = `${parameterId}_${moduleSequence}_${subTypeKey}`;
        setValues(prev => ({ ...prev, [key]: value }));
    };

    const handleGenericChange = (parameterId, moduleSequence, checked) => {
        const genericStateKey = `${parameterId}_${moduleSequence}`;
        setIsGeneric(prev => ({ ...prev, [genericStateKey]: checked }));

        setValues(prevValues => {
            const newValues = { ...prevValues };
            const hasSubTypes = subTypes && subTypes.length > 0;

            if (checked) { // Switched TO Generic
                if (hasSubTypes) {
                    subTypes.forEach(st => {
                        const specificValueKey = `${parameterId}_${moduleSequence}_${st.sub_type_id}`;
                        if (newValues[specificValueKey] !== undefined) newValues[specificValueKey] = '';
                    });
                }
            } else { // Switched FROM Generic (to specific per sub-type)
                const generalValueKey = `${parameterId}_${moduleSequence}_null`;
                if (newValues[generalValueKey] !== undefined) newValues[generalValueKey] = '';
            }
            return newValues;
        });
    };

    const handleSave = () => {
        const changes = []; 
        const hasSubTypes = subTypes && subTypes.length > 0;

        parameters.forEach(param => {
            for (let modSeq = 1; modSeq <= houseType.number_of_modules; modSeq++) {
                const genericKey = `${param.parameter_id}_${modSeq}`;
                const isParamGeneric = isGeneric[genericKey];

                const findOriginalValue = (currentSubTypeId) => existingValues.find(ev =>
                    ev.parameter_id === param.parameter_id &&
                    ev.module_sequence_number === modSeq &&
                    ev.sub_type_id === currentSubTypeId 
                )?.value;

                const processSingleValue = (currentSubTypeId) => {
                    const subTypeKey = currentSubTypeId === null ? 'null' : currentSubTypeId;
                    const valueKey = `${param.parameter_id}_${modSeq}_${subTypeKey}`;
                    const currentValue = values[valueKey];
                    const originalValue = findOriginalValue(currentSubTypeId);
                    
                    const isNumeric = currentValue !== undefined && currentValue !== null && currentValue !== '' && !isNaN(parseFloat(currentValue)) && isFinite(currentValue);
                    const isEmpty = currentValue === undefined || currentValue === null || currentValue === '';

                    if (isNumeric) {
                        const numericValue = parseFloat(currentValue);
                        // Compare with original, careful with float comparisons if necessary
                        if (String(numericValue) !== String(originalValue)) { 
                            changes.push({
                                action: 'set', parameter_id: param.parameter_id, module_sequence_number: modSeq,
                                sub_type_id: currentSubTypeId, value: numericValue
                            });
                        }
                    } else if (isEmpty && originalValue !== undefined) {
                        changes.push({
                            action: 'delete', parameter_id: param.parameter_id, module_sequence_number: modSeq,
                            sub_type_id: currentSubTypeId
                        });
                    } else if (!isEmpty && !isNumeric) {
                        console.warn(`Invalid number format for ${param.name} - Module ${modSeq} - SubType ${subTypeKey}: ${currentValue}`);
                    }
                };

                if (isParamGeneric || !hasSubTypes) {
                    processSingleValue(null); // Process general value
                    if (hasSubTypes) { // If generic, ensure specific values are deleted if they existed
                        subTypes.forEach(st => {
                            if (findOriginalValue(st.sub_type_id) !== undefined) {
                                changes.push({ action: 'delete', parameter_id: param.parameter_id, module_sequence_number: modSeq, sub_type_id: st.sub_type_id });
                            }
                        });
                    }
                } else { // Specific per sub-type
                    if (findOriginalValue(null) !== undefined) { // Ensure general value is deleted if it existed
                        changes.push({ action: 'delete', parameter_id: param.parameter_id, module_sequence_number: modSeq, sub_type_id: null });
                    }
                    subTypes.forEach(st => processSingleValue(st.sub_type_id));
                }
            }
        });
        
        const uniqueChanges = changes.reduce((acc, current) => {
            const existingIndex = acc.findIndex(item =>
                item.action === current.action &&
                item.parameter_id === current.parameter_id &&
                item.module_sequence_number === current.module_sequence_number &&
                item.sub_type_id === current.sub_type_id
            );
            if (existingIndex === -1) {
                acc.push(current);
            } else if (current.action === 'set') { // Prefer 'set' over 'delete' if both exist for same key (shouldn't happen with proper logic)
                acc[existingIndex] = current;
            }
            return acc;
        }, []);
        onSave(uniqueChanges);
    };
    
    const editorStyles = { /* Styles kept similar, can be adjusted */ 
        container: { marginTop: '20px', padding: '15px', border: '1px solid #ddd', borderRadius: '5px', background: '#f9f9f9' },
        moduleSection: { marginBottom: '15px', paddingBottom: '10px', borderBottom: '1px solid #eee' },
        paramRow: { display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '5px' },
        paramLabel: { minWidth: '150px', textAlign: 'right', fontWeight: 'bold', alignSelf: 'start', paddingTop: '5px' },
        paramUnit: { minWidth: '50px', color: '#666', alignSelf: 'start', paddingTop: '5px' },
        input: { padding: '5px', border: '1px solid #ccc', borderRadius: '3px', width: '100px', marginBottom: '3px' },
        inputGroup: { display: 'flex', flexDirection: 'column', gap: '2px' },
        subTypeInputRow: { display: 'flex', gap: '5px', alignItems: 'center', marginLeft: '20px' }, // Renamed
        subTypeLabel: { fontSize: '0.9em', color: '#555', minWidth: '80px' }, // Renamed
        genericCheckboxContainer: { display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '5px', marginLeft: '10px' },
        actions: { marginTop: '15px' },
        error: { color: 'red', marginBottom: '10px' }
    };

    const hasSubTypes = subTypes && subTypes.length > 0;

    return (
        <div style={editorStyles.container}>
            <h4>Editar Parámetros para: {houseType.name}</h4>
            {error && <p style={editorStyles.error}>{error}</p>}
            {parameters.length === 0 && <p>Aún no se han definido parámetros. Añada parámetros en la sección 'Parámetros de Vivienda' primero.</p>}

            {Array.from({ length: houseType.number_of_modules }, (_, i) => i + 1).map(moduleSeq => (
                <div key={moduleSeq} style={editorStyles.moduleSection}>
                    <h5>Módulo {moduleSeq}</h5>
                    {parameters.map(param => {
                        const genericKey = `${param.parameter_id}_${moduleSeq}`;
                        const isParamGeneric = isGeneric[genericKey];
                        const generalValueKey = `${param.parameter_id}_${moduleSeq}_null`;

                        return (
                            <div key={genericKey} style={{ ...editorStyles.paramRow, alignItems: 'flex-start', borderBottom: '1px dotted #ccc', paddingBottom: '10px', marginBottom: '10px' }}>
                                <label style={editorStyles.paramLabel}>{param.name}:</label>
                                <div style={{ flexGrow: 1 }}>
                                    {hasSubTypes && (
                                        <div style={editorStyles.genericCheckboxContainer}>
                                            <input type="checkbox" id={`generic_${genericKey}`} checked={isParamGeneric} onChange={(e) => handleGenericChange(param.parameter_id, moduleSeq, e.target.checked)} />
                                            <label htmlFor={`generic_${genericKey}`}>Valor Genérico para todos los Sub-Tipos</label>
                                        </div>
                                    )}
                                    <div style={editorStyles.inputGroup}>
                                        {(isParamGeneric || !hasSubTypes) && (
                                            <div key={generalValueKey} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                                {!hasSubTypes && <label style={{ ...editorStyles.subTypeLabel, minWidth: 0 }}>Valor:</label>}
                                                {hasSubTypes && <label style={editorStyles.subTypeLabel} htmlFor={generalValueKey}>General:</label>}
                                                <input id={generalValueKey} type="number" step="any" style={editorStyles.input} value={values[generalValueKey] || ''} onChange={(e) => handleValueChange(param.parameter_id, moduleSeq, null, e.target.value)} placeholder="Valor" />
                                            </div>
                                        )}
                                        {!isParamGeneric && hasSubTypes && subTypes.map(st => {
                                            const subTypeValueKey = `${param.parameter_id}_${moduleSeq}_${st.sub_type_id}`;
                                            return (
                                                <div key={subTypeValueKey} style={editorStyles.subTypeInputRow}>
                                                    <label style={editorStyles.subTypeLabel} htmlFor={subTypeValueKey}>{st.name}:</label>
                                                    <input id={subTypeValueKey} type="number" step="any" style={editorStyles.input} value={values[subTypeValueKey] || ''} onChange={(e) => handleValueChange(param.parameter_id, moduleSeq, st.sub_type_id, e.target.value)} placeholder="Valor" />
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                                <span style={editorStyles.paramUnit}>({param.unit || 'N/A'})</span>
                            </div>
                        );
                    })}
                </div>
            ))}
            <div style={editorStyles.actions}>
                <button onClick={handleSave} disabled={isLoading} style={styles.button}>
                    {isLoading ? 'Guardando...' : 'Guardar Cambios de Parámetros'}
                </button>
                <button onClick={onCancel} disabled={isLoading} style={{...styles.button, ...styles.buttonSecondary}}> 
                    Cancelar
                </button>
            </div>
        </div>
    );
};

// --- Main HouseTypesManager Component ---
const styles = { 
    container: { margin: '20px', padding: '20px', border: '1px solid #ccc', borderRadius: '8px' },
    table: { width: '100%', borderCollapse: 'collapse', marginTop: '15px' },
    th: { border: '1px solid #ddd', padding: '8px', backgroundColor: '#f2f2f2', textAlign: 'left' },
    td: { border: '1px solid #ddd', padding: '8px', verticalAlign: 'top' },
    button: { marginLeft: '5px', cursor: 'pointer', padding: '5px 10px', border: 'none', borderRadius: '4px', color: 'white' },
    buttonEdit: { backgroundColor: '#ffc107', color: '#212529'},
    buttonDelete: { backgroundColor: '#dc3545'},
    buttonPrimary: { backgroundColor: '#007bff'},
    buttonSecondary: { backgroundColor: '#6c757d'},
    form: { marginBottom: '20px', padding: '15px', border: '1px solid #eee', borderRadius: '5px', display: 'flex', flexDirection: 'column', gap: '10px' },
    formRow: { display: 'flex', gap: '10px', alignItems: 'center' },
    label: { minWidth: '120px', textAlign: 'right', marginRight: '10px' },
    input: { padding: '8px', border: '1px solid #ccc', borderRadius: '4px', flexGrow: 1 },
    textarea: { padding: '8px', border: '1px solid #ccc', borderRadius: '4px', flexGrow: 1, minHeight: '60px' },
    error: { color: 'red', marginTop: '10px' },
    loading: { fontStyle: 'italic' },
    subTypeSection: { marginTop: '20px', padding: '15px', border: '1px solid #ddd', borderRadius: '5px', background: '#f9f9f9' },
    subTypeTable: { width: '100%', borderCollapse: 'collapse', marginTop: '10px' },
    subTypeTh: { border: '1px solid #ccc', padding: '6px', backgroundColor: '#e9e9e9', textAlign: 'left' },
    subTypeTd: { border: '1px solid #ccc', padding: '6px' },
    subTypeForm: { marginTop: '10px', padding: '10px', border: '1px solid #eee', borderRadius: '4px', display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' },
    subTypeInput: { padding: '6px', border: '1px solid #ccc', borderRadius: '3px', flexGrow: 1, minWidth: '150px' },
    subTypeButton: { padding: '4px 8px', fontSize: '0.9em' }
};

const initialHouseTypeFormState = { name: '', description: '', number_of_modules: 1, sub_types: [] }; // Added sub_types for potential nested creation
const initialSubTypeFormState = { name: '', description: '' }; // Renamed

function HouseTypesManager() {
    const [houseTypes, setHouseTypes] = useState([]);
    const [allParameters, setAllParameters] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [editMode, setEditMode] = useState(null); // house_type_id
    const [formData, setFormData] = useState(initialHouseTypeFormState);

    const [editingParamsFor, setEditingParamsFor] = useState(null);
    const [existingParamValues, setExistingParamValues] = useState([]);
    const [paramEditorLoading, setParamEditorLoading] = useState(false);
    const [paramEditorError, setParamEditorError] = useState('');

    const [editingPanelsFor, setEditingPanelsFor] = useState(null);

    const [houseTypeSubTypes, setHouseTypeSubTypes] = useState([]); // Renamed
    const [subTypeFormData, setSubTypeFormData] = useState(initialSubTypeFormState); // Renamed
    const [editingSubTypeId, setEditingSubTypeId] = useState(null); // Renamed
    const [subTypeLoading, setSubTypeLoading] = useState(false); // Renamed
    const [subTypeError, setSubTypeError] = useState(''); // Renamed


    const fetchHouseTypesAndParams = useCallback(async () => {
        setIsLoading(true);
        setError('');
        try {
            const [typesData, paramsData] = await Promise.all([
                adminService.getHouseTypes(), // adminService.getHouseTypes should return sub_types nested
                adminService.getHouseParameters()
            ]);
            setHouseTypes(typesData || []);
            setAllParameters(paramsData || []);
        } catch (err) {
            setError(err.message || 'Error al obtener tipos de vivienda o parámetros');
        } finally {
            setIsLoading(false);
        }
    }, []);

    const fetchSubTypes = useCallback(async (houseTypeId) => { // Renamed
        if (!houseTypeId) return;
        setSubTypeLoading(true);
        setSubTypeError('');
        try {
            const data = await adminService.getHouseSubTypes(houseTypeId); // Renamed service call
            setHouseTypeSubTypes(data || []);
        } catch (err) {
            setSubTypeError(err.message || 'Error al obtener los Sub-Tipos');
            setHouseTypeSubTypes([]);
        } finally {
            setSubTypeLoading(false);
        }
    }, []);


    useEffect(() => {
        fetchHouseTypesAndParams();
    }, [fetchHouseTypesAndParams]);

    const handleInputChange = (e) => {
        const { name, value, type } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'number' ? parseInt(value, 10) || 1 : value
        }));
    };

    const handleSubTypeInputChange = (e) => { // Renamed
        const { name, value } = e.target;
        setSubTypeFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleEdit = (houseType) => {
        setEditMode(houseType.house_type_id);
        setFormData({
            name: houseType.name,
            description: houseType.description || '',
            number_of_modules: houseType.number_of_modules || 1,
            // Sub-types are part of the houseType object from getHouseTypes() if service is updated
            sub_types: houseType.sub_types ? [...houseType.sub_types] : [] 
        });
        setEditingParamsFor(null); 
        setEditingPanelsFor(null); 
        fetchSubTypes(houseType.house_type_id); 
        setEditingSubTypeId(null); 
        setSubTypeFormData(initialSubTypeFormState); 
        window.scrollTo(0, 0);
    };

    const handleCancelEdit = () => {
        setEditMode(null);
        setFormData(initialHouseTypeFormState);
        setError('');
        setHouseTypeSubTypes([]); 
        setSubTypeError('');
        setEditingSubTypeId(null);
        setSubTypeFormData(initialSubTypeFormState);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.name || formData.number_of_modules < 1) {
            setError('El Nombre del Tipo de Vivienda es obligatorio y el Número de Módulos debe ser al menos 1.');
            return;
        }
        setError('');
        setIsLoading(true);
        
        // The backend for addHouseType/updateHouseType now handles sub_types array.
        // If sub_types are managed within this form directly:
        // const payload = { ...formData }; 
        // Otherwise, if sub_types are managed separately (as currently implemented with dedicated SubType section):
        const payload = { 
            name: formData.name, 
            description: formData.description, 
            number_of_modules: formData.number_of_modules,
            // Pass sub_types if backend handles nested creation/update through main house type endpoint
            // For now, assuming sub_types are managed via their dedicated section after house type creation/selection.
            // If backend expects sub_types here, it would be:
            // sub_types: formData.sub_types.map(st => ({ name: st.name, description: st.description })) 
        };


        try {
            let newOrUpdatedHouseType;
            if (editMode) {
                newOrUpdatedHouseType = await adminService.updateHouseType(editMode, payload);
            } else {
                newOrUpdatedHouseType = await adminService.addHouseType(payload);
            }
            
            handleCancelEdit(); // Reset form
            await fetchHouseTypesAndParams(); // Refresh main list
            
            // If adding, and backend returns the full new house type object (including ID), open it for SubType editing
            if (!editMode && newOrUpdatedHouseType && newOrUpdatedHouseType.house_type_id) {
                 const freshlyFetchedHT = await adminService.getHouseTypes(); // Re-fetch to get the latest list with IDs
                 const newHT = freshlyFetchedHT.find(ht => ht.house_type_id === newOrUpdatedHouseType.house_type_id);
                 if (newHT) handleEdit(newHT); // Open for sub-type editing
            } else if (editMode) {
                // If editing, re-select it to refresh its sub-type list
                const updatedHT = houseTypes.find(ht => ht.house_type_id === editMode) || { house_type_id: editMode, ...payload};
                if (updatedHT) handleEdit(updatedHT);
            }

        } catch (err) {
            setError(err.message || `Error al ${editMode ? 'guardar' : 'añadir'} el tipo de vivienda`);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm('¿Está seguro de que desea eliminar este tipo de vivienda? Esto eliminará los Sub-Tipos, parámetros y podría afectar las definiciones de tareas y paneles.')) {
            setError('');
            setIsLoading(true);
            try {
                await adminService.deleteHouseType(id);
                await fetchHouseTypesAndParams();
                setEditingParamsFor(null);
                handleCancelEdit(); 
            } catch (err) {
                setError(err.message || 'Error al eliminar el tipo de vivienda');
            } finally {
                setIsLoading(false);
            }
        }
    };

    // --- SubType Handlers ---
    const handleEditSubType = (subType) => { // Renamed
        setEditingSubTypeId(subType.sub_type_id);
        setSubTypeFormData({ name: subType.name, description: subType.description || '' });
        setSubTypeError('');
    };

    const handleCancelEditSubType = () => { // Renamed
        setEditingSubTypeId(null);
        setSubTypeFormData(initialSubTypeFormState);
        setSubTypeError('');
    };

    const handleSubTypeSubmit = async (e) => { // Renamed
        e.preventDefault();
        if (!subTypeFormData.name || !editMode) { // editMode is house_type_id
            setSubTypeError('El nombre del Sub-Tipo es obligatorio.');
            return;
        }
        setSubTypeLoading(true);
        setSubTypeError('');
        try {
            if (editingSubTypeId) {
                await adminService.updateHouseSubType(editingSubTypeId, subTypeFormData); // Renamed service call
            } else {
                await adminService.addHouseSubType(editMode, subTypeFormData); // Renamed service call, passing house_type_id (editMode)
            }
            handleCancelEditSubType();
            await fetchSubTypes(editMode); 
            await fetchHouseTypesAndParams(); // Refresh main list to show updated sub_type counts/names potentially
        } catch (err) {
            setSubTypeError(err.message || `Error al ${editingSubTypeId ? 'actualizar' : 'añadir'} el Sub-Tipo`);
        } finally {
            setSubTypeLoading(false);
        }
    };

    const handleDeleteSubType = async (subTypeIdToDelete) => { // Renamed
        if (window.confirm('¿Está seguro de que desea eliminar este Sub-Tipo? Los valores de parámetros específicos y definiciones de paneles para este Sub-Tipo podrían ser afectados.')) {
            setSubTypeLoading(true);
            setSubTypeError('');
            try {
                await adminService.deleteHouseSubType(subTypeIdToDelete); // Renamed service call
                await fetchSubTypes(editMode); 
                handleCancelEditSubType(); 
                await fetchHouseTypesAndParams(); 
            } catch (err) {
                setSubTypeError(err.message || 'Error al eliminar el Sub-Tipo');
            } finally {
                setSubTypeLoading(false);
            }
        }
    };


    // --- Panel Modal Handlers ---
    const handleOpenPanelsModal = (houseType) => {
        setEditingPanelsFor(houseType); // Pass the whole houseType, which includes sub_types
        setEditMode(null); 
        setEditingParamsFor(null); 
        setHouseTypeSubTypes([]); 
    };

    const handleClosePanelsModal = () => {
        setEditingPanelsFor(null);
    };

    // --- Parameter Editor Logic ---

    const handleOpenParameterEditor = async (houseType) => {
        setEditingParamsFor(houseType);
        setParamEditorLoading(true);
        setParamEditorError('');
        setEditMode(null); 
        setFormData(initialHouseTypeFormState);
        setEditingPanelsFor(null); 
        window.scrollTo(0, 0); // Scroll to top to make editor visible
        
        try {
            const [values, subTypesData] = await Promise.all([ // Renamed tipologiasData to subTypesData
                adminService.getParametersForHouseType(houseType.house_type_id),
                adminService.getHouseSubTypes(houseType.house_type_id) // Use getHouseSubTypes
            ]);
            setExistingParamValues(values || []);
            setHouseTypeSubTypes(subTypesData || []); // Set subTypes for the editor
        } catch (err) {
            setParamEditorError(err.message || 'Error al cargar datos para el editor de parámetros.');
            setExistingParamValues([]);
            setHouseTypeSubTypes([]);
        } finally {
            setParamEditorLoading(false);
        }
    };

    const handleCancelParameterEditor = () => {
        setEditingParamsFor(null);
        setExistingParamValues([]);
        setParamEditorError('');
        setHouseTypeSubTypes([]); 
    };

    const handleSaveParameterValues = async (changes) => {
        if (!editingParamsFor || changes.length === 0) {
            handleCancelParameterEditor();
            return;
        }
        setParamEditorLoading(true);
        setParamEditorError('');
        let success = true;
        let requiresRefetch = false;

        try {
            await Promise.all(changes.map(change => {
                if (change.action === 'set') {
                    requiresRefetch = true;
                    return adminService.setHouseTypeParameter(
                        editingParamsFor.house_type_id,
                        change.parameter_id,
                        change.module_sequence_number,
                        change.value,
                        change.sub_type_id // Changed from tipologia_id
                    );
                } else if (change.action === 'delete') {
                    requiresRefetch = true;
                    return adminService.deleteParameterFromHouseTypeModule(
                        editingParamsFor.house_type_id,
                        change.parameter_id,
                        change.module_sequence_number,
                        change.sub_type_id // Changed from tipologia_id
                    );
                }
                return Promise.resolve();
            }));
        } catch (err) {
            success = false;
            setParamEditorError(err.message || 'Error al guardar uno o más cambios de parámetros.');
        } finally {
            setParamEditorLoading(false);
            if (success) {
                handleCancelParameterEditor(); 
                if (requiresRefetch) {
                    fetchHouseTypesAndParams();
                }
            }
        }
    };


    return (
        <div style={styles.container}>
            <h2>Gestionar Tipos de Vivienda</h2>
            {error && <p style={styles.error}>{error}</p>}

            {!editingParamsFor && !editingPanelsFor && ( 
                <form onSubmit={handleSubmit} style={styles.form}>
                    <h3>{editMode ? 'Editar Tipo de Vivienda' : 'Añadir Nuevo Tipo de Vivienda'}</h3>
                    <div style={styles.formRow}>
                        <label style={styles.label} htmlFor="htName">Nombre:</label>
                        <input id="htName" type="text" name="name" placeholder="ej: Casa Unifamiliar Adosada A" value={formData.name} onChange={handleInputChange} required style={styles.input} />
                    </div>
                    <div style={styles.formRow}>
                        <label style={styles.label} htmlFor="htDesc">Descripción:</label>
                        <textarea id="htDesc" name="description" placeholder="Descripción opcional" value={formData.description} onChange={handleInputChange} style={styles.textarea} />
                    </div>
                    <div style={styles.formRow}>
                        <label style={styles.label} htmlFor="htModules">Número de Módulos:</label>
                        <input id="htModules" type="number" name="number_of_modules" value={formData.number_of_modules} onChange={handleInputChange} required min="1" style={{ ...styles.input, flexGrow: 0, width: '80px' }} />
                    </div>
                    <div>
                        <button type="submit" disabled={isLoading} style={{...styles.button, ...styles.buttonPrimary}}>
                            {isLoading ? 'Guardando...' : (editMode ? 'Actualizar Tipo Vivienda' : 'Añadir Tipo Vivienda')}
                        </button>
                        {editMode && (
                            <button type="button" onClick={handleCancelEdit} style={{...styles.button, ...styles.buttonSecondary}} disabled={isLoading}>Cancelar</button>
                        )}
                    </div>
                </form>
            )}

            {editMode && !editingParamsFor && !editingPanelsFor && (
                <div style={styles.subTypeSection}> {/* Renamed style key */}
                    <h4>Gestionar Sub-Tipos para: {formData.name}</h4>
                    {subTypeError && <p style={styles.error}>{subTypeError}</p>} {/* Renamed state */}

                    <form onSubmit={handleSubTypeSubmit} style={styles.subTypeForm}> {/* Renamed */}
                        <h5>{editingSubTypeId ? 'Editar Sub-Tipo' : 'Añadir Nuevo Sub-Tipo'}</h5> {/* Renamed */}
                        <input
                            type="text"
                            name="name"
                            placeholder="Nombre Sub-Tipo (ej: Estándar, Premium)"
                            value={subTypeFormData.name} // Renamed
                            onChange={handleSubTypeInputChange} // Renamed
                            required
                            style={styles.subTypeInput} // Renamed
                            disabled={subTypeLoading} // Renamed
                        />
                        <input
                            type="text"
                            name="description"
                            placeholder="Descripción (Opcional)"
                            value={subTypeFormData.description} // Renamed
                            onChange={handleSubTypeInputChange} // Renamed
                            style={styles.subTypeInput} // Renamed
                            disabled={subTypeLoading} // Renamed
                        />
                        <button type="submit" disabled={subTypeLoading} style={{ ...styles.button, ...styles.buttonPrimary, ...styles.subTypeButton }}> {/* Renamed */}
                            {subTypeLoading ? 'Guardando...' : (editingSubTypeId ? 'Actualizar' : 'Añadir')}
                        </button>
                        {editingSubTypeId && (
                            <button type="button" onClick={handleCancelEditSubType} style={{ ...styles.button, ...styles.buttonSecondary, ...styles.subTypeButton }} disabled={subTypeLoading}> {/* Renamed */}
                                Cancelar Edición
                            </button>
                        )}
                    </form>

                    {subTypeLoading && <p style={styles.loading}>Cargando Sub-Tipos...</p>}
                    {!subTypeLoading && houseTypeSubTypes.length > 0 && (
                        <table style={styles.subTypeTable}> {/* Renamed */}
                            <thead>
                                <tr>
                                    <th style={styles.subTypeTh}>Nombre</th> {/* Renamed */}
                                    <th style={styles.subTypeTh}>Descripción</th> {/* Renamed */}
                                    <th style={styles.subTypeTh}>Acciones</th> {/* Renamed */}
                                </tr>
                            </thead>
                            <tbody>
                                {houseTypeSubTypes.map(st => ( // st for subType
                                    <tr key={st.sub_type_id}> {/* Use sub_type_id */}
                                        <td style={styles.subTypeTd}>{st.name}</td> {/* Renamed */}
                                        <td style={styles.subTypeTd}>{st.description || '-'}</td> {/* Renamed */}
                                        <td style={styles.subTypeTd}> {/* Renamed */}
                                            <button onClick={() => handleEditSubType(st)} style={{ ...styles.button, ...styles.buttonEdit, ...styles.subTypeButton }} disabled={subTypeLoading || !!editingSubTypeId}>Editar</button>
                                            <button onClick={() => handleDeleteSubType(st.sub_type_id)} style={{ ...styles.button, ...styles.buttonDelete, ...styles.subTypeButton }} disabled={subTypeLoading || !!editingSubTypeId}>Eliminar</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                    {!subTypeLoading && houseTypeSubTypes.length === 0 && <p>Este tipo de vivienda no tiene Sub-Tipos definidos.</p>}
                </div>
            )}


            {editingParamsFor && (
                <ParameterEditor
                    houseType={editingParamsFor}
                    parameters={allParameters}
                    subTypes={houseTypeSubTypes} // Pass subTypes down
                    existingValues={existingParamValues}
                    onSave={handleSaveParameterValues}
                    onCancel={handleCancelParameterEditor}
                    isLoading={paramEditorLoading}
                    error={paramEditorError}
                />
            )}

            {editingPanelsFor && (
                <HouseTypePanelsModal
                    houseType={editingPanelsFor} // houseType object now contains sub_types if fetched correctly
                    // If panels are specific to a sub_type, this modal will need a sub_type_id prop
                    // and the button opening it should pass it.
                    onClose={handleClosePanelsModal}
                />
            )}

            {isLoading && !houseTypes.length ? <p style={styles.loading}>Cargando tipos de vivienda...</p> : (
                <table style={styles.table}>
                    <thead>
                        <tr>
                            <th style={styles.th}>Nombre</th>
                            <th style={styles.th}>Descripción</th>
                            <th style={styles.th}>Módulos</th>
                            <th style={styles.th}>Sub-Tipos</th>
                            <th style={styles.th}>Parámetros</th>
                            <th style={styles.th}>Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {houseTypes.map((ht) => {
                            const paramsGrouped = (ht.parameters || []).reduce((acc, param) => {
                                const modKey = `mod_${param.module_sequence_number}`;
                                const subTypeKey = param.sub_type_id === null ? 'general' : `st_${param.sub_type_id}`; // Use sub_type_id
                                if (!acc[modKey]) acc[modKey] = { module_sequence_number: param.module_sequence_number, sub_types_params: {} }; // Renamed
                                if (!acc[modKey].sub_types_params[subTypeKey]) {
                                    acc[modKey].sub_types_params[subTypeKey] = {
                                        sub_type_id: param.sub_type_id, // Use sub_type_id
                                        sub_type_name: param.sub_type_name, // Use sub_type_name
                                        params: []
                                    };
                                }
                                acc[modKey].sub_types_params[subTypeKey].params.push(param);
                                return acc;
                            }, {});

                            const sortedModules = Object.values(paramsGrouped).sort((a, b) => a.module_sequence_number - b.module_sequence_number);

                            return (
                                <tr key={ht.house_type_id}>
                                    <td style={styles.td}>{ht.name}</td>
                                    <td style={styles.td}>{ht.description || '-'}</td>
                                    <td style={styles.td}>{ht.number_of_modules}</td>
                                    <td style={styles.td}> {/* SubTypes Cell */}
                                        {(ht.sub_types && ht.sub_types.length > 0) // Changed from tipologias
                                            ? ht.sub_types.map(st => st.name).join(', ')
                                            : <span style={{ fontStyle: 'italic', color: '#888' }}>Ninguno</span>
                                        }
                                    </td>
                                    <td style={styles.td}> {/* Parameters Cell */}
                                        {sortedModules.length === 0 && <span style={{ fontStyle: 'italic', color: '#888' }}>Ninguno</span>}
                                        {sortedModules.map(modGroup => (
                                            <div key={modGroup.module_sequence_number} style={{ marginBottom: '8px', borderBottom: sortedModules.length > 1 ? '1px dashed #eee' : 'none', paddingBottom: '5px' }}>
                                                <strong>Módulo {modGroup.module_sequence_number}:</strong>
                                                {Object.values(modGroup.sub_types_params).sort((a,b) => (a.sub_type_id === null ? -1 : b.sub_type_id === null ? 1 : a.sub_type_name.localeCompare(b.sub_type_name))).map(stGroup => ( // Renamed
                                                    <div key={stGroup.sub_type_id ?? 'general'} style={{ marginLeft: '10px', marginTop: '3px' }}>
                                                        <em style={{ fontSize: '0.95em' }}>{stGroup.sub_type_id === null ? 'General' : stGroup.sub_type_name || `Sub-Tipo ID: ${stGroup.sub_type_id}`}:</em>
                                                        {stGroup.params.length > 0 ? (
                                                            <ul style={{ margin: '2px 0 2px 15px', padding: 0, listStyleType: 'disc' }}>
                                                                {stGroup.params.sort((a,b) => a.parameter_name.localeCompare(b.parameter_name)).map(p => (
                                                                    <li key={p.parameter_id} style={{ fontSize: '0.9em' }}>
                                                                        {p.parameter_name} ({p.parameter_unit || 'N/A'}): {p.value}
                                                                    </li>
                                                                ))}
                                                            </ul>
                                                        ) : (
                                                            <span style={{ fontStyle: 'italic', marginLeft: '5px', fontSize: '0.9em' }}> (Sin valores específicos)</span>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        ))}
                                    </td>
                                    <td style={styles.td}>
                                        <button onClick={() => handleEdit(ht)} style={{...styles.button, ...styles.buttonEdit}} disabled={isLoading || !!editingParamsFor || !!editingPanelsFor || !!editMode}>Editar Info/Sub-Tipos</button>
                                        <button onClick={() => handleOpenParameterEditor(ht)} style={{...styles.button, ...styles.buttonPrimary}} disabled={isLoading || !!editingParamsFor || !!editingPanelsFor || !!editMode}>Parámetros</button>
                                        <button onClick={() => handleOpenPanelsModal(ht)} style={{ ...styles.button, backgroundColor: '#17a2b8', color: 'white' }} disabled={isLoading || !!editingParamsFor || !!editingPanelsFor || !!editMode}>Paneles</button>
                                        <button onClick={() => handleDelete(ht.house_type_id)} style={{ ...styles.button, ...styles.buttonDelete }} disabled={isLoading || !!editingParamsFor || !!editingPanelsFor || !!editMode}>Eliminar</button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            )}
            {!isLoading && houseTypes.length === 0 && <p>Aún no se han definido tipos de vivienda.</p>}
        </div>
    );
}

export default HouseTypesManager;
