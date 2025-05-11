import React, { useState, useEffect, useMemo } from 'react';
import { getStations } from '../../services/adminService'; // Assuming getStations is in adminService

const localStorageKey = 'currentStationSequenceOrder';

function StationContextSelector() {
    const [stations, setStations] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [selectedSequence, setSelectedSequence] = useState('');
    const [savedSequence, setSavedSequence] = useState('');

    useEffect(() => {
        const currentStoredSequence = localStorage.getItem(localStorageKey);
        if (currentStoredSequence) {
            setSelectedSequence(currentStoredSequence);
            setSavedSequence(currentStoredSequence);
        }

        setIsLoading(true);
        getStations()
            .then(data => {
                setStations(data);
                setIsLoading(false);
            })
            .catch(err => {
                setError(`Error fetching stations: ${err.message}`);
                setIsLoading(false);
                console.error(err);
            });
    }, []);

    const stationSequenceOptions = useMemo(() => {
        if (!stations || stations.length === 0) return [];

        const sequenceMap = new Map();
        stations.forEach(station => {
            if (!sequenceMap.has(station.sequence_order)) {
                // Use a descriptive name, e.g., the name of the first station encountered for that sequence
                // Or a generic name if preferred.
                // Example: "Línea de Ensamblaje A: Estación 1" for sequence_order 7 (A1)
                // We'll use the station name and its sequence order.
                let displayName = station.name;
                // For parallel assembly lines, the names might be too specific (A, B, C)
                // Let's try to generalize for assembly lines if sequence_order >= 7 (A/B/C lines start at 7)
                if (station.sequence_order >= 7) {
                    // Try to find a more generic part of the name
                    // e.g. "Línea de Ensamblaje A: Estación 1" -> "Estación de Ensamblaje 1"
                    const assemblyMatch = station.name.match(/Línea de Ensamblaje [A-C]: (Estación \d+)/);
                    if (assemblyMatch && assemblyMatch[1]) {
                        displayName = assemblyMatch[1]; // "Estación 1"
                    } else {
                        // Fallback if name format is different
                        displayName = `Estación de Secuencia ${station.sequence_order}`;
                    }
                }

                sequenceMap.set(station.sequence_order, {
                    value: station.sequence_order,
                    label: `${displayName} (Secuencia ${station.sequence_order})`,
                    originalName: station.name // Keep for reference if needed
                });
            }
        });
        // Sort by sequence_order
        return Array.from(sequenceMap.values()).sort((a, b) => a.value - b.value);
    }, [stations]);

    const handleSave = () => {
        if (selectedSequence) {
            localStorage.setItem(localStorageKey, selectedSequence);
            setSavedSequence(selectedSequence);
            alert(`Configuración de estación guardada: Secuencia ${selectedSequence}`);
        } else {
            alert("Por favor, seleccione una secuencia de estación.");
        }
    };

    const currentStationName = useMemo(() => {
        if (!savedSequence || stationSequenceOptions.length === 0) return "No configurada";
        const foundOption = stationSequenceOptions.find(opt => opt.value.toString() === savedSequence);
        return foundOption ? foundOption.label : `Secuencia ${savedSequence} (Nombre no encontrado)`;
    }, [savedSequence, stationSequenceOptions]);


    if (isLoading) return <p>Cargando estaciones...</p>;
    if (error) return <p style={{ color: 'red' }}>{error}</p>;

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
