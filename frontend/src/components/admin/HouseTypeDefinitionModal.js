import React from 'react';
import PropTypes from 'prop-types';

function HouseTypeDefinitionModal({ houseTypeId, planIds, onClose }) {
    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
            backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center'
        }}>
            <div style={{
                backgroundColor: 'white', padding: '20px', borderRadius: '4px', minWidth: '300px'
            }}>
                <h2>Define House - Type {houseTypeId}</h2>
                <p>Plan Items: {planIds.join(', ')}</p>
                {/* TODO: Add form fields to define the house here */}
                <button onClick={onClose}>Close</button>
            </div>
        </div>
    );
}

HouseTypeDefinitionModal.propTypes = {
    houseTypeId: PropTypes.number.isRequired,
    planIds: PropTypes.arrayOf(PropTypes.number).isRequired,
    onClose: PropTypes.func.isRequired,
};

export default HouseTypeDefinitionModal;
