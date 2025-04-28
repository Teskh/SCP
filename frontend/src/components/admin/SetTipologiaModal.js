import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import styles from './AdminComponentStyles'; // Assuming shared styles

// Renamed from HouseTypeDefinitionModal
function SetTipologiaModal({
    houseTypeName, // Pass house type name for display
    planIds,
    availableTipologias, // Array of { tipologia_id, name }
    currentTipologiaId, // Optional: Pre-select if all selected items have the same tipologia
    onSave, // Function to call when saving: onSave(planIds, selectedTipologiaId)
    onClose,
    isLoading: isParentLoading, // Loading state from parent (e.g., fetching tipologias)
}) {
    const [selectedTipologiaId, setSelectedTipologiaId] = useState(currentTipologiaId === undefined ? '' : (currentTipologiaId === null ? 'none' : currentTipologiaId.toString()));
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState('');

    // Update selection if currentTipologiaId changes after initial load
    useEffect(() => {
        setSelectedTipologiaId(currentTipologiaId === undefined ? '' : (currentTipologiaId === null ? 'none' : currentTipologiaId.toString()));
    }, [currentTipologiaId]);

    const handleSave = async () => {
        setIsSaving(true);
        setError('');
        try {
            // Convert 'none' back to null, otherwise parse the integer ID
            const tipologiaIdToSave = selectedTipologiaId === 'none' ? null : parseInt(selectedTipologiaId, 10);
            await onSave(planIds, tipologiaIdToSave);
            onClose(); // Close modal on successful save
        } catch (err) {
            setError(`Error setting tipologia: ${err.message}`);
            console.error(err);
        } finally {
            setIsSaving(false);
        }
    };

    const modalStyle = {
        position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
        backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex',
        justifyContent: 'center', alignItems: 'center', zIndex: 1050 // Ensure modal is on top
    };

    const contentStyle = {
        backgroundColor: 'white', padding: '30px', borderRadius: '5px',
        minWidth: '400px', maxWidth: '600px', boxShadow: '0 5px 15px rgba(0,0,0,0.2)'
    };

    const headerStyle = { ...styles.header, marginTop: 0, marginBottom: '20px', borderBottom: '1px solid #eee', paddingBottom: '10px' };
    const selectStyle = { ...styles.input, width: '100%', marginBottom: '20px' };
    const buttonContainerStyle = { display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' };

    return (
        <div style={modalStyle} onClick={onClose}> {/* Close on backdrop click */}
            <div style={contentStyle} onClick={e => e.stopPropagation()}> {/* Prevent content click from closing */}
                <h2 style={headerStyle}>Establecer Tipología para {houseTypeName}</h2>

                {isParentLoading ? (
                    <p>Cargando tipologías...</p>
                ) : (
                    <>
                        <p>Seleccione la tipología para los {planIds.length} elemento(s) del plan seleccionado(s):</p>
                        {/* <p style={{ fontSize: '0.8em', color: '#666' }}>Plan IDs: {planIds.join(', ')}</p> */}

                        <label htmlFor="tipologiaSelect" style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Tipología:</label>
                        <select
                            id="tipologiaSelect"
                            style={selectStyle}
                            value={selectedTipologiaId}
                            onChange={(e) => setSelectedTipologiaId(e.target.value)}
                            disabled={isSaving}
                        >
                            <option value="" disabled>-- Seleccione una Tipología --</option>
                            <option value="none">[Ninguna]</option> {/* Option for NULL */}
                            {availableTipologias && availableTipologias.length > 0 ? (
                                availableTipologias.map(tipo => (
                                    <option key={tipo.tipologia_id} value={tipo.tipologia_id.toString()}>
                                        {tipo.name}
                                    </option>
                                ))
                            ) : (
                                <option value="" disabled>No hay tipologías definidas para este tipo de casa</option>
                            )}
                        </select>

                        {error && <p style={styles.error}>{error}</p>}

                        <div style={buttonContainerStyle}>
                            <button style={styles.buttonSecondary} onClick={onClose} disabled={isSaving}>
                                Cancelar
                            </button>
                            <button
                                style={styles.buttonPrimary}
                                onClick={handleSave}
                                disabled={isSaving || selectedTipologiaId === '' || isParentLoading || !availableTipologias}
                            >
                                {isSaving ? 'Guardando...' : 'Guardar'}
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

SetTipologiaModal.propTypes = {
    houseTypeName: PropTypes.string.isRequired,
    planIds: PropTypes.arrayOf(PropTypes.number).isRequired,
    availableTipologias: PropTypes.arrayOf(PropTypes.shape({
        tipologia_id: PropTypes.number.isRequired,
        name: PropTypes.string.isRequired,
    })), // Can be null while loading
    currentTipologiaId: PropTypes.number, // Can be null or undefined
    onSave: PropTypes.func.isRequired,
    onClose: PropTypes.func.isRequired,
    isLoading: PropTypes.bool,
};

export default SetTipologiaModal;
