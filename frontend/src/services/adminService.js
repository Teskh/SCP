// Using fetch API. Replace with Axios if preferred.
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001/api/admin'; // Use environment variable or default

// Helper function to handle response status and parsing
const handleResponse = async (response) => {
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to parse error response' }));
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }
    // Handle 204 No Content specifically
    if (response.status === 204) {
        return null; // Or return an empty object/true if needed
    }
    return response.json();
};

// === Specialties ===

export const getSpecialties = async () => {
    const response = await fetch(`${API_BASE_URL}/specialties`);
    return handleResponse(response);
};

export const addSpecialty = async (specialtyData) => {
    const response = await fetch(`${API_BASE_URL}/specialties`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(specialtyData),
    });
    return handleResponse(response);
};

export const updateSpecialty = async (id, specialtyData) => {
    const response = await fetch(`${API_BASE_URL}/specialties/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(specialtyData),
    });
    return handleResponse(response);
};

export const deleteSpecialty = async (id) => {
    const response = await fetch(`${API_BASE_URL}/specialties/${id}`, {
        method: 'DELETE',
    });
     // Handle 200 or 204 for delete success
    if (!response.ok && response.status !== 204) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to parse error response' }));
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }
    return true; // Indicate success
};


// === Task Definitions ===

export const getTaskDefinitions = async () => {
    const response = await fetch(`${API_BASE_URL}/task_definitions`);
    return handleResponse(response);
};

export const addTaskDefinition = async (taskDefData) => {
    // Ensure foreign keys are null if empty string or 0 (depending on backend expectation)
    const payload = {
        ...taskDefData,
        module_type_id: taskDefData.module_type_id || null,
        specialty_id: taskDefData.specialty_id || null,
        station_id: taskDefData.station_id || null,
    };
    const response = await fetch(`${API_BASE_URL}/task_definitions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    return handleResponse(response);
};

export const updateTaskDefinition = async (id, taskDefData) => {
     const payload = {
        ...taskDefData,
        module_type_id: taskDefData.module_type_id || null,
        specialty_id: taskDefData.specialty_id || null,
        station_id: taskDefData.station_id || null,
    };
    const response = await fetch(`${API_BASE_URL}/task_definitions/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    return handleResponse(response);
};

export const deleteTaskDefinition = async (id) => {
    const response = await fetch(`${API_BASE_URL}/task_definitions/${id}`, {
        method: 'DELETE',
    });
    if (!response.ok && response.status !== 204) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to parse error response' }));
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }
    return true; // Indicate success
};

// === Fetching related data for dropdowns ===

export const getModuleTypes = async () => {
    const response = await fetch(`${API_BASE_URL}/module_types`);
    return handleResponse(response);
};

export const getStations = async () => {
    const response = await fetch(`${API_BASE_URL}/stations`);
    return handleResponse(response);
};
