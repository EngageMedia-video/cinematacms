import React, { useState } from 'react';
import PropTypes from 'prop-types';
import './styles.scss';

/**
 * DemoComponent - A simple counter component with increment and decrement functions
 * This demonstrates a functional component with hooks and state management
 */
export const DemoComponent = ({ initialValue, title, onCountChange }) => {
  // State for the counter
  const [count, setCount] = useState(initialValue);

  // Handle increment with a maximum value of 10
  const handleIncrement = () => {
    if (count < 10) {
      const newCount = count + 1;
      setCount(newCount);
      if (onCountChange) {
        onCountChange(newCount);
      }
    }
  };

  // Handle decrement with a minimum value of 0
  const handleDecrement = () => {
    if (count > 0) {
      const newCount = count - 1;
      setCount(newCount);
      if (onCountChange) {
        onCountChange(newCount);
      }
    }
  };

  // Reset counter to initial value
  const handleReset = () => {
    setCount(initialValue);
    if (onCountChange) {
      onCountChange(initialValue);
    }
  };

  return (
    <div className="demo-component">
      <h2 className="demo-component__title">{title}</h2>
      <div className="demo-component__counter">
        <button
          className="demo-component__button"
          onClick={handleDecrement}
          disabled={count === 0}
        >
          -
        </button>
        <span className="demo-component__count">{count}</span>
        <button
          className="demo-component__button"
          onClick={handleIncrement}
          disabled={count === 10}
        >
          +
        </button>
      </div>
      <button
        className="demo-component__reset"
        onClick={handleReset}
      >
        Reset
      </button>
    </div>
  );
};

// Define prop types for type checking
DemoComponent.propTypes = {
  initialValue: PropTypes.number,
  title: PropTypes.string.isRequired,
  onCountChange: PropTypes.func,
};

// Default props
DemoComponent.defaultProps = {
  initialValue: 0,
  title: 'Demo Counter',
};

// Export as default for easier imports
export default DemoComponent;
