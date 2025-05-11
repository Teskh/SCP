import React, { useState, useEffect, useMemo } from 'react';
// import { getStations } from '../../services/adminService'; // Now receives stations as prop

const localStorageKey = 'currentStationSequenceOrder';
const SELECTED_SPECIFIC_STATION_ID_KEY = 'selectedSpecificStationId'; // New key
const PANEL_LINE_GENERAL_VALUE = 'PANEL_LINE_GENERAL';
const PANEL_LINE_GENERAL_LABEL = 'Línea de Paneles (General)';

function StationContextSelector({ allStations, isLoadingAllStations }) { // Receive stations as props
    // const [stations, setStations] = useState([]); // No longer fetches its own
    // const [isLoading, setIsLoading] = useState(false); // Use isLoadingAllStations
    const [error, setError] = useState(''); // Keep for local errors like save failure, though not implemented
    const [selectedSequence, setSelectedSequence] = useState('');
    const [savedSequence, setSavedSequence] = useState('');

    useEffect(() => {
        const currentStoredSequence = localStorage.getItem(localStorageKey);
        if (currentStoredSequence) {
            setSelectedSequence(currentStoredSequence);
            setSavedSequence(currentStoredSequence);
        }
        // No longer fetches stations here, relies on props
    }, []);

    const stationSequenceOptions = useMemo(() => {
        const panelLineGeneralOption = {
            value: PANEL_LINE_GENERAL_VALUE,
            label: PANEL_LINE_GENERAL_LABEL
        };

        if (!allStations || allStations.length === 0) return [panelLineGeneralOption];

        const sequenceMap = new Map();
        allStations.forEach(station => {
            if (!sequenceMap.has(station.sequence_order)) {
                let displayName = station.name;
                if (station.sequence_order >= 7) { 
                    const assemblyMatch = station.name.match(/Línea de Ensamblaje [A-C]: (Estación \d+)/);
                    if (assemblyMatch && assemblyMatch[1]) {
                        displayName = assemblyMatch[1]; 
                    } else {
                        displayName = `Estación de Secuencia ${station.sequence_order}`;
                    }
                }
                // For panel line stations (1-5) and M1 (6), use their full names or a generic sequence name
                else if (station.sequence_order <=6) {
                     // Keep full name for W1-W5 and M1 as they are not "general" in the same way as assembly sequences
                     // Or, if we want to group W1-W5 under "Panel Line Sequence X", that logic would go here.
                     // For now, the existing logic is fine, this comment is for clarity.
                }


                sequenceMap.set(station.sequence_order, {
                    value: station.sequence_order.toString(), // Ensure value is string for consistency with PANEL_LINE_GENERAL_VALUE
                    label: `${displayName} (Secuencia ${station.sequence_order})`,
                    originalName: station.name 
                });
            }
        });
        const specificStationOptions = Array.from(sequenceMap.values()).sort((a, b) => parseInt(a.value, 10) - parseInt(b.value, 10));
        return [panelLineGeneralOption, ...specificStationOptions];
    }, [allStations]);

    const handleSave = () => {
        if (selectedSequence) {
            localStorage.setItem(localStorageKey, selectedSequence);
            // Always remove the specific station ID when the general context is changed.
            // StationPage will then prompt for a new specific one if the new context is ambiguous.
            localStorage.removeItem(SELECTED_SPECIFIC_STATION_ID_KEY);
            setSavedSequence(selectedSequence);
            alert(`Configuración de estación guardada: ${selectedSequence}. La estación específica se solicitará al operar si es necesario.`);
        } else {
            alert("Por favor, seleccione una secuencia de estación.");
        }
    };

    const currentStationName = useMemo(() => {
        if (!savedSequence) return "No configurada";
        // stationSequenceOptions depends on allStations, so if allStations is loading, options might be minimal
        if (isLoadingAllStations && (!allStations || allStations.length === 0)) return "Cargando opciones de estación...";
        
        const foundOption = stationSequenceOptions.find(opt => opt.value.toString() === savedSequence.toString());
        return foundOption ? foundOption.label : `Opción Guardada: ${savedSequence} (Nombre no encontrado en opciones actuales)`;
    }, [savedSequence, stationSequenceOptions, isLoadingAllStations, allStations]);


    if (isLoadingAllStations && (!allStations || allStations.length === 0)) return <p>Cargando lista de estaciones...</p>;
    // Error prop from App.js could be displayed here if it's related to fetching allStations
    // if (allStationsError) return <p style={{ color: 'red' }}>{allStationsError}</p>;
    if (error) return <p style={{ color: 'red' }}>{error}</p>; // For local errors

    return (
        <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
            <h2 style={{ borderBottom: '1px solid #ccc', paddingBottom: '10px' }}>Configurar Estación del Dispositivo</h2>
            
            <div style={{ marginBottom: '20px' }}>
                <h4>Estación Actual Configurada:</h4>
                <p><strong>{currentStationName}</strong></p>
            </div>

            <div style={{ marginBottom: '20px' }}>
                <label htmlFor="station-sequence-select" style={{ display: 'block', marginBottom: '5px' }}>
                    Seleccionar Nueva Secuencia de Estación:
                </label>
                <select
                    id="station-sequence-select"
                    value={selectedSequence}
                    onChange={(e) => setSelectedSequence(e.target.value)}
                    style={{ padding: '8px', marginRight: '10px', minWidth: '300px' }}
                >
                    <option value="">-- Seleccione una secuencia --</option>
                    {stationSequenceOptions.map(option => (
                        <option key={option.value} value={option.value}>
                            {option.label}
                        </option>
                    ))}
                </select>
                <button 
                    onClick={handleSave}
                    style={{ padding: '8px 15px', cursor: 'pointer' }}
                >
                    Guardar Configuración
                </button>
            </div>
            
            <p style={{ marginTop: '30px', fontSize: '0.9em', color: '#555' }}>
                Esta configuración se guarda localmente en este dispositivo y se utiliza para identificar
                la estación de trabajo actual para el registro de tareas.
            </p>
        </div>
    );
}

export default StationContextSelector;
