import React, { useState, useEffect } from 'react';
import styles from './AdminComponentStyles'; // Using shared styles

const modalOverlayStyle = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
};

const modalContentStyle = {
    background: 'white',
    padding: '25px',
    borderRadius: '8px',
    boxShadow: '0 4px 15px rgba(0, 0, 0, 0.2)',
    width: '90%',
    maxWidth: '500px',
    maxHeight: '90vh',
    overflowY: 'auto',
};

const initialFormState = {
    project_name: '',
    // house_identifier_base: 'Lote', // Removed
    number_of_houses: 1,
    house_type_id: '',
};

function AddProductionBatchModal({ isOpen, onClose, onAddBatch, houseTypes, isLoadingHouseTypes }) {
    const [formData, setFormData] = useState(initialFormState);
    const [formError, setFormError] = useState('');

    useEffect(() => {
        // Reset form when modal is opened/closed or houseTypes change
        setFormData(initialFormState);
        setFormError('');
    }, [isOpen, houseTypes]);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        setFormError('');

        if (!formData.project_name.trim()) {
            setFormError('El nombre del proyecto es obligatorio.');
            return;
        }
        // house_identifier_base validation removed
        const numHouses = parseInt(formData.number_of_houses, 10);
        if (isNaN(numHouses) || numHouses < 1) {
            setFormError('El número de viviendas debe ser un entero positivo.');
            return;
        }
        if (!formData.house_type_id) {
            setFormError('Debe seleccionar un tipo de vivienda.');
            return;
        }
        
        const selectedHouseType = houseTypes.find(ht => ht.house_type_id === parseInt(formData.house_type_id));
        if (!selectedHouseType || selectedHouseType.number_of_modules < 1) {
            setFormError('El tipo de vivienda seleccionado no es válido o no tiene módulos definidos.');
            return;
        }

        onAddBatch({
            project_name: formData.project_name.trim(),
            // house_identifier_base removed
            number_of_houses: numHouses,
            house_type_id: parseInt(formData.house_type_id, 10),
        });
    };

    if (!isOpen) return null;

    return (
        <div style={modalOverlayStyle} onClick={onClose}>
            <div style={modalContentStyle} onClick={e => e.stopPropagation()}>
                <h3 style={{ ...styles.header, marginTop: 0, marginBottom: '20px' }}>Añadir Lote de Producción</h3>
                {formError && <p style={{ ...styles.error, marginBottom: '15px' }}>{formError}</p>}
                <form onSubmit={handleSubmit}>
                    <div style={styles.formGroup}>
                        <label style={styles.label} htmlFor="batch_project_name">Nombre del Proyecto:</label>
                        <input
                            style={styles.input}
                            type="text"
                            id="batch_project_name"
                            name="project_name"
                            value={formData.project_name}
                            onChange={handleInputChange}
                            required
                        />
                    </div>
                    {/* house_identifier_base input field removed */}
                    <div style={styles.formGroup}>
                        <label style={styles.label} htmlFor="batch_number_of_houses">Número de Viviendas en este Lote:</label>
                        <input
                            style={{...styles.input, width: '100px'}}
                            type="number"
                            id="batch_number_of_houses"
                            name="number_of_houses"
                            value={formData.number_of_houses}
                            onChange={handleInputChange}
                            required
                            min="1"
                        />
                    </div>
                    <div style={styles.formGroup}>
                        <label style={styles.label} htmlFor="batch_house_type_id">Tipo de Vivienda:</label>
                        {isLoadingHouseTypes ? <p>Cargando tipos de vivienda...</p> : (
                            <select
                                style={styles.select}
                                id="batch_house_type_id"
                                name="house_type_id"
                                value={formData.house_type_id}
                                onChange={handleInputChange}
                                required
                            >
                                <option value="">-- Seleccionar Tipo --</option>
                                {houseTypes.map(type => (
                                    <option key={type.house_type_id} value={type.house_type_id}>
                                        {type.name} ({type.number_of_modules} módulos)
                                    </option>
                                ))}
                            </select>
                        )}
                    </div>
                    <div style={{ ...styles.buttonGroup, marginTop: '25px', justifyContent: 'flex-end' }}>
                        <button type="button" onClick={onClose} style={{ ...styles.button, ...styles.buttonSecondary }} disabled={isLoadingHouseTypes}>
                            Cancelar
                        </button>
                        <button type="submit" style={styles.button} disabled={isLoadingHouseTypes}>
                            Añadir Lote
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default AddProductionBatchModal;
