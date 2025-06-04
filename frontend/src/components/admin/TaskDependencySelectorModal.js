import React, { useState, useEffect } from 'react';

const modalStyles = {
    modalBackdrop: {
        position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
        backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex',
        justifyContent: 'center', alignItems: 'center', zIndex: 1000
    },
    modalContent: {
        backgroundColor: 'white', padding: '20px', borderRadius: '8px',
        width: '80%', maxWidth: '600px', maxHeight: '80vh', overflowY: 'auto',
        boxShadow: '0 4px 8px rgba(0,0,0,0.1)'
    },
    header: { marginTop: 0, borderBottom: '1px solid #eee', paddingBottom: '10px' },
    list: { listStyleType: 'none', padding: 0 },
    listItem: { padding: '8px 0', borderBottom: '1px solid #f0f0f0' },
    checkboxLabel: { marginLeft: '10px', cursor: 'pointer' },
    buttonContainer: { marginTop: '20px', textAlign: 'right' },
    button: { marginLeft: '10px', cursor: 'pointer', padding: '8px 15px', border: 'none', borderRadius: '4px' },
    buttonPrimary: { backgroundColor: '#007bff', color: 'white' },
    buttonSecondary: { backgroundColor: '#6c757d', color: 'white' },
    error: { color: 'red', fontSize: '0.9em', marginTop: '5px'},
};

function TaskDependencySelectorModal({
    show,
    potentialDependencies, // Array of { task_definition_id, name, station_sequence_order, is_panel_task }
    currentDependencies, // Array of task_definition_id strings
    onSave, // Function to call with new array of selected dependency IDs (strings)
    onClose,
    stageLabelMap, // Map of sequence_order to label
}) {
    const [selectedDepsInModal, setSelectedDepsInModal] = useState([]);

    useEffect(() => {
        if (show) {
            // Initialize modal's selection with current dependencies when it opens
            setSelectedDepsInModal(Array.isArray(currentDependencies) ? [...currentDependencies] : []);
        }
    }, [show, currentDependencies]);

    if (!show) {
        return null;
    }

    const handleCheckboxChange = (depId) => {
        const idStr = depId.toString();
        setSelectedDepsInModal(prev =>
            prev.includes(idStr) ? prev.filter(id => id !== idStr) : [...prev, idStr]
        );
    };

    const handleModalSave = () => {
        onSave(selectedDepsInModal);
        onClose();
    };

    return (
        <div style={modalStyles.modalBackdrop} onClick={onClose}>
            <div style={modalStyles.modalContent} onClick={e => e.stopPropagation()}>
                <h3 style={modalStyles.header}>Seleccionar Dependencias (Pre-requisitos)</h3>
                {potentialDependencies && potentialDependencies.length > 0 ? (
                    <ul style={modalStyles.list}>
                        {potentialDependencies.map(dep => (
                            <li key={dep.task_definition_id} style={modalStyles.listItem}>
                                <input
                                    type="checkbox"
                                    id={`dep-${dep.task_definition_id}`}
                                    value={dep.task_definition_id.toString()}
                                    checked={selectedDepsInModal.includes(dep.task_definition_id.toString())}
                                    onChange={() => handleCheckboxChange(dep.task_definition_id)}
                                />
                                <label htmlFor={`dep-${dep.task_definition_id}`} style={modalStyles.checkboxLabel}>
                                    {dep.name}
                                    <span style={{fontSize: '0.8em', color: '#555', marginLeft: '10px'}}>
                                        (Etapa: {stageLabelMap.get(dep.station_sequence_order) || dep.station_sequence_order || 'N/A'}, Tipo: {dep.is_panel_task ? "Panel" : "Módulo"})
                                    </span>
                                </label>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p>No hay dependencias potenciales disponibles para la configuración actual de la tarea.</p>
                )}
                <div style={modalStyles.buttonContainer}>
                    <button onClick={onClose} style={{...modalStyles.button, ...modalStyles.buttonSecondary}}>Cancelar</button>
                    <button onClick={handleModalSave} style={{...modalStyles.button, ...modalStyles.buttonPrimary}}>Guardar Selección</button>
                </div>
            </div>
        </div>
    );
}

export default TaskDependencySelectorModal;
