import React, { useState, useEffect, useCallback, useMemo } from 'react';
import * as adminService from '../../services/adminService';

// Basic Modal Styling
const modalStyles = {
    overlay: {
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    },
    content: {
        background: 'white', padding: '30px', borderRadius: '8px',
        maxWidth: '90%', width: '800px', // Adjust width as needed
        maxHeight: '90vh', overflowY: 'auto', position: 'relative',
        boxShadow: '0 4px 15px rgba(0,0,0,0.2)',
    },
    closeButton: {
        position: 'absolute', top: '15px', right: '15px',
        background: 'transparent', border: 'none', fontSize: '1.5rem', cursor: 'pointer',
        color: '#666',
    },
    header: { marginTop: 0, marginBottom: '20px', borderBottom: '1px solid #eee', paddingBottom: '10px' },
    moduleSelector: { marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' },
    label: { fontWeight: 'bold' },
    select: { padding: '8px', border: '1px solid #ccc', borderRadius: '4px' },
    panelSection: { marginBottom: '20px' },
    panelGroupHeader: { marginTop: '15px', marginBottom: '10px', fontWeight: 'bold', fontSize: '1.1em', borderBottom: '1px solid #eee', paddingBottom: '5px' },
    panelList: { listStyle: 'none', padding: 0 },
    panelItem: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #f0f0f0' },
    panelDetails: { flexGrow: 1, marginRight: '10px' },
    panelCode: { fontWeight: 'bold' },
    panelTypology: { fontSize: '0.9em', color: '#555', marginLeft: '10px' },
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
};

const PANEL_GROUPS = ['Paneles de Piso', 'Paneles de Cielo', 'Paneles Perimetrales', 'Tabiques Interiores', 'Vigas Cajón', 'Otros'];

const initialPanelFormState = {
    panel_group: PANEL_GROUPS[0], // Default to the first group
    panel_code: '',
    typology: '',
};

function HouseTypePanelsModal({ houseType, onClose }) {
    const { house_type_id, name: houseTypeName, number_of_modules } = houseType;
    const [selectedModule, setSelectedModule] = useState(1); // Start with module 1
    const [panels, setPanels] = useState([]);
    const [multiwalls, setMultiwalls] = useState([]); // State for multiwalls
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    // Panel form state
    const [isAddingPanel, setIsAddingPanel] = useState(false);
    const [editingPanel, setEditingPanel] = useState(null); // null or panel object
    const [panelFormData, setPanelFormData] = useState(initialPanelFormState);

    // Multiwall form state
    const [isAddingMultiwall, setIsAddingMultiwall] = useState(false);
    const [editingMultiwall, setEditingMultiwall] = useState(null); // null or multiwall object
    const [multiwallFormData, setMultiwallFormData] = useState({ panel_group: PANEL_GROUPS[0], multiwall_code: '' });

    const moduleOptions = useMemo(() =>
        Array.from({ length: number_of_modules }, (_, i) => i + 1),
        [number_of_modules]
    );

    // Combined fetch function
    const fetchDataForModule = useCallback(async (moduleId) => {
        if (!house_type_id || !moduleId) return;
        setIsLoading(true);
        setError('');
        try {
            // Fetch panels and multiwalls concurrently
            const [panelsData, multiwallsData] = await Promise.all([
                adminService.getHouseTypePanels(house_type_id, moduleId),
                adminService.getMultiwalls(house_type_id, moduleId)
            ]);
            setPanels(panelsData || []);
            setMultiwalls(multiwallsData || []);
        } catch (err) {
            setError(`Error al cargar datos del módulo: ${err.message}`);
            setPanels([]);
            setMultiwalls([]);
        } finally {
            setIsLoading(false);
        }
    }, [house_type_id]);

    useEffect(() => {
        fetchDataForModule(selectedModule);
    }, [selectedModule, fetchDataForModule]);

    const handleModuleChange = (e) => {
        const newModuleId = parseInt(e.target.value, 10);
        setSelectedModule(newModuleId);
        // Close all forms when changing module
        handleCancelPanel();
        handleCancelMultiwall();
        setError('');
        // Data fetching is handled by useEffect dependency on selectedModule
    };

    // --- Panel Form Handlers ---
    const handlePanelInputChange = (e) => {
        const { name, value } = e.target;
        setPanelFormData(prev => ({ ...prev, [name]: value }));
         // If panel_group changes, reset multiwall_id as available multiwalls change
         if (name === 'panel_group') {
            setPanelFormData(prev => ({ ...prev, multiwall_id: '' }));
        }
    };

    const handleAddPanelClick = () => {
        handleCancelMultiwall(); // Close multiwall form
        setEditingPanel(null);
        setPanelFormData(initialPanelFormState);
        setIsAddingPanel(true);
        setError('');
    };

    const handleEditPanelClick = (panel) => {
        handleCancelMultiwall(); // Close multiwall form
        setIsAddingPanel(false);
        setEditingPanel(panel);
        setPanelFormData({
            panel_group: panel.panel_group,
            panel_code: panel.panel_code,
            typology: panel.typology || '',
            multiwall_id: panel.multiwall_id?.toString() || '', // Handle null/undefined multiwall_id
        });
        setError('');
    };

    const handleCancelPanel = () => {
        setIsAddingPanel(false);
        setEditingPanel(null);
        setError('');
    };

    // --- Multiwall Form Handlers ---
     const handleMultiwallInputChange = (e) => {
        const { name, value } = e.target;
        setMultiwallFormData(prev => ({ ...prev, [name]: value }));
    };

     const handleAddMultiwallClick = () => {
        handleCancelPanel(); // Close panel form
        setEditingMultiwall(null);
        setMultiwallFormData({ panel_group: PANEL_GROUPS[0], multiwall_code: '' }); // Reset form
        setIsAddingMultiwall(true);
        setError('');
    };

     const handleEditMultiwallClick = (multiwall) => {
        handleCancelPanel(); // Close panel form
        setIsAddingMultiwall(false);
        setEditingMultiwall(multiwall);
        setMultiwallFormData({
            panel_group: multiwall.panel_group,
            multiwall_code: multiwall.multiwall_code,
        });
        setError('');
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
            typology: panelFormData.typology.trim() || null,
            multiwall_id: panelFormData.multiwall_id ? parseInt(panelFormData.multiwall_id, 10) : null, // Send integer or null
        };

        // Client-side validation: Ensure selected multiwall belongs to the same panel_group
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
                // Update existing panel
                await adminService.updateHouseTypePanel(editingPanel.house_type_panel_id, payload);
            } else {
                // Add new panel
                await adminService.addHouseTypePanel(house_type_id, selectedModule, payload);
            }
            await fetchDataForModule(selectedModule); // Refresh list (panels and multiwalls)
            handleCancelPanel(); // Close form
        } catch (err) {
            setError(`Error al guardar panel: ${err.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDeletePanel = async (panelId) => {
        if (window.confirm('¿Está seguro de que desea eliminar este panel?')) {
            setError('');
            setIsLoading(true);
            try {
                await adminService.deleteHouseTypePanel(panelId);
                await fetchDataForModule(selectedModule); // Refresh list
                handleCancelPanel(); // Close form if the deleted item was being edited
            } catch (err) {
                setError(`Error al eliminar panel: ${err.message}`);
            } finally {
                setIsLoading(false);
            }
        }
    };

     // --- Multiwall Submit/Delete ---
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
                await adminService.addMultiwall(house_type_id, selectedModule, payload);
            }
            await fetchDataForModule(selectedModule); // Refresh list
            handleCancelMultiwall(); // Close form
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
                await fetchDataForModule(selectedModule); // Refresh list
                handleCancelMultiwall(); // Close form if the deleted item was being edited
            } catch (err) {
                setError(`Error al eliminar Multiwall: ${err.message}`);
            } finally {
                setIsLoading(false);
            }
        }
    };

    // Group panels and multiwalls by panel_group for display
    const groupedData = useMemo(() => {
        const groups = {};

        // Initialize groups
        PANEL_GROUPS.forEach(group => {
            groups[group] = { multiwalls: [], panels: [] };
        });

        // Populate multiwalls
        multiwalls.forEach(mw => {
            if (groups[mw.panel_group]) {
                groups[mw.panel_group].multiwalls.push({ ...mw, panels: [] }); // Add panels array to each multiwall
            }
        });

        // Populate panels, assigning them to multiwalls or the main group list
        panels.forEach(panel => {
            if (groups[panel.panel_group]) {
                if (panel.multiwall_id) {
                    const parentMultiwall = groups[panel.panel_group].multiwalls.find(mw => mw.multiwall_id === panel.multiwall_id);
                    if (parentMultiwall) {
                        parentMultiwall.panels.push(panel);
                    } else {
                        // Panel assigned to a non-existent/filtered multiwall? Add to main list.
                        groups[panel.panel_group].panels.push(panel);
                    }
                } else {
                    // Panel not assigned to any multiwall
                    groups[panel.panel_group].panels.push(panel);
                }
            }
        });

         // Sort multiwalls within each group
         Object.values(groups).forEach(groupData => {
            groupData.multiwalls.sort((a, b) => a.multiwall_code.localeCompare(b.multiwall_code));
            // Sort panels within each multiwall
            groupData.multiwalls.forEach(mw => {
                mw.panels.sort((a, b) => a.panel_code.localeCompare(b.panel_code));
            });
            // Sort ungrouped panels
            groupData.panels.sort((a, b) => a.panel_code.localeCompare(b.panel_code));
        });


        return groups;
    }, [panels, multiwalls]);

    // Filter available multiwalls for the panel form based on selected panel_group
    const availableMultiwallsForPanelForm = useMemo(() => {
        return multiwalls.filter(mw => mw.panel_group === panelFormData.panel_group);
    }, [multiwalls, panelFormData.panel_group]);

    return (
        <div style={modalStyles.overlay} onClick={onClose}>
            <div style={modalStyles.content} onClick={(e) => e.stopPropagation()}> {/* Prevent closing when clicking inside */}
                <button onClick={onClose} style={modalStyles.closeButton} aria-label="Cerrar">&times;</button>
                <h2 style={modalStyles.header}>Gestionar Paneles para: {houseTypeName}</h2>

                <div style={modalStyles.moduleSelector}>
                    <label htmlFor="moduleSelect" style={modalStyles.label}>Seleccionar Módulo:</label>
                    <select
                        id="moduleSelect"
                        value={selectedModule}
                        onChange={handleModuleChange}
                        style={modalStyles.select}
                        disabled={isLoading}
                    >
                        {moduleOptions.map(modNum => (
                            <option key={modNum} value={modNum}>Módulo {modNum}</option>
                        ))}
                    </select>
                </div>

                {error && <p style={modalStyles.error}>{error}</p>}

                {isLoading ? (
                    <p style={modalStyles.loading}>Cargando datos...</p>
                ) : (
                    <div>
                        {/* Display Logic */}
                        {PANEL_GROUPS.map(group => (
                            <div key={group} style={modalStyles.panelSection}>
                                <h3 style={modalStyles.panelGroupHeader}>{group}</h3>
                                {groupedData[group] && (groupedData[group].multiwalls.length > 0 || groupedData[group].panels.length > 0) ? (
                                    <>
                                        {/* Render Multiwalls */}
                                        {groupedData[group].multiwalls.map(mw => (
                                            <div key={`mw-${mw.multiwall_id}`} style={{ marginLeft: '10px', marginBottom: '15px', borderLeft: '3px solid #007bff', paddingLeft: '10px' }}>
                                                <div style={{...modalStyles.panelItem, borderBottom: '1px solid #ccc', marginBottom: '5px'}}>
                                                    <strong style={{ flexGrow: 1 }}>Multiwall: {mw.multiwall_code}</strong>
                                                    <div style={modalStyles.buttonGroup}>
                                                        <button onClick={() => handleEditMultiwallClick(mw)} style={{...modalStyles.button, ...modalStyles.buttonEdit, padding: '3px 8px'}} disabled={isLoading}>Editar MW</button>
                                                        <button onClick={() => handleDeleteMultiwall(mw.multiwall_id)} style={{...modalStyles.button, ...modalStyles.buttonDelete, padding: '3px 8px'}} disabled={isLoading}>Eliminar MW</button>
                                                    </div>
                                                </div>
                                                {/* Render Panels within this Multiwall */}
                                                {mw.panels.length > 0 ? (
                                                    <ul style={{...modalStyles.panelList, marginLeft: '15px'}}>
                                                        {mw.panels.map(panel => (
                                                            <li key={panel.house_type_panel_id} style={{...modalStyles.panelItem, padding: '5px 0'}}>
                                                                <div style={modalStyles.panelDetails}>
                                                                    <span style={modalStyles.panelCode}>{panel.panel_code}</span>
                                                                    {panel.typology && <span style={modalStyles.panelTypology}>(Tipología: {panel.typology})</span>}
                                                                </div>
                                                                <div style={modalStyles.buttonGroup}>
                                                                    <button onClick={() => handleEditPanelClick(panel)} style={{...modalStyles.button, ...modalStyles.buttonEdit}} disabled={isLoading}>Editar</button>
                                                                    <button onClick={() => handleDeletePanel(panel.house_type_panel_id)} style={{...modalStyles.button, ...modalStyles.buttonDelete}} disabled={isLoading}>Eliminar</button>
                                                                </div>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                ) : (
                                                     <p style={{ fontSize: '0.85em', color: '#666', marginLeft: '15px', fontStyle: 'italic' }}>No hay paneles en este Multiwall.</p>
                                                )}
                                            </div>
                                        ))}

                                        {/* Render Panels NOT in a Multiwall */}
                                        {groupedData[group].panels.length > 0 && (
                                            <ul style={modalStyles.panelList}>
                                                {groupedData[group].panels.map(panel => (
                                                    <li key={panel.house_type_panel_id} style={modalStyles.panelItem}>
                                                        <div style={modalStyles.panelDetails}>
                                                            <span style={modalStyles.panelCode}>{panel.panel_code}</span>
                                                            {panel.typology && <span style={modalStyles.panelTypology}>(Tipología: {panel.typology})</span>}
                                                            <span style={modalStyles.panelTypology}>(No agrupado)</span>
                                                        </div>
                                                        <div style={modalStyles.buttonGroup}>
                                                            <button onClick={() => handleEditPanelClick(panel)} style={{...modalStyles.button, ...modalStyles.buttonEdit}} disabled={isLoading}>Editar</button>
                                                            <button onClick={() => handleDeletePanel(panel.house_type_panel_id)} style={{...modalStyles.button, ...modalStyles.buttonDelete}} disabled={isLoading}>Eliminar</button>
                                                        </div>
                                                    </li>
                                                ))}
                                            </ul>
                                        )}
                                    </>
                                ) : (
                                    <p style={{ fontSize: '0.9em', color: '#666' }}>No hay Multiwalls ni paneles definidos en este grupo.</p>
                                )}
                            </div>
                        ))}

                        {/* Add/Edit Panel Form */}
                        {(isAddingPanel || editingPanel) && (
                            <form onSubmit={handleSubmitPanel} style={modalStyles.form}>
                                <h4>{editingPanel ? 'Editar Panel' : 'Añadir Nuevo Panel'}</h4>
                                <div style={modalStyles.formGroup}>
                                    <label htmlFor="panel_group" style={modalStyles.formLabel}>Grupo Panel:</label>
                                    <select
                                        id="panel_group"
                                        name="panel_group"
                                        value={panelFormData.panel_group}
                                        onChange={handlePanelInputChange} // Use specific handler
                                        required
                                        style={modalStyles.formSelect}
                                        disabled={isLoading}
                                    >
                                        {PANEL_GROUPS.map(group => (
                                            <option key={group} value={group}>{group}</option>
                                        ))}
                                    </select>
                                </div>
                                <div style={modalStyles.formGroup}>
                                    <label htmlFor="panel_code" style={modalStyles.formLabel}>Código Panel:</label>
                                    <input
                                        type="text"
                                        id="panel_code"
                                        name="panel_code"
                                        value={panelFormData.panel_code}
                                        onChange={handlePanelInputChange} // Use specific handler
                                        required
                                        style={modalStyles.formInput}
                                        disabled={isLoading}
                                    />
                                </div>
                                <div style={modalStyles.formGroup}>
                                    <label htmlFor="typology" style={modalStyles.formLabel}>Tipología (Opcional):</label>
                                    <input
                                        type="text"
                                        id="typology"
                                        name="typology"
                                        placeholder="Dejar en blanco si aplica a todas"
                                        value={panelFormData.typology}
                                        onChange={handlePanelInputChange} // Use specific handler
                                        style={modalStyles.formInput}
                                        disabled={isLoading}
                                    />
                                </div>
                                 {/* Multiwall Assignment Dropdown */}
                                <div style={modalStyles.formGroup}>
                                    <label htmlFor="multiwall_id" style={modalStyles.formLabel}>Asignar a Multiwall (Opcional):</label>
                                    <select
                                        id="multiwall_id"
                                        name="multiwall_id"
                                        value={panelFormData.multiwall_id}
                                        onChange={handlePanelInputChange} // Use specific handler
                                        style={modalStyles.formSelect}
                                        disabled={isLoading || availableMultiwallsForPanelForm.length === 0}
                                    >
                                        <option value="">-- No Agrupado --</option>
                                        {availableMultiwallsForPanelForm.map(mw => (
                                            <option key={mw.multiwall_id} value={mw.multiwall_id}>
                                                {mw.multiwall_code} ({mw.panel_group})
                                            </option>
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
                                    <button type="button" onClick={handleCancelPanel} style={{...modalStyles.button, ...modalStyles.buttonCancel}} disabled={isLoading}>
                                        Cancelar
                                    </button>
                                </div>
                            </form>
                        )}

                         {/* Add/Edit Multiwall Form */}
                        {(isAddingMultiwall || editingMultiwall) && (
                            <form onSubmit={handleSubmitMultiwall} style={{...modalStyles.form, background: '#e9f7ff'}}>
                                <h4>{editingMultiwall ? 'Editar Multiwall' : 'Añadir Nuevo Multiwall'}</h4>
                                <div style={modalStyles.formGroup}>
                                    <label htmlFor="mw_panel_group" style={modalStyles.formLabel}>Grupo Panel:</label>
                                    <select
                                        id="mw_panel_group"
                                        name="panel_group"
                                        value={multiwallFormData.panel_group}
                                        onChange={handleMultiwallInputChange}
                                        required
                                        style={modalStyles.formSelect}
                                        disabled={isLoading}
                                    >
                                        {PANEL_GROUPS.map(group => (
                                            <option key={group} value={group}>{group}</option>
                                        ))}
                                    </select>
                                </div>
                                <div style={modalStyles.formGroup}>
                                    <label htmlFor="multiwall_code" style={modalStyles.formLabel}>Código Multiwall:</label>
                                    <input
                                        type="text"
                                        id="multiwall_code"
                                        name="multiwall_code"
                                        value={multiwallFormData.multiwall_code}
                                        onChange={handleMultiwallInputChange}
                                        required
                                        style={modalStyles.formInput}
                                        disabled={isLoading}
                                    />
                                </div>
                                <div style={modalStyles.buttonGroup}>
                                    <button type="submit" style={{...modalStyles.button, backgroundColor: '#17a2b8'}} disabled={isLoading}>
                                        {isLoading ? 'Guardando...' : (editingMultiwall ? 'Actualizar Multiwall' : 'Guardar Multiwall')}
                                    </button>
                                    <button type="button" onClick={handleCancelMultiwall} style={{...modalStyles.button, ...modalStyles.buttonCancel}} disabled={isLoading}>
                                        Cancelar
                                    </button>
                                </div>
                            </form>
                        )}

                        {/* Buttons to open forms */}
                        {!isAddingPanel && !editingPanel && !isAddingMultiwall && !editingMultiwall && (
                            <div style={{ marginTop: '20px', display: 'flex', gap: '10px' }}>
                                <button onClick={handleAddPanelClick} style={{...modalStyles.button, ...modalStyles.buttonAdd}} disabled={isLoading}>
                                    + Añadir Panel
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
