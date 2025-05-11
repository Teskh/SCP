import React, { useState, useEffect, useMemo } from 'react';
import { Navigate } from 'react-router-dom';
import { getStations } from '../services/adminService'; // To fetch station details

const PANEL_LINE_GENERAL_VALUE = 'PANEL_LINE_GENERAL';
const PANEL_LINE_GENERAL_LABEL = 'Línea de Paneles (General)';

const StationPage = ({ user, activeStationSequenceOrder }) => {
    const [stations, setStations] = useState([]);
    const [isLoadingStations, setIsLoadingStations] = useState(false);
    const [stationError, setStationError] = useState('');

    useEffect(() => {
        if (!user) return; // Don't fetch if no user

        setIsLoadingStations(true);
        getStations()
            .then(data => {
                setStations(data || []); // Ensure data is an array
                setIsLoadingStations(false);
            })
            .catch(err => {
                console.error("Error fetching stations for StationPage:", err);
                setStationError(`Error cargando estaciones: ${err.message}`);
                setIsLoadingStations(false);
            });
    }, [user]); // Fetch stations when user is available

    const displayStationName = useMemo(() => {
        if (isLoadingStations) return "Cargando info de estación...";
        if (stationError) return "Error de estación";
        if (!activeStationSequenceOrder) return "Estación No Configurada";

        if (activeStationSequenceOrder === PANEL_LINE_GENERAL_VALUE) {
            return PANEL_LINE_GENERAL_LABEL;
        }

        if (!stations || stations.length === 0) return "Buscando estación...";

        // Logic similar to StationContextSelector to find the display name for the sequence
        const sequenceMap = new Map();
        stations.forEach(station => {
            if (!sequenceMap.has(station.sequence_order)) {
                let displayName = station.name;
                if (station.sequence_order >= 7) { // A/B/C lines start at sequence 7
                    const assemblyMatch = station.name.match(/Línea de Ensamblaje [A-C]: (Estación \d+)/);
                    if (assemblyMatch && assemblyMatch[1]) {
                        displayName = assemblyMatch[1]; // e.g., "Estación 1"
                    } else {
                        displayName = `Estación de Secuencia ${station.sequence_order}`;
                    }
                }
                sequenceMap.set(station.sequence_order, {
                    value: station.sequence_order,
                    label: `${displayName} (Secuencia ${station.sequence_order})`,
                    originalName: station.name
                });
            }
        });
        
        const sortedOptions = Array.from(sequenceMap.values()).sort((a, b) => a.value - b.value);
        const foundOption = sortedOptions.find(opt => opt.value.toString() === activeStationSequenceOrder);
        
        return foundOption ? foundOption.label : `Secuencia ${activeStationSequenceOrder} (Nombre no encontrado)`;

    }, [activeStationSequenceOrder, stations, isLoadingStations, stationError]);

    if (!user) {
        return <Navigate to="/" replace />;
    }

    const pageStyle = {
        padding: '20px',
        textAlign: 'center',
    };

    const headerStyle = {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '30px',
        paddingBottom: '10px',
        borderBottom: '1px solid #eee',
    };

    const stationInfoStyle = {
        fontSize: '0.9em',
        color: '#555',
    };

    return (
        <div style={pageStyle}>
            <div style={headerStyle}>
                <h1>Bienvenido/a, {user.first_name}!</h1>
                <div style={stationInfoStyle}>
                    Estación: {displayStationName}
                </div>
            </div>
            {stationError && <p style={{ color: 'red' }}>{stationError}</p>}
            <p>Contenido de la estación aquí...</p>
            {/* Future content for the station page will go here */}
        </div>
    );
};

export default StationPage;
