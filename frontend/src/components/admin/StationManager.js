import React, { useState, useEffect } from 'react';
import { getStations } from '../../services/adminService';

const PANEL_LINE_GENERAL_VALUE = 'PANEL_LINE_GENERAL';
const PANEL_LINE_GENERAL_LABEL = 'Línea de Paneles (General)';

function StationManager() {
    const [allStations, setAllStations] = useState([]);
    const [isLoadingStations, setIsLoadingStations] = useState(true);
    const [stationsError, setStationsError] = useState('');
    const [selectedStationContext, setSelectedStationContext] = useState('');

    useEffect(() => {
        fetchStations();
        // Load current selection from localStorage
        const saved = localStorage.getItem('selectedStationContext');
        if (saved) {
            setSelectedStationContext(saved);
        }
    }, []);

    const fetchStations = async () => {
        setIsLoadingStations(true);
        setStationsError('');
        try {
            const stations = await getStations();
            setAllStations(stations);
        } catch (error) {
            console.error('Error fetching stations:', error);
            setStationsError(error.message || 'Error al cargar estaciones');
        } finally {
            setIsLoadingStations(false);
        }
    };

    const getStationOptions = () => {
        if (!allStations || allStations.length === 0) return [];

        const options = [];
        const sequenceMap = new Map();

        // 1. Add Panel Line General option
        options.push({
            value: PANEL_LINE_GENERAL_VALUE,
            label: PANEL_LINE_GENERAL_LABEL,
            description: 'Estaciones W1-W5'
        });

        // 2. Add individual Panel Line stations (W1-W5)
        const panelLineStations = allStations
            .filter(station => station.line_type === 'W' && station.sequence_order >= 1 && station.sequence_order <= 5)
            .sort((a, b) => a.sequence_order - b.sequence_order); // Ensure W1, W2, etc. order

        panelLineStations.forEach(station => {
            options.push({
                value: station.station_id, // Use station_id for individual W stations
                label: station.name, // e.g., "Estación de Estructura (W1)"
                description: `Estación individual de la Línea de Paneles`
            });
        });

        // 3. Group assembly stations by sequence order (7-12 for assembly stations 1-6)
        allStations.forEach(station => {
            if (station.sequence_order >= 7 && station.sequence_order <= 12) {
                const assemblyNumber = station.sequence_order - 6; // 7->1, 8->2, etc.
                if (!sequenceMap.has(station.sequence_order)) {
                    sequenceMap.set(station.sequence_order, {
                        value: station.sequence_order,
                        label: `Estación de Ensamblaje ${assemblyNumber}`,
                        description: `Secuencia ${station.sequence_order} (Líneas A, B, C)`
                    });
                }
            }
        });

        // 4. Add assembly stations in order
        for (let seq = 7; seq <= 12; seq++) {
            if (sequenceMap.has(seq)) {
                options.push(sequenceMap.get(seq));
            }
        }

        return options;
    };

    const handleStationSelect = (value) => {
        setSelectedStationContext(value);
        localStorage.setItem('selectedStationContext', value);
    };

    const clearSelection = () => {
        setSelectedStationContext('');
        localStorage.removeItem('selectedStationContext');
    };

    const stationOptions = getStationOptions();

    const containerStyle = {
        padding: '20px',
        fontFamily: 'Arial, sans-serif',
        maxWidth: '800px',
        margin: '0 auto'
    };

    const headerStyle = {
        borderBottom: '1px solid #ccc',
        paddingBottom: '10px',
        marginBottom: '20px'
    };

    const optionContainerStyle = {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
        gap: '15px',
        marginBottom: '20px'
    };

    const optionCardStyle = {
        border: '2px solid #ddd',
        borderRadius: '8px',
        padding: '15px',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        backgroundColor: '#f9f9f9'
    };

    const selectedOptionCardStyle = {
        ...optionCardStyle,
        borderColor: '#007bff',
        backgroundColor: '#e7f3ff',
        boxShadow: '0 0 8px rgba(0,123,255,.3)'
    };

    const optionTitleStyle = {
        fontSize: '18px',
        fontWeight: 'bold',
        marginBottom: '5px',
        color: '#333'
    };

    const optionDescriptionStyle = {
        fontSize: '14px',
        color: '#666'
    };

    const buttonStyle = {
        padding: '10px 20px',
        margin: '5px',
        border: 'none',
        borderRadius: '4px',
        cursor: 'pointer',
        fontSize: '14px'
    };

    const clearButtonStyle = {
        ...buttonStyle,
        backgroundColor: '#6c757d',
        color: 'white'
    };

    const currentSelectionStyle = {
        padding: '15px',
        backgroundColor: '#d4edda',
        border: '1px solid #c3e6cb',
        borderRadius: '4px',
        marginBottom: '20px'
    };

    return (
        <div style={containerStyle}>
            <h2 style={headerStyle}>Gestión de Estaciones</h2>
            
            {stationsError && (
                <div style={{ color: 'red', marginBottom: '20px', padding: '10px', border: '1px solid red', borderRadius: '4px' }}>
                    Error: {stationsError}
                </div>
            )}

            {isLoadingStations ? (
                <p>Cargando estaciones...</p>
            ) : (
                <>
                    {selectedStationContext && (
                        <div style={currentSelectionStyle}>
                            <h4 style={{ margin: '0 0 10px 0' }}>Contexto Actual:</h4>
                            <p style={{ margin: '0' }}>
                                <strong>
                                    {stationOptions.find(opt => opt.value === selectedStationContext)?.label || selectedStationContext}
                                </strong>
                            </p>
                            <button onClick={clearSelection} style={clearButtonStyle}>
                                Limpiar Selección
                            </button>
                        </div>
                    )}

                    <h3>Seleccionar Contexto de Estación:</h3>
                    <div style={optionContainerStyle}>
                        {stationOptions.map(option => (
                            <div
                                key={option.value}
                                style={selectedStationContext === option.value ? selectedOptionCardStyle : optionCardStyle}
                                onClick={() => handleStationSelect(option.value)}
                            >
                                <div style={optionTitleStyle}>{option.label}</div>
                                <div style={optionDescriptionStyle}>{option.description}</div>
                            </div>
                        ))}
                    </div>

                    <div style={{ marginTop: '30px', padding: '15px', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
                        <h4>Información:</h4>
                        <ul style={{ marginBottom: 0 }}>
                            <li><strong>Línea de Paneles:</strong> Representa las estaciones W1-W5 donde se trabajan los paneles de los módulos.</li>
                            <li><strong>Estaciones de Ensamblaje:</strong> Representan las diferentes etapas del proceso de ensamblaje (1-6), cada una con líneas A, B y C.</li>
                        </ul>
                    </div>
                </>
            )}
        </div>
    );
}

export default StationManager;
