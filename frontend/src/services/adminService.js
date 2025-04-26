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

// Reorder production plan items
export const reorderProductionPlan = async (orderedPlanIds) => {
    const response = await fetch(`${API_BASE_URL}/production_plan/reorder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ordered_plan_ids: orderedPlanIds }),
    });
    // Expects a 200 OK with a message on success
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

// === House Type Panels ===

export const getHouseTypePanels = async (houseTypeId, moduleSequenceNumber) => {
    const response = await fetch(`${API_BASE_URL}/house_types/${houseTypeId}/modules/${moduleSequenceNumber}/panels`);
    return handleResponse(response);
};

export const addHouseTypePanel = async (houseTypeId, moduleSequenceNumber, panelData) => {
    // panelData should include panel_group, panel_code, typology (optional), multiwall_id (optional)
    const payload = {
        ...panelData,
        multiwall_id: panelData.multiwall_id || null // Ensure null is sent if empty/undefined
    };
    const response = await fetch(`${API_BASE_URL}/house_types/${houseTypeId}/modules/${moduleSequenceNumber}/panels`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    return handleResponse(response);
};

// Update uses the specific panel ID
export const updateHouseTypePanel = async (houseTypePanelId, panelData) => {
    // panelData should include panel_group, panel_code, typology (optional), multiwall_id (optional)
     const payload = {
        ...panelData,
        multiwall_id: panelData.multiwall_id || null // Ensure null is sent if empty/undefined
    };
    const response = await fetch(`${API_BASE_URL}/house_type_panels/${houseTypePanelId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    return handleResponse(response);
};

// Delete uses the specific panel ID
export const deleteHouseTypePanel = async (houseTypePanelId) => {
    const response = await fetch(`${API_BASE_URL}/house_type_panels/${houseTypePanelId}`, {
        method: 'DELETE',
    });
    if (!response.ok && response.status !== 204) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to parse error response' }));
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }
    return true; // Indicate success
};

// === Multiwalls ===

export const getMultiwalls = async (houseTypeId, moduleSequenceNumber) => {
    const response = await fetch(`${API_BASE_URL}/house_types/${houseTypeId}/modules/${moduleSequenceNumber}/multiwalls`);
    return handleResponse(response);
};

export const addMultiwall = async (houseTypeId, moduleSequenceNumber, multiwallData) => {
    // multiwallData should include panel_group, multiwall_code
    const response = await fetch(`${API_BASE_URL}/house_types/${houseTypeId}/modules/${moduleSequenceNumber}/multiwalls`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(multiwallData),
    });
    return handleResponse(response);
};

export const updateMultiwall = async (multiwallId, multiwallData) => {
    // multiwallData should include panel_group, multiwall_code
    const response = await fetch(`${API_BASE_URL}/multiwalls/${multiwallId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(multiwallData),
    });
    return handleResponse(response);
};

export const deleteMultiwall = async (multiwallId) => {
    const response = await fetch(`${API_BASE_URL}/multiwalls/${multiwallId}`, {
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


// === Projects ===

export const getProjects = async () => {
    const response = await fetch(`${API_BASE_URL}/projects`);
    return handleResponse(response);
};

export const addProject = async (projectData) => {
    // projectData should include name, description, status, and house_types array
    // e.g., { name: 'Proj A', description: 'Desc', status: 'Planned', house_types: [{ house_type_id: 1, quantity: 5 }, ...] }
    const response = await fetch(`${API_BASE_URL}/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(projectData),
    });
    return handleResponse(response);
};

export const updateProject = async (id, projectData) => {
    const response = await fetch(`${API_BASE_URL}/projects/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(projectData),
    });
    return handleResponse(response);
};

export const deleteProject = async (id) => {
    const response = await fetch(`${API_BASE_URL}/projects/${id}`, {
        method: 'DELETE',
    });
    if (!response.ok && response.status !== 204) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to parse error response' }));
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }
    return true; // Indicate success
};


// === House Type Tipologias ===

export const getHouseTypeTipologias = async (houseTypeId) => {
    const response = await fetch(`${API_BASE_URL}/house_types/${houseTypeId}/tipologias`);
    return handleResponse(response);
};

export const addHouseTypeTipologia = async (houseTypeId, tipologiaData) => {
    // tipologiaData should include name, description (optional)
    const response = await fetch(`${API_BASE_URL}/house_types/${houseTypeId}/tipologias`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tipologiaData),
    });
    return handleResponse(response);
};

export const updateHouseTypeTipologia = async (tipologiaId, tipologiaData) => {
    // tipologiaData should include name, description (optional)
    const response = await fetch(`${API_BASE_URL}/tipologias/${tipologiaId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tipologiaData),
    });
    return handleResponse(response);
};

export const deleteHouseTypeTipologia = async (tipologiaId) => {
    const response = await fetch(`${API_BASE_URL}/tipologias/${tipologiaId}`, {
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

// Updated to include module_sequence_number and optional tipologia_id
export const setHouseTypeParameter = async (houseTypeId, parameterId, moduleSequenceNumber, value, tipologiaId = null) => {
    const response = await fetch(`${API_BASE_URL}/house_types/${houseTypeId}/parameters`, {
        method: 'POST', // Using POST for add/update via backend UPSERT
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            parameter_id: parameterId,
            module_sequence_number: moduleSequenceNumber,
            value: value,
            tipologia_id: tipologiaId // Send null if not provided or explicitly null
        }),
    });
    return handleResponse(response);
};

// Updated function to delete a specific parameter value for a specific module and optional tipologia
export const deleteParameterFromHouseTypeModule = async (houseTypeId, parameterId, moduleSequenceNumber, tipologiaId = null) => {
    let url = `${API_BASE_URL}/house_types/${houseTypeId}/parameters/${parameterId}/module/${moduleSequenceNumber}`;
    if (tipologiaId !== null) {
        url += `/tipologia/${tipologiaId}`; // Append tipologia ID if provided
    }
    const response = await fetch(url, {
        method: 'DELETE',
    });
    if (!response.ok && response.status !== 204) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to parse error response' }));
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }
    return true; // Indicate success
};


// === Production Plan ===

// Note: Functions for adding/updating/deleting individual plan items are removed.
// This is now handled automatically when updating a Project's status to/from 'Active'.

// Get production plan items with filtering/sorting/pagination
export const getProductionPlan = async (params = {}) => {
    // params = { projectId, houseTypeId, status, startDateAfter, sortBy, sortOrder, limit, offset }
    const query = new URLSearchParams(params).toString();
    const response = await fetch(`${API_BASE_URL}/production_plan?${query}`);
    return handleResponse(response);
};


// === Production Status Dashboard ===

export const getProductionStatus = async () => { // Removed upcomingCount parameter
    const response = await fetch(`${API_BASE_URL}/production_status`); // Removed query parameter
    return handleResponse(response);
};
