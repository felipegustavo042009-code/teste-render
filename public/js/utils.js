// Utility functions for the Educational Platform

// DOM Manipulation Utilities
const DOM = {
    // Get element by ID
    get: (id) => document.getElementById(id),
    
    // Get elements by class name
    getByClass: (className) => document.getElementsByClassName(className),
    
    // Get elements by query selector
    query: (selector) => document.querySelector(selector),
    
    // Get all elements by query selector
    queryAll: (selector) => document.querySelectorAll(selector),
    
    // Create element with attributes
    create: (tag, attributes = {}, content = '') => {
        const element = document.createElement(tag);
        Object.keys(attributes).forEach(key => {
            if (key === 'className') {
                element.className = attributes[key];
            } else if (key === 'innerHTML') {
                element.innerHTML = attributes[key];
            } else {
                element.setAttribute(key, attributes[key]);
            }
        });
        if (content) {
            element.textContent = content;
        }
        return element;
    },
    
    // Show element
    show: (element) => {
        if (typeof element === 'string') {
            element = DOM.get(element);
        }
        if (element) {
            element.style.display = 'block';
        }
    },
    
    // Hide element
    hide: (element) => {
        if (typeof element === 'string') {
            element = DOM.get(element);
        }
        if (element) {
            element.style.display = 'none';
        }
    },
    
    // Toggle element visibility
    toggle: (element) => {
        if (typeof element === 'string') {
            element = DOM.get(element);
        }
        if (element) {
            element.style.display = element.style.display === 'none' ? 'block' : 'none';
        }
    }
};

// Validation Utilities
const Validator = {
    // Check if string is not empty
    isNotEmpty: (str) => {
        return str && str.trim().length > 0;
    },
    
    // Check if string has minimum length
    hasMinLength: (str, minLength) => {
        return str && str.length >= minLength;
    },
    
    // Check if string has maximum length
    hasMaxLength: (str, maxLength) => {
        return str && str.length <= maxLength;
    },
    
    // Validate class code format
    isValidClassCode: (code) => {
        const codeRegex = /^[A-Z]{3}\d{3}$/;
        return codeRegex.test(code);
    },
    
};

// Date and Time Utilities
const DateUtils = {
    
    // Format date and time
    formatDateTime: (date) => {
        if (typeof date === 'string') {
            date = new Date(date);
        }
        return `${DateUtils.formatDate(date)} ${DateUtils.formatTime(date)}`;
    },
    
    // Add hours to date
    addHours: (date, hours) => {
        const result = new Date(date);
        result.setHours(result.getHours() + hours);
        return result;
    }
};

// String Utilities
const StringUtils = {
    
    // Generate random string
    generateRandomString: (length = 8) => {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        for (let i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    },
    
    // Generate class code
    generateClassCode: () => {
        const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        const numbers = '0123456789';
        let code = '';
        
        // 3 letters
        for (let i = 0; i < 3; i++) {
            code += letters.charAt(Math.floor(Math.random() * letters.length));
        }
        
        // 3 numbers
        for (let i = 0; i < 3; i++) {
            code += numbers.charAt(Math.floor(Math.random() * numbers.length));
        }
        
        return code;
    },
};

// Array Utilities
const ArrayUtils = {
    // Shuffle array
    shuffle: (array) => {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }
};


// Export utilities to global scope
window.DOM = DOM;
window.Validator = Validator;
window.DateUtils = DateUtils;
window.StringUtils = StringUtils;
window.ArrayUtils = ArrayUtils;

