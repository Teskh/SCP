import React from 'react';
import { Navigate } from 'react-router-dom';

const StationPage = ({ user, stationId }) => {
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
                    Estación: {stationId || "No Especificada"}
                </div>
            </div>
            <p>Contenido de la estación aquí...</p>
            {/* Future content for the station page will go here */}
        </div>
    );
};

export default StationPage;
