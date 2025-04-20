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

// === Workers ===

export const getWorkers = async () => {
    const response = await fetch(`${API_BASE_URL}/workers`);
    return handleResponse(response);
};

export const addWorker = async (workerData) => {
    // Ensure boolean is sent correctly if needed, or handle conversion server-side
    const payload = {
        ...workerData,
        specialty_id: workerData.specialty_id || null,
        supervisor_id: workerData.supervisor_id || null,
        is_active: Boolean(workerData.is_active) // Ensure boolean
    };
    const response = await fetch(`${API_BASE_URL}/workers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    return handleResponse(response);
};

export const updateWorker = async (id, workerData) => {
     const payload = {
        ...workerData,
        specialty_id: workerData.specialty_id || null,
        supervisor_id: workerData.supervisor_id || null,
        is_active: Boolean(workerData.is_active) // Ensure boolean
    };
    const response = await fetch(`${API_BASE_URL}/workers/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    return handleResponse(response);
};

export const deleteWorker = async (id) => {
    const response = await fetch(`${API_BASE_URL}/workers/${id}`, {
        method: 'DELETE',
    });
    if (!response.ok && response.status !== 204) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to parse error response' }));
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }
    return true; // Indicate success
};


// === Supervisors (Subset of Admin Team) ===

export const getSupervisors = async () => {
    // Fetches only active admin team members with the 'Supervisor' role
    const response = await fetch(`${API_BASE_URL}/supervisors`);
    return handleResponse(response);
};

// === Admin Team ===

export const getAdminTeam = async () => {
    const response = await fetch(`${API_BASE_URL}/admin_team`);
    return handleResponse(response);
};

export const addAdminTeamMember = async (memberData) => {
    const payload = {
        ...memberData,
        is_active: Boolean(memberData.is_active) // Ensure boolean
    };
    const response = await fetch(`${API_BASE_URL}/admin_team`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    return handleResponse(response);
};

export const updateAdminTeamMember = async (id, memberData) => {
     const payload = {
        ...memberData,
        is_active: Boolean(memberData.is_active) // Ensure boolean
    };
    const response = await fetch(`${API_BASE_URL}/admin_team/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    return handleResponse(response);
};

export const deleteAdminTeamMember = async (id) => {
    const response = await fetch(`${API_BASE_URL}/admin_team/${id}`, {
        method: 'DELETE',
    });
    if (!response.ok && response.status !== 204) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to parse error response' }));
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }
    return true; // Indicate success
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
        house_type_id: taskDefData.house_type_id || null, // Renamed field
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
        house_type_id: taskDefData.house_type_id || null, // Renamed field
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

export const getHouseTypes = async () => {
    const response = await fetch(`${API_BASE_URL}/house_types`);
    return handleResponse(response);
};

// Add CRUD operations for HouseTypes
export const addHouseType = async (houseTypeData) => {
    const response = await fetch(`${API_BASE_URL}/house_types`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(houseTypeData),
    });
    return handleResponse(response);
};

export const updateHouseType = async (id, houseTypeData) => {
    const response = await fetch(`${API_BASE_URL}/house_types/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(houseTypeData),
    });
    return handleResponse(response);
};

export const deleteHouseType = async (id) => {
    const response = await fetch(`${API_BASE_URL}/house_types/${id}`, {
        method: 'DELETE',
    });
    if (!response.ok && response.status !== 204) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to parse error response' }));
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }
    return true; // Indicate success
};


export const getStations = async () => {
    const response = await fetch(`${API_BASE_URL}/stations`);
    return handleResponse(response);
};

// === House Parameters ===

export const getHouseParameters = async () => {
    const response = await fetch(`${API_BASE_URL}/house_parameters`);
    return handleResponse(response);
};

export const addHouseParameter = async (parameterData) => {
    const response = await fetch(`${API_BASE_URL}/house_parameters`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parameterData),
    });
    return handleResponse(response);
};

export const updateHouseParameter = async (id, parameterData) => {
    const response = await fetch(`${API_BASE_URL}/house_parameters/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parameterData),
    });
    return handleResponse(response);
};

export const deleteHouseParameter = async (id) => {
    const response = await fetch(`${API_BASE_URL}/house_parameters/${id}`, {
        method: 'DELETE',
    });
    if (!response.ok && response.status !== 204) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to parse error response' }));
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }
    return true; // Indicate success
};

// === House Type Parameters (Linking) ===

export const getParametersForHouseType = async (houseTypeId) => {
    const response = await fetch(`${API_BASE_URL}/house_types/${houseTypeId}/parameters`);
    return handleResponse(response);
};

// Updated to include module_sequence_number
export const setHouseTypeParameter = async (houseTypeId, parameterId, moduleSequenceNumber, value) => {
    const response = await fetch(`${API_BASE_URL}/house_types/${houseTypeId}/parameters`, {
        method: 'POST', // Using POST for add/update via backend UPSERT
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            parameter_id: parameterId,
            module_sequence_number: moduleSequenceNumber,
            value: value
        }),
    });
    return handleResponse(response);
};

// New function to delete a specific parameter value for a specific module
export const deleteParameterFromHouseTypeModule = async (houseTypeId, parameterId, moduleSequenceNumber) => {
    const response = await fetch(`${API_BASE_URL}/house_types/${houseTypeId}/parameters/${parameterId}/module/${moduleSequenceNumber}`, {
        method: 'DELETE',
    });
    if (!response.ok && response.status !== 204) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to parse error response' }));
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }
    return true; // Indicate success
};
