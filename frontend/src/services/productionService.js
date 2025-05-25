// Production service for station context and task management
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001/api/production';

// Helper function to handle response status and parsing
const handleResponse = async (response) => {
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to parse error response' }));
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }
    if (response.status === 204) {
        return null;
    }
    return response.json();
};

// === Station Context ===

export const getStationContext = async (stationId, workerSpecialtyId = null) => {
    let url = `${API_BASE_URL}/station-context/${stationId}`;
    if (workerSpecialtyId !== null) {
        url += `?worker_specialty_id=${workerSpecialtyId}`;
    }
    const response = await fetch(url);
    return handleResponse(response);
};

export const getWorkerCurrentTask = async (workerId) => {
    const response = await fetch(`${API_BASE_URL}/worker-current-task/${workerId}`);
    return handleResponse(response);
};

// === Task Management ===

export const startPanelTask = async (taskData) => {
    // taskData should include: plan_id, panel_definition_id, task_definition_id, worker_id, station_id
    const response = await fetch(`${API_BASE_URL}/panel-task/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(taskData),
    });
    return handleResponse(response);
};

export const pausePanelTask = async (panelTaskLogId, workerId, reason = null) => {
    const payload = {
        worker_id: workerId,
        reason: reason
    };
    const response = await fetch(`${API_BASE_URL}/panel-task/${panelTaskLogId}/pause`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    return handleResponse(response);
};

export const resumePanelTask = async (panelTaskLogId, workerId) => {
    const payload = {
        worker_id: workerId
    };
    const response = await fetch(`${API_BASE_URL}/panel-task/${panelTaskLogId}/resume`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    return handleResponse(response);
};

export const finishPanelTask = async (panelTaskLogId, workerId, stationId, notes = null) => {
    const payload = {
        worker_id: workerId,
        station_id: stationId,
        notes: notes
    };
    const response = await fetch(`${API_BASE_URL}/panel-task/${panelTaskLogId}/finish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    return handleResponse(response);
};

// === Panel Status Management ===

export const updatePanelStatus = async (panelPlanId, status, currentStation = null) => {
    const payload = {
        status: status,
        current_station: currentStation
    };
    const response = await fetch(`${API_BASE_URL}/panel-production-plan/${panelPlanId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    return handleResponse(response);
};

export const getPanelsByStatusAndStation = async (status = null, currentStation = null) => {
    let url = `${API_BASE_URL}/panels`;
    const params = new URLSearchParams();
    
    if (status !== null) {
        params.append('status', status);
    }
    if (currentStation !== null) {
        params.append('current_station', currentStation);
    }
    
    if (params.toString()) {
        url += `?${params.toString()}`;
    }
    
    const response = await fetch(url);
    return handleResponse(response);
};

export const getPanelsForModule = async (planId) => {
    const response = await fetch(`${API_BASE_URL}/module-production-plan/${planId}/panels`);
    return handleResponse(response);
};
