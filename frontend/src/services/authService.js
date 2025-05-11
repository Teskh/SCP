// Using fetch API.
const AUTH_API_BASE_URL = process.env.REACT_APP_API_URL ? `${process.env.REACT_APP_API_URL.replace('/api/admin', '')}/api/auth` : 'http://localhost:5001/api/auth';


// Helper function to handle response status and parsing
const handleResponse = async (response) => {
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to parse error response' }));
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }
    // Handle 204 No Content specifically
    if (response.status === 204) {
        return null;
    }
    return response.json();
};

export const loginUser = async (pin) => {
    const response = await fetch(`${AUTH_API_BASE_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: pin }),
    });
    return handleResponse(response);
};
