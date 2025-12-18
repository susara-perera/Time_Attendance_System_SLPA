// Test division filter logic
const testFilter = (employees, division_id) => {
  console.log('\n=== Testing Division Filter ===');
  console.log('Division filter:', division_id);
  console.log('Total employees before filter:', employees.length);
  
  let filtered = employees.filter(emp => {
    const empDivisionName = (emp.currentwork?.HIE_NAME_3 || '').trim();
    const filterName = String(division_id).trim();
    
    const divExactMatch = empDivisionName.toLowerCase() === filterName.toLowerCase();
    const divContainsMatch = empDivisionName.toLowerCase().includes(filterName.toLowerCase()) || 
                            filterName.toLowerCase().includes(empDivisionName.toLowerCase());
    
    const matches = divExactMatch || divContainsMatch;
    if (matches) {
      console.log('  ✓ Match:', emp.EMP_NUMBER, emp.FULLNAME, '- Division:', empDivisionName);
    }
    return matches;
  });
  
  console.log('Employees after filter:', filtered.length);
  return filtered;
};

// Mock employee data
const mockEmployees = [
  { EMP_NUMBER: '001', FULLNAME: 'John Doe', currentwork: { HIE_NAME_3: 'Information Systems' } },
  { EMP_NUMBER: '002', FULLNAME: 'Jane Smith', currentwork: { HIE_NAME_3: 'Information Systems' } },
  { EMP_NUMBER: '003', FULLNAME: 'Bob Johnson', currentwork: { HIE_NAME_3: 'Finance' } },
  { EMP_NUMBER: '004', FULLNAME: 'Alice Brown', currentwork: { HIE_NAME_3: 'HR' } },
  { EMP_NUMBER: '005', FULLNAME: 'Charlie Wilson', currentwork: { HIE_NAME_3: 'Information Systems' } }
];

// Test case 1: Filter by 'Information Systems'
console.log('\n📊 TEST CASE 1: Information Systems Division');
const result1 = testFilter(mockEmployees, 'Information Systems');
console.log('Expected: 3 employees');
console.log('Got:', result1.length);
console.log(result1.length === 3 ? '✅ Test PASSED' : '❌ Test FAILED');

// Test case 2: Filter by 'Finance'
console.log('\n📊 TEST CASE 2: Finance Division');
const result2 = testFilter(mockEmployees, 'Finance');
console.log('Expected: 1 employee');
console.log('Got:', result2.length);
console.log(result2.length === 1 ? '✅ Test PASSED' : '❌ Test FAILED');

// Test case 3: Filter by 'HR'
console.log('\n📊 TEST CASE 3: HR Division');
const result3 = testFilter(mockEmployees, 'HR');
console.log('Expected: 1 employee');
console.log('Got:', result3.length);
console.log(result3.length === 1 ? '✅ Test PASSED' : '❌ Test FAILED');

// Test case 4: No matches
console.log('\n📊 TEST CASE 4: Non-existent Division');
const result4 = testFilter(mockEmployees, 'Marketing');
console.log('Expected: 0 employees');
console.log('Got:', result4.length);
console.log(result4.length === 0 ? '✅ Test PASSED' : '❌ Test FAILED');

console.log('\n' + '='.repeat(50));
console.log('ALL TESTS COMPLETED');
console.log('='.repeat(50));