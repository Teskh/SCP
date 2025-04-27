// Shared basic styles for Admin components
// Adjust as needed for consistency

const styles = {
    container: {
        padding: '20px',
        fontFamily: 'Arial, sans-serif',
    },
    header: {
        color: '#333',
        borderBottom: '1px solid #eee',
        paddingBottom: '10px',
        marginBottom: '20px',
    },
    form: {
        marginBottom: '30px',
        padding: '15px',
        border: '1px solid #ddd',
        borderRadius: '5px',
        backgroundColor: '#f9f9f9',
    },
    formGroup: {
        marginBottom: '15px',
    },
    label: {
        display: 'block',
        marginBottom: '5px',
        fontWeight: 'bold',
        color: '#555',
    },
    input: {
        width: '100%',
        padding: '8px',
        border: '1px solid #ccc',
        borderRadius: '4px',
        boxSizing: 'border-box', // Include padding and border in element's total width and height
    },
    select: { // Can use input style or define separately
        width: '100%',
        padding: '8px',
        border: '1px solid #ccc',
        borderRadius: '4px',
        boxSizing: 'border-box',
        backgroundColor: 'white', // Ensure background for select
    },
    checkboxLabel: {
        marginLeft: '5px',
        fontWeight: 'normal',
    },
    formActions: {
        marginTop: '20px',
    },
    button: {
        padding: '10px 15px',
        border: 'none',
        borderRadius: '4px',
        cursor: 'pointer',
        marginRight: '10px',
        backgroundColor: '#007bff',
        color: 'white',
        fontSize: '1em',
    },
    editButton: {
        backgroundColor: '#ffc107', // Yellow
        color: '#333',
        marginRight: '5px',
        padding: '5px 10px', // Smaller padding for table buttons
        fontSize: '0.9em',
    },
    deleteButton: {
        backgroundColor: '#dc3545', // Red
        color: 'white',
        padding: '5px 10px', // Smaller padding
        fontSize: '0.9em',
    },
    cancelButton: {
        backgroundColor: '#6c757d', // Gray
    },
    table: {
        width: '100%',
        borderCollapse: 'collapse',
        marginTop: '20px',
    },
    th: {
        border: '1px solid #ddd',
        padding: '10px', // Increased padding
        textAlign: 'left',
        backgroundColor: '#f2f2f2',
        fontWeight: 'bold', // Make headers bold
    },
    td: {
        border: '1px solid #ddd',
        padding: '10px', // Increased padding
        textAlign: 'left',
        verticalAlign: 'top', // Align content top for consistency
    },
    error: {
        color: 'red',
        marginTop: '10px',
        marginBottom: '10px',
        padding: '10px',
        border: '1px solid red',
        borderRadius: '4px',
        backgroundColor: '#ffebeb',
    },
    moduleSelectContainer: { // Container for the "Seleccionar: [M1] [M2]" part
        display: 'inline-flex', // Align items horizontally
        alignItems: 'center',
        marginLeft: '15px', // Space from project name
        verticalAlign: 'middle', // Align with text/icons
    },
    moduleSelectLabel: { // Style for the "Seleccionar:" text
        marginRight: '5px',
        fontSize: '0.9em',
        color: '#555',
        fontWeight: 'normal', // Label doesn't need to be bold
    },
    moduleSelectButton: { // Style for the individual [Mx] buttons
        backgroundColor: '#6c757d', // Grey color, can adjust
        color: 'white',
        padding: '2px 6px', // Slightly smaller padding
        fontSize: '0.8em', // Keep font size small
        border: 'none',
        borderRadius: '3px',
        cursor: 'pointer',
        marginLeft: '4px', // Space between buttons
        // verticalAlign: 'middle', // Inherited from container
    },
    // Add more shared styles as needed
};

export default styles;
