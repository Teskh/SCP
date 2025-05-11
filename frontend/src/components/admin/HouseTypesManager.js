import React, { useState, useEffect, useCallback, Fragment } from 'react';
import * as adminService from '../../services/adminService';
import HouseTypePanelsModal from './HouseTypePanelsModal';

// --- Sub-component for Editing Parameters per Module ---
// NOTE: Component names and props remain in English for code consistency
const ParameterEditor = ({ houseType, parameters, tipologias, existingValues, onSave, onCancel, isLoading, error }) => {
    // State structure for values: { 'paramId_moduleSeq_tipologiaId': value }
    // tipologiaId can be 'null' for the general value or the actual tipologia_id
    const [values, setValues] = useState({});
    // State structure for generic checkbox: { 'paramId_moduleSeq': boolean }
    const [isGeneric, setIsGeneric] = useState({});

    // Initialize state with existing values and determine initial generic state
    useEffect(() => {
        const initialValues = {};
        const initialIsGeneric = {};

        // Populate initial values
        existingValues.forEach(ev => {
            const tipologiaKey = ev.tipologia_id === null ? 'null' : ev.tipologia_id;
            initialValues[`${ev.parameter_id}_${ev.module_sequence_number}_${tipologiaKey}`] = ev.value;
        });

        // Determine initial generic state: always default to generic (true) as per user request
        parameters.forEach(param => {
            for (let modSeq = 1; modSeq <= houseType.number_of_modules; modSeq++) {
                const genericKey = `${param.parameter_id}_${modSeq}`;
                initialIsGeneric[genericKey] = true; // Default to generic mode
            }
        });

        setValues(initialValues);
        setIsGeneric(initialIsGeneric);
    }, [existingValues, parameters, houseType.number_of_modules, tipologias]);

    const handleValueChange = (parameterId, moduleSequence, tipologiaId, value) => {
        const tipologiaKey = tipologiaId === null ? 'null' : tipologiaId;
        const key = `${parameterId}_${moduleSequence}_${tipologiaKey}`;
        setValues(prev => ({ ...prev, [key]: value }));
    };

    const handleGenericChange = (parameterId, moduleSequence, checked) => {
        const genericStateKey = `${parameterId}_${moduleSequence}`;
        setIsGeneric(prev => ({ ...prev, [genericStateKey]: checked }));

        // Clear values for the mode being switched *away* from
        setValues(prevValues => {
            const newValues = { ...prevValues };
            const hasTipologias = tipologias && tipologias.length > 0;

            if (checked) {
                // Switched TO Generic: Clear specific tipologia values
                if (hasTipologias) {
                    tipologias.forEach(t => {
                        const specificValueKey = `${parameterId}_${moduleSequence}_${t.tipologia_id}`;
                        if (newValues[specificValueKey] !== undefined) {
                            newValues[specificValueKey] = '';
                        }
                    });
                }
            } else {
                // Switched FROM Generic: Clear the general value
                const generalValueKey = `${parameterId}_${moduleSequence}_null`;
                if (newValues[generalValueKey] !== undefined) {
                    newValues[generalValueKey] = '';
                }
            }
            return newValues;
        });
    };

    const handleSave = () => {
        const changes = []; // { action: 'set'/'delete', parameter_id, module_sequence_number, tipologia_id, value? }
        const hasTipologias = tipologias && tipologias.length > 0;

        parameters.forEach(param => {
            for (let modSeq = 1; modSeq <= houseType.number_of_modules; modSeq++) {
                const genericKey = `${param.parameter_id}_${modSeq}`;
                const isParamGeneric = isGeneric[genericKey];

                // Helper to find original value
                const findOriginalValue = (tipologiaId) => {
                    return existingValues.find(ev =>
                        ev.parameter_id === param.parameter_id &&
                        ev.module_sequence_number === modSeq &&
                        ev.tipologia_id === tipologiaId
                    )?.value;
                };

                // Helper to process a single value (general or specific)
                const processSingleValue = (tipologiaId) => {
                    const tipologiaKey = tipologiaId === null ? 'null' : tipologiaId;
                    const valueKey = `${param.parameter_id}_${modSeq}_${tipologiaKey}`;
                    const currentValue = values[valueKey];
                    const originalValue = findOriginalValue(tipologiaId);

                    const isNumeric = currentValue !== undefined && currentValue !== null && currentValue !== '' && !isNaN(parseFloat(currentValue)) && isFinite(currentValue);
                    const isEmpty = currentValue === undefined || currentValue === null || currentValue === '';

                    if (isNumeric) {
                        const numericValue = parseFloat(currentValue);
                        if (numericValue != originalValue) {
                            changes.push({
                                action: 'set', parameter_id: param.parameter_id, module_sequence_number: modSeq,
                                tipologia_id: tipologiaId, value: numericValue
                            });
                        }
                    } else if (isEmpty && originalValue !== undefined) {
                        changes.push({
                            action: 'delete', parameter_id: param.parameter_id, module_sequence_number: modSeq,
                            tipologia_id: tipologiaId
                        });
                    } else if (!isEmpty && !isNumeric) {
                        console.warn(`Invalid number format for ${param.name} - Module ${modSeq} - Tipologia ${tipologiaKey}: ${currentValue}`);
                    }
                };

                if (isParamGeneric || !hasTipologias) {
                    processSingleValue(null);

                    if (hasTipologias) {
                        tipologias.forEach(t => {
                            const originalSpecificValue = findOriginalValue(t.tipologia_id);
                            if (originalSpecificValue !== undefined) {
                                changes.push({
                                    action: 'delete', parameter_id: param.parameter_id, module_sequence_number: modSeq,
                                    tipologia_id: t.tipologia_id
                                });
                            }
                        });
                    }
                } else {
                    const originalGeneralValue = findOriginalValue(null);
                    if (originalGeneralValue !== undefined) {
                        changes.push({
                            action: 'delete', parameter_id: param.parameter_id, module_sequence_number: modSeq,
                            tipologia_id: null
                        });
                    }

                    tipologias.forEach(t => {
                        processSingleValue(t.tipologia_id);
                    });
                }
            }
        });

        // Filter out potential duplicate delete actions before saving
        const uniqueChanges = changes.reduce((acc, current) => {
            const existingIndex = acc.findIndex(item =>
                item.action === current.action &&
                item.parameter_id === current.parameter_id &&
                item.module_sequence_number === current.module_sequence_number &&
                item.tipologia_id === current.tipologia_id
            );
            if (existingIndex === -1) {
                acc.push(current);
            } else if (current.action === 'set') {
                acc[existingIndex] = current;
            }
            return acc;
        }, []);

        onSave(uniqueChanges);
    };

    // Basic styling for the editor modal/section
    const editorStyles = {
        container: { marginTop: '20px', padding: '15px', border: '1px solid #ddd', borderRadius: '5px', background: '#f9f9f9' },
        moduleSection: { marginBottom: '15px', paddingBottom: '10px', borderBottom: '1px solid #eee' },
        paramRow: { display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '5px' },
        paramLabel: { minWidth: '150px', textAlign: 'right', fontWeight: 'bold', alignSelf: 'start', paddingTop: '5px' },
        paramUnit: { minWidth: '50px', color: '#666', alignSelf: 'start', paddingTop: '5px' },
        input: { padding: '5px', border: '1px solid #ccc', borderRadius: '3px', width: '100px', marginBottom: '3px' },
        inputGroup: { display: 'flex', flexDirection: 'column', gap: '2px' },
        tipologiaInputRow: { display: 'flex', gap: '5px', alignItems: 'center', marginLeft: '20px' },
        tipologiaLabel: { fontSize: '0.9em', color: '#555', minWidth: '80px' },
        genericCheckboxContainer: { display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '5px', marginLeft: '10px' },
        actions: { marginTop: '15px' },
        error: { color: 'red', marginBottom: '10px' }
    };

    const hasTipologias = tipologias && tipologias.length > 0;

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
                                    {hasTipologias && (
                                        <div style={editorStyles.genericCheckboxContainer}>
                                            <input
                                                type="checkbox"
                                                id={`generic_${genericKey}`}
                                                checked={isParamGeneric}
                                                onChange={(e) => handleGenericChange(param.parameter_id, moduleSeq, e.target.checked)}
                                            />
                                            <label htmlFor={`generic_${genericKey}`}>Valor Genérico</label>
                                        </div>
                                    )}

                                    <div style={editorStyles.inputGroup}>
                                        {(isParamGeneric || !hasTipologias) && (
                                            <div key={generalValueKey} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                                {!hasTipologias && <label style={{ ...editorStyles.tipologiaLabel, minWidth: 0 }}>Valor:</label>}
                                                {hasTipologias && <label style={editorStyles.tipologiaLabel} htmlFor={generalValueKey}>General:</label>}
                                                <input
                                                    id={generalValueKey}
                                                    type="number"
                                                    step="any"
                                                    style={editorStyles.input}
                                                    value={values[generalValueKey] || ''}
                                                    onChange={(e) => handleValueChange(param.parameter_id, moduleSeq, null, e.target.value)}
                                                    placeholder="Valor"
                                                />
                                            </div>
                                        )}

                                        {!isParamGeneric && hasTipologias && tipologias.map(t => {
                                            const tipologiaValueKey = `${param.parameter_id}_${moduleSeq}_${t.tipologia_id}`;
                                            return (
                                                <div key={tipologiaValueKey} style={editorStyles.tipologiaInputRow}>
                                                    <label style={editorStyles.tipologiaLabel} htmlFor={tipologiaValueKey}>{t.name}:</label>
                                                    <input
                                                        id={tipologiaValueKey}
                                                        type="number"
                                                        step="any"
                                                        style={editorStyles.input}
                                                        value={values[tipologiaValueKey] || ''}
                                                        onChange={(e) => handleValueChange(param.parameter_id, moduleSeq, t.tipologia_id, e.target.value)}
                                                        placeholder="Valor"
                                                    />
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
                <button onClick={onCancel} disabled={isLoading} style={styles.button}>
                    Cancelar
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
    loading: { fontStyle: 'italic' },
    // Tipologia specific styles
    tipologiaSection: { marginTop: '20px', padding: '15px', border: '1px solid #ddd', borderRadius: '5px', background: '#f9f9f9' },
    tipologiaTable: { width: '100%', borderCollapse: 'collapse', marginTop: '10px' },
    tipologiaTh: { border: '1px solid #ccc', padding: '6px', backgroundColor: '#e9e9e9', textAlign: 'left' },
    tipologiaTd: { border: '1px solid #ccc', padding: '6px' },
    tipologiaForm: { marginTop: '10px', padding: '10px', border: '1px solid #eee', borderRadius: '4px', display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' },
    tipologiaInput: { padding: '6px', border: '1px solid #ccc', borderRadius: '3px', flexGrow: 1, minWidth: '150px' },
    tipologiaButton: { padding: '4px 8px', fontSize: '0.9em' }
};

// NOTE: Keep initialFormState keys in English
const initialHouseTypeFormState = { name: '', description: '', number_of_modules: 1 };
const initialTipologiaFormState = { name: '', description: '' };

function HouseTypesManager() {
    const [houseTypes, setHouseTypes] = useState([]);
    const [allParameters, setAllParameters] = useState([]); // All defined HouseParameters
    const [isLoading, setIsLoading] = useState(false); // General loading for house types list/main form
    const [error, setError] = useState(''); // General error for house types list/main form
    const [editMode, setEditMode] = useState(null); // null or house_type_id for basic editing
    const [formData, setFormData] = useState(initialHouseTypeFormState);

    // State for the parameter editor
    const [editingParamsFor, setEditingParamsFor] = useState(null); // null or houseType object
    const [existingParamValues, setExistingParamValues] = useState([]);
    const [paramEditorLoading, setParamEditorLoading] = useState(false);
    const [paramEditorError, setParamEditorError] = useState('');

    // State for the panels modal
    const [editingPanelsFor, setEditingPanelsFor] = useState(null); // null or houseType object

    // State for Tipologias
    const [houseTypeTipologias, setHouseTypeTipologias] = useState([]);
    const [tipologiaFormData, setTipologiaFormData] = useState(initialTipologiaFormState);
    const [editingTipologiaId, setEditingTipologiaId] = useState(null); // null or tipologia_id
    const [tipologiaLoading, setTipologiaLoading] = useState(false);
    const [tipologiaError, setTipologiaError] = useState('');


    const fetchHouseTypesAndParams = useCallback(async () => {
        setIsLoading(true); // Loading for the main list
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
            setError(err.message || 'Error al obtener tipos de vivienda o parámetros');
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Fetch Tipologias for a specific House Type
    const fetchTipologias = useCallback(async (houseTypeId) => {
        if (!houseTypeId) return;
        setTipologiaLoading(true);
        setTipologiaError('');
        try {
            const data = await adminService.getHouseTypeTipologias(houseTypeId);
            setHouseTypeTipologias(data);
        } catch (err) {
            setTipologiaError(err.message || 'Error al obtener las tipologías');
            setHouseTypeTipologias([]); // Clear on error
        } finally {
            setTipologiaLoading(false);
        }
    }, []);


    useEffect(() => {
        fetchHouseTypesAndParams();
    }, [fetchHouseTypesAndParams]);

    const handleInputChange = (e) => {
        const { name, value, type } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'number' ? parseInt(value, 10) || 1 : value // Ensure number_of_modules is integer >= 1
        }));
    };

    const handleTipologiaInputChange = (e) => {
        const { name, value } = e.target;
        setTipologiaFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleEdit = (houseType) => {
        setEditMode(houseType.house_type_id);
        setFormData({
            name: houseType.name,
            description: houseType.description || '',
            number_of_modules: houseType.number_of_modules || 1
        });
        setEditingParamsFor(null); // Close parameter editor
        setEditingPanelsFor(null); // Close panels modal
        fetchTipologias(houseType.house_type_id); // Fetch tipologias for the selected house type
        setEditingTipologiaId(null); // Reset tipologia edit mode
        setTipologiaFormData(initialTipologiaFormState); // Reset tipologia form
        window.scrollTo(0, 0);
    };

    const handleCancelEdit = () => {
        setEditMode(null);
        setFormData(initialHouseTypeFormState);
        setError('');
        setHouseTypeTipologias([]); // Clear tipologias
        setTipologiaError('');
        setEditingTipologiaId(null);
        setTipologiaFormData(initialTipologiaFormState);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.name || formData.number_of_modules < 1) {
            setError('El Nombre del Tipo de Vivienda es obligatorio y el Número de Módulos debe ser al menos 1.');
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
            const newOrUpdatedId = editMode || (await adminService.getHouseTypes()).find(ht => ht.name === formData.name)?.house_type_id; // Re-fetch or get from response if API returns it
            handleCancelEdit();
            await fetchHouseTypesAndParams(); // Refresh list
            if (!editMode && newOrUpdatedId) { // If adding, open the new one for editing tipologias
                const newHouseType = houseTypes.find(ht => ht.house_type_id === newOrUpdatedId) || { house_type_id: newOrUpdatedId, ...formData }; // Find or construct
                if (newHouseType) handleEdit(newHouseType);
            }
        } catch (err) {
            setError(err.message || `Error al ${editMode ? 'guardar' : 'añadir'} el tipo de vivienda`);
        } finally {
            setIsLoading(false); // Stop main form loading
        }
    };

    const handleDelete = async (id) => {
        // Confirmation dialog in Spanish
        if (window.confirm('¿Está seguro de que desea eliminar este tipo de vivienda? Esto eliminará los módulos asociados, parámetros y podría afectar las definiciones de tareas.')) {
            setError('');
            setIsLoading(true); // Use general loading indicator
            try {
                await adminService.deleteHouseType(id);
                await fetchHouseTypesAndParams(); // Refresh list
                setEditingParamsFor(null); // Close editor if deleting the edited type
                handleCancelEdit(); // Also reset main form if deleting the edited type
            } catch (err) {
                setError(err.message || 'Error al eliminar el tipo de vivienda');
            } finally {
                setIsLoading(false);
            }
        }
    };

    // --- Tipologia Handlers ---
    const handleEditTipologia = (tipologia) => {
        setEditingTipologiaId(tipologia.tipologia_id);
        setTipologiaFormData({ name: tipologia.name, description: tipologia.description || '' });
        setTipologiaError('');
    };

    const handleCancelEditTipologia = () => {
        setEditingTipologiaId(null);
        setTipologiaFormData(initialTipologiaFormState);
        setTipologiaError('');
    };

    const handleTipologiaSubmit = async (e) => {
        e.preventDefault();
        if (!tipologiaFormData.name || !editMode) {
            setTipologiaError('El nombre de la tipología es obligatorio.');
            return;
        }
        setTipologiaLoading(true);
        setTipologiaError('');
        try {
            if (editingTipologiaId) {
                await adminService.updateHouseTypeTipologia(editingTipologiaId, tipologiaFormData);
            } else {
                await adminService.addHouseTypeTipologia(editMode, tipologiaFormData);
            }
            handleCancelEditTipologia();
            await fetchTipologias(editMode); // Refresh tipologias list
        } catch (err) {
            setTipologiaError(err.message || `Error al ${editingTipologiaId ? 'actualizar' : 'añadir'} la tipología`);
        } finally {
            setTipologiaLoading(false);
        }
    };

    const handleDeleteTipologia = async (tipologiaId) => {
        if (window.confirm('¿Está seguro de que desea eliminar esta tipología? Esto eliminará los valores de parámetros específicos asociados.')) {
            setTipologiaLoading(true);
            setTipologiaError('');
            try {
                await adminService.deleteHouseTypeTipologia(tipologiaId);
                await fetchTipologias(editMode); // Refresh tipologias list
                handleCancelEditTipologia(); // Ensure edit form is closed if deleting the edited one
            } catch (err) {
                setTipologiaError(err.message || 'Error al eliminar la tipología');
            } finally {
                setTipologiaLoading(false);
            }
        }
    };


    // --- Panel Modal Handlers ---
    const handleOpenPanelsModal = (houseType) => {
        setEditingPanelsFor(houseType);
        setEditMode(null); // Close main edit form
        setEditingParamsFor(null); // Close parameter editor
        setHouseTypeTipologias([]); // Clear tipologias
    };

    const handleClosePanelsModal = () => {
        setEditingPanelsFor(null);
        // Optionally refetch data if panels might affect other parts, though unlikely here
        // fetchHouseTypesAndParams();
    };

    // --- Parameter Editor Logic ---

    const handleOpenParameterEditor = async (houseType) => {
        setEditingParamsFor(houseType);
        setParamEditorLoading(true);
        setParamEditorError('');
        setEditMode(null); // Close main edit form
        setFormData(initialHouseTypeFormState);
        setEditingPanelsFor(null); // Close panels modal
        setHouseTypeTipologias([]); // Clear tipologias first

        try {
            // Fetch both parameters and tipologias needed for the editor
            const [values, tipologiasData] = await Promise.all([
                adminService.getParametersForHouseType(houseType.house_type_id),
                adminService.getHouseTypeTipologias(houseType.house_type_id)
            ]);
            setExistingParamValues(values);
            setHouseTypeTipologias(tipologiasData); // Set tipologias for the editor
        } catch (err) {
            setParamEditorError(err.message || 'Error al cargar datos para el editor de parámetros.');
            setExistingParamValues([]);
            setHouseTypeTipologias([]);
        } finally {
            setParamEditorLoading(false);
        }
    };

    const handleCancelParameterEditor = () => {
        setEditingParamsFor(null);
        setExistingParamValues([]);
        setParamEditorError('');
        setHouseTypeTipologias([]); // Clear tipologias when closing editor
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
            // Use Promise.all to run saves/deletes concurrently
            await Promise.all(changes.map(change => {
                if (change.action === 'set') {
                    requiresRefetch = true;
                    return adminService.setHouseTypeParameter(
                        editingParamsFor.house_type_id,
                        change.parameter_id,
                        change.module_sequence_number,
                        change.value,
                        change.tipologia_id // Pass tipologia_id (can be null)
                    );
                } else if (change.action === 'delete') {
                    requiresRefetch = true;
                    return adminService.deleteParameterFromHouseTypeModule(
                        editingParamsFor.house_type_id,
                        change.parameter_id,
                        change.module_sequence_number,
                        change.tipologia_id // Pass tipologia_id (can be null)
                    );
                }
                return Promise.resolve(); // Should not happen
            }));
        } catch (err) {
            success = false;
            setParamEditorError(err.message || 'Error al guardar uno o más cambios de parámetros.');
        } finally {
            setParamEditorLoading(false);
            if (success) {
                handleCancelParameterEditor(); // Close editor on success
                if (requiresRefetch) {
                    // Re-fetch main data if parameters were actually changed
                    // This ensures the main table display is updated
                    fetchHouseTypesAndParams();
                }
            }
        }
    };


    return (
        <div style={styles.container}>
            <h2>Gestionar Tipos de Vivienda</h2>
            {error && <p style={styles.error}>{error}</p>}

            {/* Form for Adding/Editing House Type basic info */}
            {!editingParamsFor && !editingPanelsFor && ( // Only show form if not editing parameters or panels
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
                        <button type="submit" disabled={isLoading} style={styles.button}>
                            {isLoading ? 'Guardando...' : (editMode ? 'Actualizar Tipo Vivienda' : 'Añadir Tipo Vivienda')}
                        </button>
                        {editMode && (
                            <button type="button" onClick={handleCancelEdit} style={styles.button} disabled={isLoading}>Cancelar</button>
                        )}
                    </div>
                </form>
            )}

            {/* Tipologia Management Section - Shown only when editing a House Type */}
            {editMode && !editingParamsFor && !editingPanelsFor && (
                <div style={styles.tipologiaSection}>
                    <h4>Gestionar Tipologías para: {formData.name}</h4>
                    {tipologiaError && <p style={styles.error}>{tipologiaError}</p>}

                    {/* Form for Adding/Editing Tipologia */}
                    <form onSubmit={handleTipologiaSubmit} style={styles.tipologiaForm}>
                        <h5>{editingTipologiaId ? 'Editar Tipología' : 'Añadir Nueva Tipología'}</h5>
                        <input
                            type="text"
                            name="name"
                            placeholder="Nombre Tipología (ej: Single, Duplex)"
                            value={tipologiaFormData.name}
                            onChange={handleTipologiaInputChange}
                            required
                            style={styles.tipologiaInput}
                            disabled={tipologiaLoading}
                        />
                        <input
                            type="text"
                            name="description"
                            placeholder="Descripción (Opcional)"
                            value={tipologiaFormData.description}
                            onChange={handleTipologiaInputChange}
                            style={styles.tipologiaInput}
                            disabled={tipologiaLoading}
                        />
                        <button type="submit" disabled={tipologiaLoading} style={{ ...styles.button, ...styles.tipologiaButton }}>
                            {tipologiaLoading ? 'Guardando...' : (editingTipologiaId ? 'Actualizar' : 'Añadir')}
                        </button>
                        {editingTipologiaId && (
                            <button type="button" onClick={handleCancelEditTipologia} style={{ ...styles.button, ...styles.tipologiaButton }} disabled={tipologiaLoading}>
                                Cancelar Edición
                            </button>
                        )}
                    </form>

                    {/* Table of Existing Tipologias */}
                    {tipologiaLoading && <p style={styles.loading}>Cargando tipologías...</p>}
                    {!tipologiaLoading && houseTypeTipologias.length > 0 && (
                        <table style={styles.tipologiaTable}>
                            <thead>
                                <tr>
                                    <th style={styles.tipologiaTh}>Nombre</th>
                                    <th style={styles.tipologiaTh}>Descripción</th>
                                    <th style={styles.tipologiaTh}>Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {houseTypeTipologias.map(t => (
                                    <tr key={t.tipologia_id}>
                                        <td style={styles.tipologiaTd}>{t.name}</td>
                                        <td style={styles.tipologiaTd}>{t.description || '-'}</td>
                                        <td style={styles.tipologiaTd}>
                                            <button onClick={() => handleEditTipologia(t)} style={{ ...styles.button, ...styles.tipologiaButton }} disabled={tipologiaLoading || !!editingTipologiaId}>Editar</button>
                                            <button onClick={() => handleDeleteTipologia(t.tipologia_id)} style={{ ...styles.button, ...styles.tipologiaButton }} disabled={tipologiaLoading || !!editingTipologiaId}>Eliminar</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                    {!tipologiaLoading && houseTypeTipologias.length === 0 && <p>Este tipo de vivienda no tiene tipologías definidas.</p>}
                </div>
            )}


            {/* Parameter Editor Section */}
            {editingParamsFor && (
                <ParameterEditor
                    houseType={editingParamsFor}
                    parameters={allParameters}
                    tipologias={houseTypeTipologias} // Pass tipologias down
                    existingValues={existingParamValues}
                    onSave={handleSaveParameterValues}
                    onCancel={handleCancelParameterEditor}
                    isLoading={paramEditorLoading}
                    error={paramEditorError}
                />
            )}

            {/* Panels Modal */}
            {editingPanelsFor && (
                <HouseTypePanelsModal
                    houseType={editingPanelsFor}
                    onClose={handleClosePanelsModal}
                />
            )}

            {/* Table of House Types */}
            {isLoading && !houseTypes.length ? <p style={styles.loading}>Cargando tipos de vivienda...</p> : (
                <table style={styles.table}>
                    <thead>
                        <tr>
                            <th style={styles.th}>Nombre</th>
                            <th style={styles.th}>Descripción</th>
                            <th style={styles.th}>Módulos</th>
                            <th style={styles.th}>Tipologías</th>
                            <th style={styles.th}>Parámetros</th>
                            <th style={styles.th}>Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {houseTypes.map((ht) => {
                            // Group parameters by module and then by tipologia for display
                            const paramsGrouped = (ht.parameters || []).reduce((acc, param) => {
                                const modKey = `mod_${param.module_sequence_number}`;
                                const tipoKey = param.tipologia_id === null ? 'general' : `tipo_${param.tipologia_id}`;
                                if (!acc[modKey]) acc[modKey] = { module_sequence_number: param.module_sequence_number, tipologias: {} };
                                if (!acc[modKey].tipologias[tipoKey]) {
                                    acc[modKey].tipologias[tipoKey] = {
                                        tipologia_id: param.tipologia_id,
                                        tipologia_name: param.tipologia_name, // Assuming backend provides this
                                        params: []
                                    };
                                }
                                acc[modKey].tipologias[tipoKey].params.push(param);
                                return acc;
                            }, {});

                            // Sort modules
                            const sortedModules = Object.values(paramsGrouped).sort((a, b) => a.module_sequence_number - b.module_sequence_number);

                            return (
                                <tr key={ht.house_type_id}>
                                    <td style={styles.td}>{ht.name}</td>
                                    <td style={styles.td}>{ht.description || '-'}</td>
                                    <td style={styles.td}>{ht.number_of_modules}</td>
                                    <td style={styles.td}> {/* Tipologias Cell */}
                                        {(ht.tipologias && ht.tipologias.length > 0)
                                            ? ht.tipologias.map(t => t.name).join(', ')
                                            : <span style={{ fontStyle: 'italic', color: '#888' }}>Ninguna</span>
                                        }
                                    </td>
                                    <td style={styles.td}> {/* Parameters Cell */}
                                        {sortedModules.length === 0 && <span style={{ fontStyle: 'italic', color: '#888' }}>Ninguno</span>}
                                        {sortedModules.map(modGroup => (
                                            <div key={modGroup.module_sequence_number} style={{ marginBottom: '8px', borderBottom: sortedModules.length > 1 ? '1px dashed #eee' : 'none', paddingBottom: '5px' }}>
                                                <strong>Módulo {modGroup.module_sequence_number}:</strong>
                                                {Object.values(modGroup.tipologias).sort((a,b) => (a.tipologia_id === null ? -1 : b.tipologia_id === null ? 1 : a.tipologia_name.localeCompare(b.tipologia_name))).map(tipoGroup => (
                                                    <div key={tipoGroup.tipologia_id ?? 'general'} style={{ marginLeft: '10px', marginTop: '3px' }}>
                                                        <em style={{ fontSize: '0.95em' }}>{tipoGroup.tipologia_id === null ? 'General' : tipoGroup.tipologia_name || `Tipología ID: ${tipoGroup.tipologia_id}`}:</em>
                                                        {tipoGroup.params.length > 0 ? (
                                                            <ul style={{ margin: '2px 0 2px 15px', padding: 0, listStyleType: 'disc' }}>
                                                                {tipoGroup.params.sort((a,b) => a.parameter_name.localeCompare(b.parameter_name)).map(p => (
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
                                        {/* Disable buttons based on current mode */}
                                        <button onClick={() => handleEdit(ht)} style={styles.button} disabled={isLoading || !!editingParamsFor || !!editingPanelsFor || editMode === ht.house_type_id}>Editar Info/Tipologías</button>
                                        <button onClick={() => handleOpenParameterEditor(ht)} style={styles.button} disabled={isLoading || !!editingParamsFor || !!editingPanelsFor || editMode === ht.house_type_id}>Editar Parámetros</button>
                                        <button onClick={() => handleOpenPanelsModal(ht)} style={{ ...styles.button, backgroundColor: '#17a2b8', color: 'white' }} disabled={isLoading || !!editingParamsFor || !!editingPanelsFor || editMode === ht.house_type_id}>Paneles</button>
                                        <button onClick={() => handleDelete(ht.house_type_id)} style={{ ...styles.button, backgroundColor: '#dc3545', color: 'white' }} disabled={isLoading || !!editingParamsFor || !!editingPanelsFor || editMode === ht.house_type_id}>Eliminar</button>
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
