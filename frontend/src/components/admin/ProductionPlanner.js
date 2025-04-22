import React, { useState, useEffect, useCallback } from 'react';
import * as adminService from '../../services/adminService';
import styles from './AdminComponentStyles'; // Assuming shared styles

const initialFormState = {
    project_id: '',
    house_type_id: '',
    house_identifier: '',
    planned_sequence: '',
    planned_start_datetime: '', // Consider using a datetime-local input
    planned_assembly_line: '', // 'A', 'B', or 'C'
    status: 'Planned',
};

const initialBulkFormState = {
    project_id: '',
    house_type_id: '',
    quantity: '',
    start_sequence: '',
    start_datetime: '', // Maybe just date?
    line_pattern: 'ABC', // e.g., ABC for A, B, C, A, B, C... or A for all A
    identifier_prefix: '', // e.g., "Unit-" -> Unit-1, Unit-2...
};

function ProductionPlanner() {
    const [planItems, setPlanItems] = useState([]);
    const [projects, setProjects] = useState([]);
    const [houseTypes, setHouseTypes] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [editMode, setEditMode] = useState(null); // null or plan_id
    const [formData, setFormData] = useState(initialFormState);
    const [showBulkForm, setShowBulkForm] = useState(false);
    const [bulkFormData, setBulkFormData] = useState(initialBulkFormState);

    // Fetch initial data (plan items, projects, house types)
    const fetchData = useCallback(async () => {
        setIsLoading(true);
        setError('');
        try {
            const [planData, projectsData, houseTypesData] = await Promise.all([
                adminService.getProductionPlan({ sortBy: 'planned_sequence', sortOrder: 'ASC' }), // Fetch sorted plan
                adminService.getProjects(), // Fetch projects for dropdowns
                adminService.getHouseTypes() // Fetch house types for dropdowns
            ]);
            setPlanItems(planData);
            setProjects(projectsData);
            // Filter house types if needed, or use all
            setHouseTypes(houseTypesData.map(ht => ({ house_type_id: ht.house_type_id, name: ht.name })));
        } catch (err) {
            setError(`Error fetching data: ${err.message}`);
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Handlers
    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

     const handleBulkInputChange = (e) => {
        const { name, value } = e.target;
        setBulkFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleEdit = (item) => {
        setEditMode(item.plan_id);
        // Format datetime for input field if necessary
        const formattedDateTime = item.planned_start_datetime ? item.planned_start_datetime.replace(' ', 'T') : '';
        setFormData({
            project_id: item.project_id,
            house_type_id: item.house_type_id,
            house_identifier: item.house_identifier,
            planned_sequence: item.planned_sequence,
            planned_start_datetime: formattedDateTime,
            planned_assembly_line: item.planned_assembly_line,
            status: item.status,
        });
        setShowBulkForm(false); // Hide bulk form when editing single
    };

    const handleCancelEdit = () => {
        setEditMode(null);
        setFormData(initialFormState);
    };

    const handleDelete = async (planId) => {
        if (window.confirm('¿Está seguro de que desea eliminar este elemento del plan?')) {
            setIsLoading(true);
            try {
                await adminService.deleteProductionPlanItem(planId);
                // Refetch or filter locally
                setPlanItems(prev => prev.filter(item => item.plan_id !== planId));
            } catch (err) {
                setError(`Error deleting item: ${err.message}`);
            } finally {
                setIsLoading(false);
            }
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');

        // Format datetime back to 'YYYY-MM-DD HH:MM:SS' if needed
        const payload = {
            ...formData,
            planned_start_datetime: formData.planned_start_datetime.replace('T', ' '),
            // Ensure numeric types are numbers if required by backend (though backend seems flexible)
            project_id: parseInt(formData.project_id, 10),
            house_type_id: parseInt(formData.house_type_id, 10),
            planned_sequence: parseInt(formData.planned_sequence, 10),
        };

        try {
            if (editMode) {
                // Update
                const updatedItem = await adminService.updateProductionPlanItem(editMode, payload);
                setPlanItems(prev => prev.map(item => item.plan_id === editMode ? updatedItem : item));
            } else {
                // Add new
                const newItem = await adminService.addProductionPlanItem(payload);
                setPlanItems(prev => [...prev, newItem].sort((a, b) => a.planned_sequence - b.planned_sequence)); // Add and re-sort
            }
            handleCancelEdit(); // Reset form
        } catch (err) {
            setError(`Error saving item: ${err.message}`);
            console.error("Save error payload:", payload);
        } finally {
            setIsLoading(false);
        }
    };

    const handleBulkSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');

        const {
            project_id, house_type_id, quantity, start_sequence,
            start_datetime, line_pattern, identifier_prefix
        } = bulkFormData;

        // Basic validation
        const qty = parseInt(quantity, 10);
        const startSeq = parseInt(start_sequence, 10);
        if (isNaN(qty) || qty <= 0 || isNaN(startSeq) || startSeq < 0) {
            setError("Cantidad y Secuencia Inicial deben ser números positivos.");
            setIsLoading(false);
            return;
        }
        if (!project_id || !house_type_id || !start_datetime || !line_pattern) {
             setError("Por favor complete todos los campos del formulario masivo.");
             setIsLoading(false);
             return;
        }

        const itemsToAdd = [];
        const patternLength = line_pattern.length;
        const startDate = new Date(start_datetime); // Assuming date input for start

        for (let i = 0; i < qty; i++) {
            const currentSequence = startSeq + i;
            // Simple date increment logic (e.g., add 1 day per item) - ADJUST AS NEEDED
            const currentStartDate = new Date(startDate);
            currentStartDate.setDate(startDate.getDate() + i); // Example: increment day
            const formattedDateTime = `${currentStartDate.getFullYear()}-${String(currentStartDate.getMonth() + 1).padStart(2, '0')}-${String(currentStartDate.getDate()).padStart(2, '0')} 08:00:00`; // Example time

            itemsToAdd.push({
                project_id: parseInt(project_id, 10),
                house_type_id: parseInt(house_type_id, 10),
                house_identifier: `${identifier_prefix || 'Item'}-${currentSequence}`, // Adjust identifier logic
                planned_sequence: currentSequence,
                planned_start_datetime: formattedDateTime, // Use calculated date/time
                planned_assembly_line: line_pattern[i % patternLength].toUpperCase(),
                status: 'Planned',
            });
        }

        try {
            await adminService.addBulkProductionPlanItems(itemsToAdd);
            setShowBulkForm(false);
            setBulkFormData(initialBulkFormState);
            fetchData(); // Refresh the list
        } catch (err) {
            setError(`Error en creación masiva: ${err.message}`);
            console.error("Bulk save error payload:", itemsToAdd);
        } finally {
            setIsLoading(false);
        }
    };


    return (
        <div style={styles.container}>
            <h2 style={styles.header}>Planificador de Producción</h2>

            {error && <p style={styles.error}>{error}</p>}
            {isLoading && <p>Cargando...</p>}

            {/* Toggle Bulk Add Form */}
            <button onClick={() => setShowBulkForm(!showBulkForm)} style={{ ...styles.button, marginBottom: '15px' }}>
                {showBulkForm ? 'Ocultar Formulario Masivo' : 'Mostrar Formulario Masivo'}
            </button>

            {/* Bulk Add Form */}
            {showBulkForm && (
                <form onSubmit={handleBulkSubmit} style={{ ...styles.form, border: '1px dashed blue', padding: '15px', marginBottom: '20px' }}>
                    <h3 style={styles.header}>Creación Masiva</h3>
                     <div style={styles.formGroup}>
                        <label style={styles.label}>Proyecto:</label>
                        <select name="project_id" value={bulkFormData.project_id} onChange={handleBulkInputChange} required style={styles.input}>
                            <option value="">Seleccione Proyecto</option>
                            {projects.map(p => <option key={p.project_id} value={p.project_id}>{p.name}</option>)}
                        </select>
                    </div>
                     <div style={styles.formGroup}>
                        <label style={styles.label}>Tipo Vivienda:</label>
                        <select name="house_type_id" value={bulkFormData.house_type_id} onChange={handleBulkInputChange} required style={styles.input}>
                            <option value="">Seleccione Tipo</option>
                            {houseTypes.map(ht => <option key={ht.house_type_id} value={ht.house_type_id}>{ht.name}</option>)}
                        </select>
                    </div>
                     <div style={styles.formGroup}>
                        <label style={styles.label}>Cantidad:</label>
                        <input type="number" name="quantity" value={bulkFormData.quantity} onChange={handleBulkInputChange} required min="1" style={styles.input} />
                    </div>
                     <div style={styles.formGroup}>
                        <label style={styles.label}>Prefijo Identificador:</label>
                        <input type="text" name="identifier_prefix" value={bulkFormData.identifier_prefix} onChange={handleBulkInputChange} placeholder="Ej: Lote-" style={styles.input} />
                    </div>
                     <div style={styles.formGroup}>
                        <label style={styles.label}>Secuencia Inicial:</label>
                        <input type="number" name="start_sequence" value={bulkFormData.start_sequence} onChange={handleBulkInputChange} required min="0" style={styles.input} />
                    </div>
                     <div style={styles.formGroup}>
                        <label style={styles.label}>Fecha Inicio (Aprox):</label>
                        <input type="date" name="start_datetime" value={bulkFormData.start_datetime} onChange={handleBulkInputChange} required style={styles.input} />
                    </div>
                     <div style={styles.formGroup}>
                        <label style={styles.label}>Patrón Línea (Ej: ABC):</label>
                        <input type="text" name="line_pattern" value={bulkFormData.line_pattern} onChange={handleBulkInputChange} required style={styles.input} />
                    </div>
                    <div style={styles.formActions}>
                        <button type="submit" style={styles.button} disabled={isLoading}>Generar Plan Masivo</button>
                        <button type="button" onClick={() => setShowBulkForm(false)} style={{...styles.button, ...styles.cancelButton}}>Cancelar</button>
                    </div>
                </form>
            )}


            {/* Add/Edit Form (Single) */}
            {!showBulkForm && (
                <form onSubmit={handleSubmit} style={styles.form}>
                    <h3 style={styles.header}>{editMode ? 'Editar Elemento' : 'Añadir Nuevo Elemento al Plan'}</h3>
                    {/* Project Dropdown */}
                    <div style={styles.formGroup}>
                        <label style={styles.label}>Proyecto:</label>
                        <select name="project_id" value={formData.project_id} onChange={handleInputChange} required style={styles.input}>
                            <option value="">Seleccione Proyecto</option>
                            {projects.map(p => <option key={p.project_id} value={p.project_id}>{p.name}</option>)}
                        </select>
                    </div>
                    {/* House Type Dropdown */}
                     <div style={styles.formGroup}>
                        <label style={styles.label}>Tipo Vivienda:</label>
                        <select name="house_type_id" value={formData.house_type_id} onChange={handleInputChange} required style={styles.input}>
                            <option value="">Seleccione Tipo</option>
                            {houseTypes.map(ht => <option key={ht.house_type_id} value={ht.house_type_id}>{ht.name}</option>)}
                        </select>
                    </div>
                    {/* House Identifier */}
                     <div style={styles.formGroup}>
                        <label style={styles.label}>Identificador Vivienda:</label>
                        <input type="text" name="house_identifier" value={formData.house_identifier} onChange={handleInputChange} required style={styles.input} placeholder="Ej: Lote-101, Unidad-A"/>
                    </div>
                    {/* Planned Sequence */}
                     <div style={styles.formGroup}>
                        <label style={styles.label}>Secuencia Plan:</label>
                        <input type="number" name="planned_sequence" value={formData.planned_sequence} onChange={handleInputChange} required style={styles.input} />
                    </div>
                    {/* Planned Start Datetime */}
                     <div style={styles.formGroup}>
                        <label style={styles.label}>Fecha/Hora Inicio Plan:</label>
                        <input type="datetime-local" name="planned_start_datetime" value={formData.planned_start_datetime} onChange={handleInputChange} required style={styles.input} />
                    </div>
                    {/* Planned Assembly Line */}
                     <div style={styles.formGroup}>
                        <label style={styles.label}>Línea Ensamblaje Plan:</label>
                        <select name="planned_assembly_line" value={formData.planned_assembly_line} onChange={handleInputChange} required style={styles.input}>
                            <option value="">Seleccione Línea</option>
                            <option value="A">A</option>
                            <option value="B">B</option>
                            <option value="C">C</option>
                        </select>
                    </div>
                    {/* Status */}
                     <div style={styles.formGroup}>
                        <label style={styles.label}>Estado:</label>
                        <select name="status" value={formData.status} onChange={handleInputChange} required style={styles.input}>
                            <option value="Planned">Planeado</option>
                            <option value="Scheduled">Programado</option>
                            <option value="In Progress">En Progreso</option>
                            <option value="Completed">Completado</option>
                            <option value="On Hold">En Espera</option>
                            <option value="Cancelled">Cancelado</option>
                        </select>
                    </div>
                    {/* Actions */}
                    <div style={styles.formActions}>
                        <button type="submit" style={styles.button} disabled={isLoading}>
                            {editMode ? 'Actualizar' : 'Añadir'}
                        </button>
                        {editMode && (
                            <button type="button" onClick={handleCancelEdit} style={{...styles.button, ...styles.cancelButton}}>
                                Cancelar
                            </button>
                        )}
                    </div>
                </form>
            )}

            {/* Plan Items Table */}
            <h3 style={styles.header}>Plan Actual</h3>
            <table style={styles.table}>
                <thead>
                    <tr>
                        <th style={styles.th}>Secuencia</th>
                        <th style={styles.th}>Identificador</th>
                        <th style={styles.th}>Proyecto</th>
                        <th style={styles.th}>Tipo Vivienda</th>
                        <th style={styles.th}>Fecha/Hora Inicio</th>
                        <th style={styles.th}>Línea</th>
                        <th style={styles.th}>Estado</th>
                        <th style={styles.th}>Acciones</th>
                    </tr>
                </thead>
                <tbody>
                    {planItems.map(item => (
                        <tr key={item.plan_id}>
                            <td style={styles.td}>{item.planned_sequence}</td>
                            <td style={styles.td}>{item.house_identifier}</td>
                            <td style={styles.td}>{item.project_name}</td>
                            <td style={styles.td}>{item.house_type_name}</td>
                            <td style={styles.td}>{item.planned_start_datetime}</td>
                            <td style={styles.td}>{item.planned_assembly_line}</td>
                            <td style={styles.td}>{item.status}</td>
                            <td style={styles.td}>
                                <button onClick={() => handleEdit(item)} style={{...styles.button, ...styles.editButton}}>Editar</button>
                                <button onClick={() => handleDelete(item.plan_id)} style={{...styles.button, ...styles.deleteButton}}>Eliminar</button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

export default ProductionPlanner;
