#!/usr/bin/env node

/**
 * Test script to verify sub-section activity logging
 */

const axios = require('axios');
const { spawn } = require('child_process');

const API_BASE = 'http://localhost:5000/api';

let authToken = null;

async function login() {
  try {
    console.log('🔐 Logging in...');
    const response = await axios.post(`${API_BASE}/auth/login`, {
      email: 'admin@slpa.lk',
      password: 'admin@123'
    });

    if (response.data.token) {
      authToken = response.data.token;
      console.log('✅ Login successful');
      return true;
    } else {
      console.log('❌ No token received');
      return false;
    }
  } catch (error) {
    console.error('❌ Login failed:', error.response?.data?.message || error.message);
    return false;
  }
}

async function createSubSection() {
  if (!authToken) {
    console.log('❌ Not authenticated');
    return false;
  }

  try {
    console.log('\n📝 Creating test sub-section...');
    
    const response = await axios.post(
      `${API_BASE}/mysql-subsections`,
      {
        parentDivision: {
          id: '1',
          division_code: 'ADMIN',
          division_name: 'Administration'
        },
        parentSection: {
          id: '1',
          hie_code: 'HQ',
          hie_name: 'Head Quarter'
        },
        subSection: {
          sub_hie_name: `Test Sub-Section ${Date.now()}`,
          sub_hie_code: `TSS${Math.floor(Math.random() * 10000)}`
        }
      },
      {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (response.status === 201) {
      console.log('✅ Sub-section created successfully');
      console.log(`   Name: ${response.data.data?.subSection?.sub_hie_name}`);
      console.log(`   Code: ${response.data.data?.subSection?.sub_hie_code}`);
      return true;
    }
  } catch (error) {
    console.error('❌ Sub-section creation failed:', error.response?.data?.message || error.message);
    return false;
  }
}

async function checkRecentActivities() {
  if (!authToken) {
    console.log('❌ Not authenticated');
    return false;
  }

  try {
    console.log('\n📊 Checking recent activities...');
    
    const response = await axios.get(
      `${API_BASE}/dashboard/activities/recent?limit=5`,
      {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (response.data.success) {
      console.log(`✅ Retrieved ${response.data.data.length} recent activities`);
      
      response.data.data.forEach((activity, index) => {
        console.log(`\n   [${index + 1}] ${activity.title}`);
        console.log(`       Description: ${activity.description}`);
        console.log(`       Type: ${activity.action}`);
        console.log(`       Time: ${activity.date} ${activity.time}`);
      });

      // Check if subsection creation activity is in the list
      const subsectionActivity = response.data.data.find(a => a.action === 'subsection_created');
      if (subsectionActivity) {
        console.log('\n✅ Sub-section creation activity FOUND in recent activities!');
        return true;
      } else {
        console.log('\n⚠️ Sub-section creation activity NOT found in recent activities');
        return false;
      }
    }
  } catch (error) {
    console.error('❌ Failed to fetch recent activities:', error.response?.data?.message || error.message);
    return false;
  }
}

async function main() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('🧪 Sub-Section Activity Logging Test');
  console.log('═══════════════════════════════════════════════════════\n');

  const loggedIn = await login();
  if (!loggedIn) return;

  const created = await createSubSection();
  if (!created) return;

  // Wait a moment for the database to process
  await new Promise(resolve => setTimeout(resolve, 2000));

  const found = await checkRecentActivities();

  console.log('\n═══════════════════════════════════════════════════════');
  if (found) {
    console.log('✅ TEST PASSED: Sub-section activity logging is working!');
  } else {
    console.log('❌ TEST FAILED: Sub-section activity not logged');
  }
  console.log('═══════════════════════════════════════════════════════\n');

  process.exit(found ? 0 : 1);
}

main().catch(error => {
  console.error('Test error:', error);
  process.exit(1);
});
