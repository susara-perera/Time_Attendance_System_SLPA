// Test HRIS division filtering logic used in reportController
// Ensures division_id (from frontend) matches employees by HIE_NAME_3 or HIE_CODE_4

const employees = [
  { EMP_NUMBER: '001', FULLNAME: 'A', currentwork: { HIE_NAME_3: 'Information Systems', HIE_CODE_4: 'IS' } },
  { EMP_NUMBER: '002', FULLNAME: 'B', currentwork: { HIE_NAME_3: 'Information Systems - ( IS )', HIE_CODE_4: 'IS' } },
  { EMP_NUMBER: '003', FULLNAME: 'C', currentwork: { HIE_NAME_3: 'Finance', HIE_CODE_4: 'FIN' } },
  { EMP_NUMBER: '004', FULLNAME: 'D', currentwork: { HIE_NAME_3: 'Information Systems', HIE_CODE_4: 'ICT' } },
  { EMP_NUMBER: '005', FULLNAME: 'E', currentwork: { HIE_NAME_3: 'HR', HIE_CODE_4: 'HR' } }
];

const tests = [
  { filter: 'Information Systems', expect: 3 }, // matches names containing Information Systems
  { filter: 'IS', expect: 2 }, // matches code 'IS'
  { filter: 'ICT', expect: 1 }, // matches code 'ICT'
  { filter: 'Finance', expect: 1 },
  { filter: 'Marketing', expect: 0 }
];

const run = () => {
  tests.forEach(t => {
    const filterName = String(t.filter).trim().toLowerCase();
    const filtered = employees.filter(emp => {
      const empDivisionName = (emp.currentwork?.HIE_NAME_3 || '').trim();
      const empDivisionCode = String(emp.currentwork?.HIE_CODE_4 || '').trim();

      const divExactMatch = empDivisionName.toLowerCase() === filterName || empDivisionCode.toLowerCase() === filterName;
      const divContainsMatch = empDivisionName.toLowerCase().includes(filterName) || empDivisionCode.toLowerCase().includes(filterName) ||
                              filterName.includes(empDivisionName.toLowerCase()) || filterName.includes(empDivisionCode.toLowerCase());

      return divExactMatch || divContainsMatch;
    });

    console.log(`Filter: '${t.filter}' => Found ${filtered.length}, Expected ${t.expect}`, filtered.map(e => e.EMP_NUMBER));
  });
};

run();