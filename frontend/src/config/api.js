// API Configuration
// This file centralizes all API endpoint configurations

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const config = {
  apiUrl: API_BASE_URL,
  endpoints: {
    auth: {
      login: `${API_BASE_URL}/auth/login`,
      logout: `${API_BASE_URL}/auth/logout`,
      verify: `${API_BASE_URL}/auth/verify`,
      me: `${API_BASE_URL}/auth/me`
    },
    roles: `${API_BASE_URL}/roles`
  }
};

export default config;
export { API_BASE_URL };
