import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { loginUser } from '../services/authService'; // Assuming authService.js is in ../services

const LoginPage = ({ onLoginSuccess }) => {
    const [pin, setPin] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        if (!pin.trim()) {
            setError('El PIN no puede estar vacío.');
            setIsLoading(false);
            return;
        }

        try {
            const data = await loginUser(pin);
            onLoginSuccess(data.user, data.user_type); // Pass user and user_type
            navigate('/station'); // Navigate to station page on successful login
        } catch (err) {
            setError(err.message || 'Error al iniciar sesión. Verifique el PIN.');
        } finally {
            setIsLoading(false);
        }
    };

    const pageStyle = {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 'calc(100vh - 100px)', // Adjust based on nav height
        padding: '20px',
    };

    const formStyle = {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '30px',
        border: '1px solid #ccc',
        borderRadius: '8px',
        boxShadow: '0 4px 8px rgba(0,0,0,0.1)',
        backgroundColor: '#f9f9f9',
        width: '300px',
    };

    const inputStyle = {
        padding: '10px',
        margin: '10px 0',
        width: '90%',
        border: '1px solid #ddd',
        borderRadius: '4px',
        fontSize: '16px',
    };

    const buttonStyle = {
        padding: '10px 20px',
        margin: '10px 0',
        backgroundColor: '#007bff',
        color: 'white',
        border: 'none',
        borderRadius: '4px',
        fontSize: '16px',
        cursor: 'pointer',
    };

    const errorStyle = {
        color: 'red',
        marginTop: '10px',
    };

    return (
        <div style={pageStyle}>
            <form onSubmit={handleSubmit} style={formStyle}>
                <h2>Iniciar Sesión</h2>
                <input
                    type="password" // Use password type for PINs
                    placeholder="Ingrese su PIN"
                    value={pin}
                    onChange={(e) => setPin(e.target.value)}
                    style={inputStyle}
                    disabled={isLoading}
                />
                <button type="submit" style={buttonStyle} disabled={isLoading}>
                    {isLoading ? 'Ingresando...' : 'Ingresar'}
                </button>
                {error && <p style={errorStyle}>{error}</p>}
            </form>
        </div>
    );
};

export default LoginPage;
