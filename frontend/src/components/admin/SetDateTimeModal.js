import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import styles from './AdminComponentStyles'; // Assuming shared styles

function SetDateTimeModal({
    planIds,
    currentItemDateTime, // ISO string format (YYYY-MM-DD HH:MM:SS) or null/undefined
    onSave, // Function to call when saving: onSave(planIds, newDateTimeString)
    onClose,
    isLoading: isParentLoading, // Loading state from parent (e.g., during save)
}) {
    const [datePart, setDatePart] = useState('');
    const [timePart, setTimePart] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState('');

    // Initialize date and time parts from currentItemDateTime
    useEffect(() => {
        if (currentItemDateTime) {
            try {
                const dateObj = new Date(currentItemDateTime);
                // Format date as YYYY-MM-DD for the input type="date"
                const year = dateObj.getFullYear();
                const month = (dateObj.getMonth() + 1).toString().padStart(2, '0');
                const day = dateObj.getDate().toString().padStart(2, '0');
                setDatePart(`${year}-${month}-${day}`);

                // Format time as HH:MM for the input type="time"
                const hours = dateObj.getHours().toString().padStart(2, '0');
                const minutes = dateObj.getMinutes().toString().padStart(2, '0');
                setTimePart(`${hours}:${minutes}`);
            } catch (e) {
                console.error("Error parsing currentItemDateTime:", currentItemDateTime, e);
                setError("Fecha/hora actual inválida.");
                setDatePart('');
                setTimePart('');
            }
        } else {
            // Default to empty or current time? Let's default to empty.
            setDatePart('');
            setTimePart('');
        }
    }, [currentItemDateTime]);

    const handleSave = async () => {
        if (!datePart || !timePart) {
            setError("Debe seleccionar una fecha y hora.");
            return;
        }

        setIsSaving(true);
        setError('');
        try {
            // Combine date and time into the required format (YYYY-MM-DD HH:MM:SS)
            // Assuming seconds are not critical for this input, set to 00
            const newDateTimeString = `${datePart} ${timePart}:00`;
            await onSave(planIds, newDateTimeString);
            onClose(); // Close modal on successful save
        } catch (err) {
            setError(`Error al establecer fecha/hora: ${err.message}`);
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
        minWidth: '400px', maxWidth: '500px', boxShadow: '0 5px 15px rgba(0,0,0,0.2)'
    };

    const headerStyle = { ...styles.header, marginTop: 0, marginBottom: '20px', borderBottom: '1px solid #eee', paddingBottom: '10px' };
    const inputGroupStyle = { display: 'flex', gap: '15px', marginBottom: '20px' };
    const inputStyle = { ...styles.input, flex: 1 }; // Use flex to distribute space
    const labelStyle = { display: 'block', marginBottom: '5px', fontWeight: 'bold' };
    const buttonContainerStyle = { display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' };

    const totalItems = planIds.length;

    return (
        <div style={modalStyle} onClick={onClose}> {/* Close on backdrop click */}
            <div style={contentStyle} onClick={e => e.stopPropagation()}> {/* Prevent content click from closing */}
                <h2 style={headerStyle}>Establecer Fecha/Hora de Inicio Planificada</h2>

                <p>Ajuste la fecha y hora para {totalItems > 1 ? `los ${totalItems} elementos seleccionados` : 'el elemento seleccionado'}:</p>
                {/* Optional: Display Plan IDs */}
                {/* <p style={{ fontSize: '0.8em', color: '#666' }}>Plan IDs: {planIds.join(', ')}</p> */}

                <div style={inputGroupStyle}>
                    <div>
                        <label htmlFor="dateInput" style={labelStyle}>Fecha:</label>
                        <input
                            type="date"
                            id="dateInput"
                            style={inputStyle}
                            value={datePart}
                            onChange={(e) => setDatePart(e.target.value)}
                            disabled={isSaving || isParentLoading}
                        />
                    </div>
                    <div>
                        <label htmlFor="timeInput" style={labelStyle}>Hora:</label>
                        <input
                            type="time"
                            id="timeInput"
                            style={inputStyle}
                            value={timePart}
                            onChange={(e) => setTimePart(e.target.value)}
                            disabled={isSaving || isParentLoading}
                        />
                    </div>
                </div>

                {error && <p style={styles.error}>{error}</p>}

                <div style={buttonContainerStyle}>
                    <button style={styles.buttonSecondary} onClick={onClose} disabled={isSaving || isParentLoading}>
                        Cancelar
                    </button>
                    <button
                        style={styles.buttonPrimary}
                        onClick={handleSave}
                        disabled={isSaving || isParentLoading || !datePart || !timePart}
                    >
                        {isSaving || isParentLoading ? 'Guardando...' : 'Guardar'}
                    </button>
                </div>
            </div>
        </div>
    );
}

SetDateTimeModal.propTypes = {
    planIds: PropTypes.arrayOf(PropTypes.number).isRequired,
    currentItemDateTime: PropTypes.string, // ISO string or null/undefined
    onSave: PropTypes.func.isRequired,
    onClose: PropTypes.func.isRequired,
    isLoading: PropTypes.bool,
};

export default SetDateTimeModal;
