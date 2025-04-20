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
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [isAdding, setIsAdding] = useState(false);
    const [editingPanel, setEditingPanel] = useState(null); // null or panel object
    const [panelFormData, setPanelFormData] = useState(initialPanelFormState);

    const moduleOptions = useMemo(() =>
        Array.from({ length: number_of_modules }, (_, i) => i + 1),
        [number_of_modules]
    );

    const fetchPanels = useCallback(async (moduleId) => {
        if (!house_type_id || !moduleId) return;
        setIsLoading(true);
        setError('');
        try {
            const data = await adminService.getHouseTypePanels(house_type_id, moduleId);
            setPanels(data || []);
        } catch (err) {
            setError(`Error al cargar paneles: ${err.message}`);
            setPanels([]); // Clear panels on error
        } finally {
            setIsLoading(false);
        }
    }, [house_type_id]);

    useEffect(() => {
        fetchPanels(selectedModule);
    }, [selectedModule, fetchPanels]);

    const handleModuleChange = (e) => {
        setSelectedModule(parseInt(e.target.value, 10));
        setIsAdding(false); // Close add form if switching modules
        setEditingPanel(null); // Close edit form
        setError('');
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setPanelFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleAddClick = () => {
        setEditingPanel(null); // Ensure edit form is closed
        setPanelFormData(initialPanelFormState); // Reset form
        setIsAdding(true);
        setError('');
    };

    const handleEditClick = (panel) => {
        setIsAdding(false); // Ensure add form is closed
        setEditingPanel(panel);
        setPanelFormData({
            panel_group: panel.panel_group,
            panel_code: panel.panel_code,
            typology: panel.typology || '', // Handle null typology
        });
        setError('');
    };

    const handleCancel = () => {
        setIsAdding(false);
        setEditingPanel(null);
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
            typology: panelFormData.typology.trim() || null, // Send null if empty
        };

        try {
            if (editingPanel) {
                // Update existing panel
                await adminService.updateHouseTypePanel(editingPanel.house_type_panel_id, payload);
            } else {
                // Add new panel
                await adminService.addHouseTypePanel(house_type_id, selectedModule, payload);
            }
            await fetchPanels(selectedModule); // Refresh list
            handleCancel(); // Close form
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
                await fetchPanels(selectedModule); // Refresh list
                handleCancel(); // Close form if the deleted item was being edited
            } catch (err) {
                setError(`Error al eliminar panel: ${err.message}`);
            } finally {
                setIsLoading(false);
            }
        }
    };

    // Group panels by panel_group for display
    const groupedPanels = useMemo(() => {
        return panels.reduce((acc, panel) => {
            const group = panel.panel_group;
            if (!acc[group]) {
                acc[group] = [];
            }
            acc[group].push(panel);
            return acc;
        }, {});
    }, [panels]);

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
                    <p style={modalStyles.loading}>Cargando paneles...</p>
                ) : (
                    <div>
                        {PANEL_GROUPS.map(group => (
                            <div key={group} style={modalStyles.panelSection}>
                                <h3 style={modalStyles.panelGroupHeader}>{group}</h3>
                                {groupedPanels[group] && groupedPanels[group].length > 0 ? (
                                    <ul style={modalStyles.panelList}>
                                        {groupedPanels[group].map(panel => (
                                            <li key={panel.house_type_panel_id} style={modalStyles.panelItem}>
                                                <div style={modalStyles.panelDetails}>
                                                    <span style={modalStyles.panelCode}>{panel.panel_code}</span>
                                                    {panel.typology && <span style={modalStyles.panelTypology}>(Tipología: {panel.typology})</span>}
                                                </div>
                                                <div style={modalStyles.buttonGroup}>
                                                    <button onClick={() => handleEditClick(panel)} style={{...modalStyles.button, ...modalStyles.buttonEdit}} disabled={isLoading}>Editar</button>
                                                    <button onClick={() => handleDeletePanel(panel.house_type_panel_id)} style={{...modalStyles.button, ...modalStyles.buttonDelete}} disabled={isLoading}>Eliminar</button>
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <p style={{ fontSize: '0.9em', color: '#666' }}>No hay paneles definidos en este grupo.</p>
                                )}
                            </div>
                        ))}

                        {/* Add/Edit Form */}
                        {(isAdding || editingPanel) && (
                            <form onSubmit={handleSubmitPanel} style={modalStyles.form}>
                                <h4>{editingPanel ? 'Editar Panel' : 'Añadir Nuevo Panel'}</h4>
                                <div style={modalStyles.formGroup}>
                                    <label htmlFor="panel_group" style={modalStyles.formLabel}>Grupo Panel:</label>
                                    <select
                                        id="panel_group"
                                        name="panel_group"
                                        value={panelFormData.panel_group}
                                        onChange={handleInputChange}
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
                                        onChange={handleInputChange}
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
                                        onChange={handleInputChange}
                                        style={modalStyles.formInput}
                                        disabled={isLoading}
                                    />
                                </div>
                                <div style={modalStyles.buttonGroup}>
                                    <button type="submit" style={{...modalStyles.button, backgroundColor: '#007bff'}} disabled={isLoading}>
                                        {isLoading ? 'Guardando...' : (editingPanel ? 'Actualizar Panel' : 'Guardar Panel')}
                                    </button>
                                    <button type="button" onClick={handleCancel} style={{...modalStyles.button, ...modalStyles.buttonCancel}} disabled={isLoading}>
                                        Cancelar
                                    </button>
                                </div>
                            </form>
                        )}

                        {!isAdding && !editingPanel && (
                            <button onClick={handleAddClick} style={{...modalStyles.button, ...modalStyles.buttonAdd}} disabled={isLoading}>
                                + Añadir Panel a Módulo {selectedModule}
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

export default HouseTypePanelsModal;
