const axios = require('axios');

const API_URL = 'http://hris.slpa.lk:8082/api/v1';
const LOGIN_URL = `${API_URL}/auth/login`;
const READ_DATA_URL = `${API_URL}/general-queries/readData`;

let token = null;
let tokenExpiresAt = null;

const login = async () => {
  try {
    console.log('Logging into HRIS API...');
    const response = await axios.post(LOGIN_URL, {
      username: 'is_division',
      password: 'Is@division_2026'
    });

    // Debug: Log the entire response structure
    console.log('HRIS API Response:', JSON.stringify(response.data, null, 2));

    if (response.data) {
      // Check if response has token directly or nested in data
      const responseToken = response.data.token || response.data.data?.token;
      
      if (responseToken) {
        console.log('HRIS API login successful.');
        token = responseToken;
        
        // Decode token to get expiration, assuming it's a standard JWT
        try {
          const decodedToken = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
          if (decodedToken.exp) {
            tokenExpiresAt = new Date(decodedToken.exp * 1000);
            console.log(`Token expires at: ${tokenExpiresAt}`);
          }
        } catch (tokenDecodeError) {
          console.warn('Could not decode token expiration:', tokenDecodeError.message);
          // Set a default expiration of 1 hour
          tokenExpiresAt = new Date(Date.now() + 60 * 60 * 1000);
        }
        return token;
      } else {
        console.error('HRIS API login failed: No token found in response');
        console.error('Response structure:', response.data);
        throw new Error('HRIS API login failed');
      }
    } else {
      console.error('HRIS API login failed: No response data');
      throw new Error('HRIS API login failed');
    }
  } catch (error) {
    console.error('Error logging into HRIS API:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
      console.error('Response status:', error.response.status);
    }
    throw error;
  }
};

const getToken = async () => {
  if (!token || (tokenExpiresAt && new Date() >= tokenExpiresAt)) {
    console.log('Token is missing or expired, logging in again.');
    return await login();
  }
  return token;
};

const readData = async (collection, filter_array = {}, project = '', paginate = false) => {
  try {
    const authToken = await getToken();
    const response = await axios.post(
      READ_DATA_URL,
      {
        collection,
        filter_array: JSON.stringify(filter_array),
        project,
        paginate
      },
      {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (response.data && response.data.data) {
      return response.data.data;
    } else {
      console.warn(`No data received from HRIS API for collection: ${collection}`);
      return [];
    }
  } catch (error) {
    console.error(`Error fetching data from HRIS API for collection ${collection}:`, error.response ? error.response.data : error.message);
    // If token is invalid, try to login again once
    if (error.response && error.response.status === 401) {
        console.log('Token might be invalid, forcing re-login.');
        token = null; // Force re-login
        return readData(collection, filter_array, project, paginate);
    }
    throw error;
  }
};

module.exports = {
  login,
  readData
};
