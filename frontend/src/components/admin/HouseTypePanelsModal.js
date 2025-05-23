import React, { useState, useEffect, useCallback, useMemo } from 'react';
import * as adminService from '../../services/adminService';

// Basic Modal Styling (styles assumed to be similar to previous version)
const modalStyles = {
    overlay: {
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    },
    content: {
        background: 'white', padding: '30px', borderRadius: '8px',
        maxWidth: '90%', width: '850px', // Adjusted width
        maxHeight: '90vh', overflowY: 'auto', position: 'relative',
        boxShadow: '0 4px 15px rgba(0,0,0,0.2)',
    },
    closeButton: {
        position: 'absolute', top: '15px', right: '15px',
        background: 'transparent', border: 'none', fontSize: '1.5rem', cursor: 'pointer',
        color: '#666',
    },
    header: { marginTop: 0, marginBottom: '20px', borderBottom: '1px solid #eee', paddingBottom: '10px' },
    selectorsContainer: { display: 'flex', gap: '20px', marginBottom: '20px' },
    moduleSelector: { display: 'flex', alignItems: 'center', gap: '10px' },
    subTypeSelector: { display: 'flex', alignItems: 'center', gap: '10px' },
    label: { fontWeight: 'bold' },
    select: { padding: '8px', border: '1px solid #ccc', borderRadius: '4px', minWidth: '150px' },
    panelSection: { marginBottom: '20px' },
    panelGroupHeader: { marginTop: '15px', marginBottom: '10px', fontWeight: 'bold', fontSize: '1.1em', borderBottom: '1px solid #eee', paddingBottom: '5px' },
    panelList: { listStyle: 'none', padding: 0 },
    panelItem: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #f0f0f0' },
    panelDetails: { flexGrow: 1, marginRight: '10px' },
    panelCode: { fontWeight: 'bold' },
    panelSubType: { fontSize: '0.9em', color: '#555', marginLeft: '10px' }, // For displaying sub-type
    buttonGroup: { display: 'flex', gap: '5px' },
    button: { cursor: 'pointer', padding: '5px 10px', border: 'none', borderRadius: '4px', color: 'white' },
    buttonEdit: { backgroundColor: '#ffc107', color: '#333' },
    buttonDelete: { backgroundColor: '#dc3545' },
    buttonAdd: { backgroundColor: '#28a745', marginTop: '10px' },
    buttonCancel: { backgroundColor: '#6c757d' },
    form: { marginTop: '15px', padding: '15px', border: '1px solid #eee', borderRadius: '5px', background: '#f9f9f9' },
    formGroup: { marginBottom: '10px' },
    formLabel: { display: 'block', marginBottom: '5px', fontWeight: 'bold' },
    formInput: { width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px', boxSizing: 'border-box' },
    formSelect: { width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px', boxSizing: 'border-box' },
    error: { color: 'red', marginTop: '10px', fontSize: '0.9em' },
    loading: { fontStyle: 'italic', color: '#666', textAlign: 'center', padding: '20px' },
    infoText: { fontSize: '0.9em', color: '#444', marginBottom: '10px', fontStyle: 'italic'},
};

const PANEL_GROUPS = ['Paneles de Piso', 'Paneles de Cielo', 'Paneles Perimetrales', 'Tabiques Interiores', 'Vigas Cajón', 'Otros'];

const initialPanelFormState = {
    panel_group: PANEL_GROUPS[0],
    panel_code: '',
    // sub_type_id will be set from selectedSubTypeId context or during edit
    multiwall_id: '',
};

function HouseTypePanelsModal({ houseType, onClose }) {
    const { house_type_id, name: houseTypeName, number_of_modules, sub_types = [] } = houseType;
    const [selectedModule, setSelectedModule] = useState(1);
    const [selectedSubTypeId, setSelectedSubTypeId] = useState(null); // null for 'Common', or an ID
    const [panelDefinitions, setPanelDefinitions] = useState([]); // Renamed from panels
    const [multiwalls, setMultiwalls] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const [isAddingPanel, setIsAddingPanel] = useState(false);
    const [editingPanel, setEditingPanel] = useState(null);
    const [panelFormData, setPanelFormData] = useState(initialPanelFormState);

    const [isAddingMultiwall, setIsAddingMultiwall] = useState(false);
    const [editingMultiwall, setEditingMultiwall] = useState(null);
    const [multiwallFormData, setMultiwallFormData] = useState({ panel_group: PANEL_GROUPS[0], multiwall_code: '' });

    const moduleOptions = useMemo(() =>
        Array.from({ length: number_of_modules }, (_, i) => i + 1),
        [number_of_modules]
    );

    const fetchDataForModuleAndSubType = useCallback(async (moduleId, subTypeId) => {
        if (!house_type_id || !moduleId) return;
        setIsLoading(true);
        setError('');
        try {
            const [panelsData, multiwallsData] = await Promise.all([
                adminService.getPanelDefinitions(house_type_id, moduleId, subTypeId), // Pass subTypeId
                adminService.getMultiwalls(house_type_id) // Multiwalls are per house type
            ]);
            setPanelDefinitions(panelsData || []);
            setMultiwalls(multiwallsData || []);
        } catch (err) {
            setError(`Error al cargar datos: ${err.message}`);
            setPanelDefinitions([]);
            setMultiwalls([]);
        } finally {
            setIsLoading(false);
        }
    }, [house_type_id]);

    useEffect(() => {
        fetchDataForModuleAndSubType(selectedModule, selectedSubTypeId);
    }, [selectedModule, selectedSubTypeId, fetchDataForModuleAndSubType]);

    const handleModuleChange = (e) => {
        setSelectedModule(parseInt(e.target.value, 10));
        handleCancelAllForms();
    };

    const handleSubTypeChange = (e) => {
        const val = e.target.value;
        setSelectedSubTypeId(val === 'null' || val === '' ? null : parseInt(val, 10));
        handleCancelAllForms();
    };
    
    const handleCancelAllForms = () => {
        setIsAddingPanel(false);
        setEditingPanel(null);
        setIsAddingMultiwall(false);
        setEditingMultiwall(null);
        setError('');
    }

    const handlePanelInputChange = (e) => {
        const { name, value } = e.target;
        setPanelFormData(prev => ({ ...prev, [name]: value }));
        if (name === 'panel_group') {
            setPanelFormData(prev => ({ ...prev, multiwall_id: '' }));
        }
    };

    const handleAddPanelClick = () => {
        handleCancelAllForms();
        setPanelFormData({...initialPanelFormState, panel_group: PANEL_GROUPS[0] }); // Reset with default group
        setIsAddingPanel(true);
    };

    const handleEditPanelClick = (panel) => {
        handleCancelAllForms();
        setEditingPanel(panel);
        setPanelFormData({
            panel_group: panel.panel_group,
            panel_code: panel.panel_code,
            multiwall_id: panel.multiwall_id?.toString() || '',
            sub_type_id: panel.sub_type_id, // Store original sub_type_id for update
        });
        setIsAddingPanel(true); // Use the same form for add/edit
    };
    
    const handleCancelPanel = () => {
        setIsAddingPanel(false);
        setEditingPanel(null);
        setError('');
    };

    const handleMultiwallInputChange = (e) => {
        const { name, value } = e.target;
        setMultiwallFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleAddMultiwallClick = () => {
        handleCancelAllForms();
        setMultiwallFormData({ panel_group: PANEL_GROUPS[0], multiwall_code: '' });
        setIsAddingMultiwall(true);
    };

    const handleEditMultiwallClick = (mw) => {
        handleCancelAllForms();
        setEditingMultiwall(mw);
        setMultiwallFormData({ panel_group: mw.panel_group, multiwall_code: mw.multiwall_code });
        setIsAddingMultiwall(true); // Use same form
    };

    const handleCancelMultiwall = () => {
        setIsAddingMultiwall(false);
        setEditingMultiwall(null);
        setError('');
    };

    const handleSubmitPanel = async (e) => {
        e.preventDefault();
        if (!panelFormData.panel_code.trim()) {
            setError("El código del panel es obligatorio.");
            return;
        }
        setError('');
        setIsLoading(true);

        const payload = {
            panel_group: panelFormData.panel_group,
            panel_code: panelFormData.panel_code.trim(),
            multiwall_id: panelFormData.multiwall_id ? parseInt(panelFormData.multiwall_id, 10) : null,
            // If editing, use the panel's original sub_type_id. If adding, use the selected context.
            sub_type_id: editingPanel ? editingPanel.sub_type_id : selectedSubTypeId,
        };
        
        if (payload.multiwall_id) {
            const selectedMw = multiwalls.find(mw => mw.multiwall_id === payload.multiwall_id);
            if (!selectedMw || selectedMw.panel_group !== payload.panel_group) {
                setError("El grupo del panel debe coincidir con el grupo del Multiwall seleccionado.");
                setIsLoading(false);
                return;
            }
        }

        try {
            if (editingPanel) {
                await adminService.updatePanelDefinition(editingPanel.panel_definition_id, payload);
            } else {
                await adminService.addPanelDefinition(house_type_id, selectedModule, payload);
            }
            await fetchDataForModuleAndSubType(selectedModule, selectedSubTypeId);
            handleCancelPanel();
        } catch (err) {
            setError(`Error al guardar definición de panel: ${err.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDeletePanel = async (panelDefId) => {
        if (window.confirm('¿Está seguro de que desea eliminar esta definición de panel?')) {
            setError('');
            setIsLoading(true);
            try {
                await adminService.deletePanelDefinition(panelDefId);
                await fetchDataForModuleAndSubType(selectedModule, selectedSubTypeId);
                handleCancelPanel();
            } catch (err) {
                setError(`Error al eliminar definición de panel: ${err.message}`);
            } finally {
                setIsLoading(false);
            }
        }
    };

     const handleSubmitMultiwall = async (e) => {
        e.preventDefault();
        if (!multiwallFormData.multiwall_code.trim()) {
            setError("El código del Multiwall es obligatorio.");
            return;
        }
        setError('');
        setIsLoading(true);

        const payload = {
            panel_group: multiwallFormData.panel_group,
            multiwall_code: multiwallFormData.multiwall_code.trim(),
        };

        try {
            if (editingMultiwall) {
                await adminService.updateMultiwall(editingMultiwall.multiwall_id, payload);
            } else {
                // AddMultiwall in service expects houseTypeId (moduleSequenceNumber was removed)
                await adminService.addMultiwall(house_type_id, payload);
            }
            await fetchDataForModuleAndSubType(selectedModule, selectedSubTypeId); // Refresh multiwalls too
            handleCancelMultiwall();
        } catch (err) {
            setError(`Error al guardar Multiwall: ${err.message}`);
        } finally {
            setIsLoading(false);
        }
    };

     const handleDeleteMultiwall = async (multiwallId) => {
        if (window.confirm('¿Está seguro de que desea eliminar este Multiwall? Los paneles asociados se desagruparán.')) {
            setError('');
            setIsLoading(true);
            try {
                await adminService.deleteMultiwall(multiwallId);
                await fetchDataForModuleAndSubType(selectedModule, selectedSubTypeId);
                handleCancelMultiwall();
            } catch (err) {
                setError(`Error al eliminar Multiwall: ${err.message}`);
            } finally {
                setIsLoading(false);
            }
        }
    };

    const groupedData = useMemo(() => {
        const groups = {};
        PANEL_GROUPS.forEach(group => {
            groups[group] = { multiwalls: [], panel_definitions: [] }; // Renamed panels to panel_definitions
        });

        multiwalls.forEach(mw => {
            if (groups[mw.panel_group]) {
                groups[mw.panel_group].multiwalls.push({ ...mw, panel_definitions: [] });
            }
        });

        panelDefinitions.forEach(pd => { // Renamed panel to pd
            if (groups[pd.panel_group]) {
                if (pd.multiwall_id) {
                    const parentMultiwall = groups[pd.panel_group].multiwalls.find(mw => mw.multiwall_id === pd.multiwall_id);
                    if (parentMultiwall) {
                        parentMultiwall.panel_definitions.push(pd);
                    } else {
                        groups[pd.panel_group].panel_definitions.push(pd);
                    }
                } else {
                    groups[pd.panel_group].panel_definitions.push(pd);
                }
            }
        });

         Object.values(groups).forEach(groupData => {
            groupData.multiwalls.sort((a, b) => a.multiwall_code.localeCompare(b.multiwall_code));
            groupData.multiwalls.forEach(mw => {
                mw.panel_definitions.sort((a, b) => a.panel_code.localeCompare(b.panel_code));
            });
            groupData.panel_definitions.sort((a, b) => a.panel_code.localeCompare(b.panel_code));
        });
        return groups;
    }, [panelDefinitions, multiwalls]);

    const availableMultiwallsForPanelForm = useMemo(() => {
        return multiwalls.filter(mw => mw.panel_group === panelFormData.panel_group);
    }, [multiwalls, panelFormData.panel_group]);

    const currentSubTypeContextName = selectedSubTypeId 
        ? (sub_types.find(st => st.sub_type_id === selectedSubTypeId)?.name || `ID: ${selectedSubTypeId}`) 
        : 'Común a todos los Sub-Tipos';

    return (
        <div style={modalStyles.overlay} onClick={onClose}>
            <div style={modalStyles.content} onClick={(e) => e.stopPropagation()}>
                <button onClick={onClose} style={modalStyles.closeButton} aria-label="Cerrar">&times;</button>
                <h2 style={modalStyles.header}>Gestionar Definiciones de Paneles para: {houseTypeName}</h2>

                <div style={modalStyles.selectorsContainer}>
                    <div style={modalStyles.moduleSelector}>
                        <label htmlFor="moduleSelect" style={modalStyles.label}>Módulo:</label>
                        <select id="moduleSelect" value={selectedModule} onChange={handleModuleChange} style={modalStyles.select} disabled={isLoading}>
                            {moduleOptions.map(modNum => (<option key={modNum} value={modNum}>Módulo {modNum}</option>))}
                        </select>
                    </div>
                    <div style={modalStyles.subTypeSelector}>
                        <label htmlFor="subTypeSelect" style={modalStyles.label}>Contexto de Sub-Tipo:</label>
                        <select id="subTypeSelect" value={selectedSubTypeId === null ? 'null' : selectedSubTypeId} onChange={handleSubTypeChange} style={modalStyles.select} disabled={isLoading}>
                            <option value="null">Común a todos los Sub-Tipos</option>
                            {sub_types.map(st => (<option key={st.sub_type_id} value={st.sub_type_id}>{st.name}</option>))}
                        </select>
                    </div>
                </div>
                <p style={modalStyles.infoText}>Mostrando paneles para: Módulo {selectedModule} - {currentSubTypeContextName}</p>


                {error && <p style={modalStyles.error}>{error}</p>}

                {isLoading ? (
                    <p style={modalStyles.loading}>Cargando datos...</p>
                ) : (
                    <div>
                        {PANEL_GROUPS.map(group => (
                            <div key={group} style={modalStyles.panelSection}>
                                <h3 style={modalStyles.panelGroupHeader}>{group}</h3>
                                {groupedData[group] && (groupedData[group].multiwalls.length > 0 || groupedData[group].panel_definitions.length > 0) ? (
                                    <>
                                        {groupedData[group].multiwalls.map(mw => (
                                            <div key={`mw-${mw.multiwall_id}`} style={{ marginLeft: '10px', marginBottom: '15px', borderLeft: '3px solid #007bff', paddingLeft: '10px' }}>
                                                <div style={{...modalStyles.panelItem, borderBottom: '1px solid #ccc', marginBottom: '5px'}}>
                                                    <strong style={{ flexGrow: 1 }}>Multiwall: {mw.multiwall_code}</strong>
                                                    <div style={modalStyles.buttonGroup}>
                                                        <button onClick={() => handleEditMultiwallClick(mw)} style={{...modalStyles.button, ...modalStyles.buttonEdit, padding: '3px 8px'}} disabled={isLoading}>Editar MW</button>
                                                        <button onClick={() => handleDeleteMultiwall(mw.multiwall_id)} style={{...modalStyles.button, ...modalStyles.buttonDelete, padding: '3px 8px'}} disabled={isLoading}>Eliminar MW</button>
                                                    </div>
                                                </div>
                                                {mw.panel_definitions.length > 0 ? (
                                                    <ul style={{...modalStyles.panelList, marginLeft: '15px'}}>
                                                        {mw.panel_definitions.map(pd => (
                                                            <li key={pd.panel_definition_id} style={{...modalStyles.panelItem, padding: '5px 0'}}>
                                                                <div style={modalStyles.panelDetails}>
                                                                    <span style={modalStyles.panelCode}>{pd.panel_code}</span>
                                                                    {/* Panel's own sub_type_name is displayed if available from getPanelDefinitions */}
                                                                    {pd.sub_type_name && <span style={modalStyles.panelSubType}>(Sub-Tipo: {pd.sub_type_name})</span>}
                                                                </div>
                                                                <div style={modalStyles.buttonGroup}>
                                                                    <button onClick={() => handleEditPanelClick(pd)} style={{...modalStyles.button, ...modalStyles.buttonEdit}} disabled={isLoading}>Editar</button>
                                                                    <button onClick={() => handleDeletePanel(pd.panel_definition_id)} style={{...modalStyles.button, ...modalStyles.buttonDelete}} disabled={isLoading}>Eliminar</button>
                                                                </div>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                ) : (
                                                     <p style={{ fontSize: '0.85em', color: '#666', marginLeft: '15px', fontStyle: 'italic' }}>No hay definiciones de panel en este Multiwall.</p>
                                                )}
                                            </div>
                                        ))}

                                        {groupedData[group].panel_definitions.length > 0 && (
                                            <ul style={modalStyles.panelList}>
                                                {groupedData[group].panel_definitions.map(pd => (
                                                    <li key={pd.panel_definition_id} style={modalStyles.panelItem}>
                                                        <div style={modalStyles.panelDetails}>
                                                            <span style={modalStyles.panelCode}>{pd.panel_code}</span>
                                                            {pd.sub_type_name && <span style={modalStyles.panelSubType}>(Sub-Tipo: {pd.sub_type_name})</span>}
                                                            <span style={modalStyles.panelSubType}>(No agrupado en Multiwall)</span>
                                                        </div>
                                                        <div style={modalStyles.buttonGroup}>
                                                            <button onClick={() => handleEditPanelClick(pd)} style={{...modalStyles.button, ...modalStyles.buttonEdit}} disabled={isLoading}>Editar</button>
                                                            <button onClick={() => handleDeletePanel(pd.panel_definition_id)} style={{...modalStyles.button, ...modalStyles.buttonDelete}} disabled={isLoading}>Eliminar</button>
                                                        </div>
                                                    </li>
                                                ))}
                                            </ul>
                                        )}
                                    </>
                                ) : (
                                    <p style={{ fontSize: '0.9em', color: '#666' }}>No hay Multiwalls ni definiciones de panel en este grupo para el contexto seleccionado.</p>
                                )}
                            </div>
                        ))}

                        {(isAddingPanel || editingPanel) && (
                            <form onSubmit={handleSubmitPanel} style={modalStyles.form}>
                                <h4>{editingPanel ? `Editar Definición de Panel (Contexto: ${currentSubTypeContextName})` : `Añadir Nueva Definición de Panel (Contexto: ${currentSubTypeContextName})`}</h4>
                                {editingPanel && <p style={modalStyles.infoText}>Editando panel ID: {editingPanel.panel_definition_id}. El Sub-Tipo asociado (si existe) no se cambia desde este formulario.</p>}
                                <div style={modalStyles.formGroup}>
                                    <label htmlFor="panel_group" style={modalStyles.formLabel}>Grupo Panel:</label>
                                    <select id="panel_group" name="panel_group" value={panelFormData.panel_group} onChange={handlePanelInputChange} required style={modalStyles.formSelect} disabled={isLoading}>
                                        {PANEL_GROUPS.map(group => (<option key={group} value={group}>{group}</option>))}
                                    </select>
                                </div>
                                <div style={modalStyles.formGroup}>
                                    <label htmlFor="panel_code" style={modalStyles.formLabel}>Código Panel:</label>
                                    <input type="text" id="panel_code" name="panel_code" value={panelFormData.panel_code} onChange={handlePanelInputChange} required style={modalStyles.formInput} disabled={isLoading} />
                                </div>
                                <div style={modalStyles.formGroup}>
                                    <label htmlFor="multiwall_id" style={modalStyles.formLabel}>Asignar a Multiwall (Opcional):</label>
                                    <select id="multiwall_id" name="multiwall_id" value={panelFormData.multiwall_id} onChange={handlePanelInputChange} style={modalStyles.formSelect} disabled={isLoading || availableMultiwallsForPanelForm.length === 0}>
                                        <option value="">-- No Agrupado --</option>
                                        {availableMultiwallsForPanelForm.map(mw => (
                                            <option key={mw.multiwall_id} value={mw.multiwall_id}>{mw.multiwall_code} ({mw.panel_group})</option>
                                        ))}
                                    </select>
                                     {availableMultiwallsForPanelForm.length === 0 && panelFormData.panel_group &&
                                        <small style={{ color: '#666', display: 'block', marginTop: '3px' }}>No hay Multiwalls definidos para el grupo '{panelFormData.panel_group}'.</small>
                                     }
                                </div>
                                <div style={modalStyles.buttonGroup}>
                                    <button type="submit" style={{...modalStyles.button, backgroundColor: '#007bff'}} disabled={isLoading}>
                                        {isLoading ? 'Guardando...' : (editingPanel ? 'Actualizar Panel' : 'Guardar Panel')}
                                    </button>
                                    <button type="button" onClick={handleCancelPanel} style={{...modalStyles.button, ...modalStyles.buttonCancel}} disabled={isLoading}>Cancelar</button>
                                </div>
                            </form>
                        )}

                        {(isAddingMultiwall || editingMultiwall) && (
                            <form onSubmit={handleSubmitMultiwall} style={{...modalStyles.form, background: '#e9f7ff'}}>
                                <h4>{editingMultiwall ? 'Editar Multiwall' : 'Añadir Nuevo Multiwall'}</h4>
                                <div style={modalStyles.formGroup}>
                                    <label htmlFor="mw_panel_group" style={modalStyles.formLabel}>Grupo Panel:</label>
                                    <select id="mw_panel_group" name="panel_group" value={multiwallFormData.panel_group} onChange={handleMultiwallInputChange} required style={modalStyles.formSelect} disabled={isLoading}>
                                        {PANEL_GROUPS.map(group => (<option key={group} value={group}>{group}</option>))}
                                    </select>
                                </div>
                                <div style={modalStyles.formGroup}>
                                    <label htmlFor="multiwall_code" style={modalStyles.formLabel}>Código Multiwall:</label>
                                    <input type="text" id="multiwall_code" name="multiwall_code" value={multiwallFormData.multiwall_code} onChange={handleMultiwallInputChange} required style={modalStyles.formInput} disabled={isLoading}/>
                                </div>
                                <div style={modalStyles.buttonGroup}>
                                    <button type="submit" style={{...modalStyles.button, backgroundColor: '#17a2b8'}} disabled={isLoading}>
                                        {isLoading ? 'Guardando...' : (editingMultiwall ? 'Actualizar Multiwall' : 'Guardar Multiwall')}
                                    </button>
                                    <button type="button" onClick={handleCancelMultiwall} style={{...modalStyles.button, ...modalStyles.buttonCancel}} disabled={isLoading}>Cancelar</button>
                                </div>
                            </form>
                        )}

                        {!isAddingPanel && !editingPanel && !isAddingMultiwall && !editingMultiwall && (
                            <div style={{ marginTop: '20px', display: 'flex', gap: '10px' }}>
                                <button onClick={handleAddPanelClick} style={{...modalStyles.button, ...modalStyles.buttonAdd}} disabled={isLoading}>
                                    + Añadir Definición de Panel
                                </button>
                                 <button onClick={handleAddMultiwallClick} style={{...modalStyles.button, backgroundColor: '#17a2b8'}} disabled={isLoading}>
                                    + Añadir Multiwall
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

export default HouseTypePanelsModal;
