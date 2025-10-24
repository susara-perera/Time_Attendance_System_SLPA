// Mapping of COM codes to human-readable event descriptions
const comMap = {
  'COM0001': 'Regular Shift Start',
  'COM0002': 'Granted(ID & F tally plan)',
  'COM0003': 'Overtime',
  'COM0004': 'Shift Swap',
  'COM0005': 'Leave',
  // add more mappings as needed
};

// Replace occurrences of COM codes in a string with their mapped descriptions
export function replaceComCodes(text) {
  if (!text && text !== 0) return '';
  let str = String(text);
  Object.keys(comMap).forEach(code => {
    const rx = new RegExp(code, 'g');
    str = str.replace(rx, comMap[code]);
  });
  return str;
}

export default comMap;
