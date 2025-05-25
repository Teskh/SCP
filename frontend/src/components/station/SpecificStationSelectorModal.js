import React, { useState, useEffect, useMemo } from 'react';

const PANEL_LINE_GENERAL_VALUE = 'PANEL_LINE_GENERAL'; // From StationContextSelector/StationPage
const SELECTED_SPECIFIC_STATION_ID_KEY = 'selectedSpecificStationId'; // Key for localStorage
const SELECTED_STATION_CONTEXT_KEY = 'selectedStationContext'; // New constant for the main context key

// Basic modal styling
const modalOverlayStyle = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
};

const modalContentStyle = {
    backgroundColor: '#fff',
    padding: '20px',
    borderRadius: '8px',
    minWidth: '300px',
    maxWidth: '90%',
    boxShadow: '0 4px 8px rgba(0,0,0,0.2)',
    textAlign: 'center',
};

const buttonContainerStyle = {
    display: 'flex',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: '15px',
    marginTop: '20px',
};

const stationButtonStyle = {
    padding: '20px',
    fontSize: '18px',
    minWidth: '150px',
    minHeight: '100px',
    border: '2px solid #ddd',
    borderRadius: '8px',
    backgroundColor: '#f8f8f8',
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    transition: 'all 0.2s ease',
};

const selectedButtonStyle = {
    ...stationButtonStyle,
    backgroundColor: '#e6f7ff',
    borderColor: '#1890ff',
    boxShadow: '0 0 8px rgba(24, 144, 255, 0.5)',
};

const stationIdStyle = {
    fontWeight: 'bold',
    fontSize: '24px',
    marginBottom: '5px',
};

const stationNameStyle = {
    fontSize: '14px',
    textAlign: 'center',
};

const saveButtonStyle = {
    marginTop: '30px',
    padding: '15px 30px',
    fontSize: '18px',
    backgroundColor: '#1890ff',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
};

const disabledSaveButtonStyle = {
    ...saveButtonStyle,
    backgroundColor: '#ccc',
    cursor: 'not-allowed',
};

function SpecificStationSelectorModal({
    show,
    onSave, // (specificStationId) => void
    selectedStationContext, // Renamed from ambiguousSequenceOrder
    allStations, // Array of all station objects { station_id, name, line_type, sequence_order }
    isLoadingOptions, // New prop
}) {
    const [selectedSpecificStation, setSelectedSpecificStation] = useState(''); // Local state for selection within the modal
    const [error, setError] = useState('');

    const specificOptions = useMemo(() => {
        if (!allStations || !allStations.length || !selectedStationContext) return [];

        if (selectedStationContext === PANEL_LINE_GENERAL_VALUE) {
            // Filter for 'W' type stations (Panel Line)
            return allStations.filter(s => s.line_type === 'W')
                              .sort((a, b) => a.sequence_order - b.sequence_order);
        } else {
            // Filter for stations matching the numeric sequence_order (Assembly Lines)
            const numericSequence = parseInt(selectedStationContext, 10);
            if (isNaN(numericSequence) || numericSequence < 7) return []; // Assembly lines start at seq 7
            return allStations.filter(s => s.sequence_order === numericSequence)
                              .sort((a,b) => a.station_id.localeCompare(b.station_id)); // Sort A, B, C
        }
    }, [allStations, selectedStationContext]);

    useEffect(() => {
        // When modal opens or context changes, try to pre-select if a specific ID is already stored
        const storedSpecificId = localStorage.getItem(SELECTED_SPECIFIC_STATION_ID_KEY);
        // Only pre-select if the stored ID is actually one of the valid options for the current ambiguous context
        if (storedSpecificId && specificOptions.some(opt => opt.station_id === storedSpecificId)) {
            setSelectedSpecificStation(storedSpecificId);
        } else {
            setSelectedSpecificStation(''); // Clear if no valid stored selection
        }
        setError('');
    }, [selectedStationContext, show, specificOptions]); // Added specificOptions to deps

    const handleStationSelect = (stationId) => {
        setSelectedSpecificStation(stationId); // Update local state for visual feedback
        setError(''); // Clear error on new selection
    };

    const handleSaveClick = () => {
        if (!selectedSpecificStation) {
            setError("Por favor, seleccione una estación específica.");
            return;
        }
        // Call the parent's onSave function to update state and close the modal
        onSave(selectedSpecificStation);
        // The parent (StationPage) will then handle storing this in localStorage and re-fetching data.
        setError('');
    };

    if (!show) {
        return null;
    }

    let title = "Seleccione la Estación Específica";
    let description = "";

    if (selectedStationContext === PANEL_LINE_GENERAL_VALUE) {
        description = `Ha configurado "Línea de Paneles (General)" para este dispositivo. Por favor, especifique a cuál estación de panel corresponde:`;
    } else {
        const numericSequence = parseInt(selectedStationContext, 10);
        if (!isNaN(numericSequence) && numericSequence >= 7) {
            description = `Ha configurado la secuencia de ensamblaje general "${numericSequence}" para este dispositivo. Por favor, especifique la línea y estación exacta (A, B, o C):`;
        }
    }

    return (
        <div style={modalOverlayStyle}>
            <div style={modalContentStyle}>
                <h2>{title}</h2>
                {description && <p>{description}</p>}

                {error && <p style={{ color: 'red', fontWeight: 'bold' }}>{error}</p>}

                {isLoadingOptions ? (
                    <p>Cargando opciones de estación...</p>
                ) : specificOptions.length > 0 ? (
                    <div style={buttonContainerStyle}>
                        {specificOptions.map(station => (
                            <div 
                                key={station.station_id} 
                                style={selectedSpecificStation === station.station_id ? selectedButtonStyle : stationButtonStyle}
                                onClick={() => handleStationSelect(station.station_id)}
                            >
                                <div style={stationIdStyle}>{station.station_id}</div>
                                <div style={stationNameStyle}>{station.name}</div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p>No hay opciones específicas disponibles para esta selección.</p>
                )}
                <button
                    onClick={handleSaveClick}
                    style={selectedSpecificStation ? saveButtonStyle : disabledSaveButtonStyle}
                    disabled={!selectedSpecificStation || isLoadingOptions}
                >
                    Guardar Selección
                </button>
            </div>
        </div>
    );
}

export default SpecificStationSelectorModal;
