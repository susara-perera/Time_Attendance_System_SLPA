/**
 * Filter Validation and Normalization
 * 
 * Provides consistent filter handling across all audit reports
 * 
 * Created: January 11, 2026
 * Purpose: Standardize division/section/sub-section filter validation
 */

// ============================================================================
// FILTER NORMALIZATION
// ============================================================================

/**
 * Normalize a filter ID value
 * Converts null, undefined, empty string, or 'all' to null
 * 
 * @param {string|null} id - Filter ID value
 * @returns {string|null} - Normalized ID or null if empty
 */
function normalizeId(id) {
  if (!id) return null;
  
  const trimmed = String(id).trim().toLowerCase();
  
  // Convert common "empty" values to null
  if (trimmed === '' || trimmed === 'all' || trimmed === 'none' || trimmed === 'undefined') {
    return null;
  }
  
  return String(id).trim();
}

/**
 * Validate filter structure
 * 
 * @param {object} filters - Filter object
 * @returns {object} - Validated and normalized filters
 * 
 * @example
 * validateFilters({
 *   division_id: 'DIV001',
 *   section_id: 'all',
 *   sub_section_id: ''
 * });
 * // Returns: { division_id: 'DIV001', section_id: null, sub_section_id: null }
 */
function validateFilters(filters) {
  return {
    division_id: normalizeId(filters.division_id),
    section_id: normalizeId(filters.section_id),
    sub_section_id: normalizeId(filters.sub_section_id),
    from_date: filters.from_date,
    to_date: filters.to_date
  };
}

/**
 * Build WHERE clause fragment for filters
 * 
 * @param {object} filters - Normalized filters
 * @param {object} options - Configuration
 * @returns {object} - { whereClause: string, params: array }
 * 
 * @example
 * buildWhereClauseForFilters(
 *   { division_id: 'DIV001', section_id: null },
 *   { tableAlias: 'e', fieldMappings: {...} }
 * );
 * // Returns: {
 * //   whereClause: 'AND e.division_id = ?',
 * //   params: ['DIV001']
 * // }
 */
function buildWhereClauseForFilters(filters, options = {}) {
  const {
    tableAlias = 'e',
    fieldMappings = {
      division: 'division_id',
      section: 'section_id',
      subSection: 'sub_section_id'
    }
  } = options;
  
  const clauses = [];
  const params = [];
  
  // Add division filter if provided
  if (filters.division_id) {
    clauses.push(`${tableAlias}.${fieldMappings.division} = ?`);
    params.push(filters.division_id);
  }
  
  // Add section filter if provided
  if (filters.section_id) {
    clauses.push(`${tableAlias}.${fieldMappings.section} = ?`);
    params.push(filters.section_id);
  }
  
  // Add sub-section filter if provided
  if (filters.sub_section_id) {
    clauses.push(`${tableAlias}.${fieldMappings.subSection} = ?`);
    params.push(filters.sub_section_id);
  }
  
  return {
    whereClause: clauses.length > 0 ? `AND ${clauses.join(' AND ')}` : '',
    params
  };
}

/**
 * Check if any filters are applied
 * 
 * @param {object} filters - Filter object
 * @returns {boolean} - True if any meaningful filter is applied
 */
function hasFilters(filters) {
  return !!(
    filters.division_id || 
    filters.section_id || 
    filters.sub_section_id
  );
}

/**
 * Get a human-readable filter description
 * 
 * @param {object} filters - Filter object
 * @returns {string} - Description of applied filters
 * 
 * @example
 * getFilterDescription({ division_id: 'IT', section_id: null });
 * // Returns: "Division: IT"
 */
function getFilterDescription(filters) {
  const parts = [];
  
  if (filters.division_id) {
    parts.push(`Division: ${filters.division_id}`);
  }
  if (filters.section_id) {
    parts.push(`Section: ${filters.section_id}`);
  }
  if (filters.sub_section_id) {
    parts.push(`Sub-Section: ${filters.sub_section_id}`);
  }
  
  return parts.length > 0 ? parts.join(' | ') : 'No filters applied';
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  normalizeId,
  validateFilters,
  buildWhereClauseForFilters,
  hasFilters,
  getFilterDescription
};
