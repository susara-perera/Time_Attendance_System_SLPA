/**
 * Cache Data Service
 * 
 * Provides cache-first data access with automatic fallback to MySQL
 * All methods use O(1) Redis lookups with indexed searches
 */

const { getCache } = require('../config/reportCache');
const { sequelize } = require('../config/mysql');
const { CacheIndex } = require('../models/mysql');
const mysqlDataService = require('./mysqlDataService');

class CacheDataService {
  constructor() {
    this.cache = getCache();
  }

  /**
   * Get division by code (O(1) lookup)
   */
  async getDivisionByCode(code) {
    try {
      // Try cache first
      const cacheKey = `cache:division:${code}`;
      const cached = await this.cache.get(cacheKey);
      
      if (cached) {
        return JSON.parse(cached);
      }

      // Fallback to MySQL
      console.log(`⚠️ Cache miss for division: ${code}`);
      const division = await mysqlDataService.getDivisionFromMySQL(code);
      
      // Store in cache for next time
      if (division) {
        await this.cache.set(cacheKey, JSON.stringify(division), 3600);
      }
      
      return division;

    } catch (error) {
      console.error('getDivisionByCode error:', error);
      // Fallback to MySQL on error
      return await mysqlDataService.getDivisionFromMySQL(code);
    }
  }

  /**
   * Get all divisions with optional filters
   */
  async getDivisions(filters = {}) {
    try {
      // If no filters, return cached list
      if (!filters.search && !filters.status) {
        const listKey = 'cache:divisions:list';
        const cached = await this.cache.get(listKey);
        
        if (cached) {
          const codes = JSON.parse(cached);
          const divisions = await Promise.all(
            codes.map(code => this.getDivisionByCode(code))
          );
          return divisions.filter(d => d !== null);
        }
      }

      // For filtered queries, use MySQL
      console.log('⚠️ Using MySQL for filtered division query');
      return await mysqlDataService.getDivisionsFromMySQL(filters);

    } catch (error) {
      console.error('getDivisions error:', error);
      return await mysqlDataService.getDivisionsFromMySQL(filters);
    }
  }

  /**
   * Get section by code
   */
  async getSectionByCode(code) {
    try {
      const cacheKey = `cache:section:${code}`;
      const cached = await this.cache.get(cacheKey);
      
      if (cached) {
        return JSON.parse(cached);
      }

      console.log(`⚠️ Cache miss for section: ${code}`);
      const section = await mysqlDataService.getSectionFromMySQL(code);
      
      if (section) {
        await this.cache.set(cacheKey, JSON.stringify(section), 3600);
      }
      
      return section;

    } catch (error) {
      console.error('getSectionByCode error:', error);
      return await mysqlDataService.getSectionFromMySQL(code);
    }
  }

  /**
   * Get all sections with optional filters
   */
  async getSections(filters = {}) {
    try {
      // If filtering by division, use cached relationships
      if (filters.divisionCode && !filters.search && this.cache.client) {
        const setKey = `cache:division:${filters.divisionCode}:sections`;
        const sectionCodes = await this.cache.client.smembers(setKey);
        
        if (sectionCodes && sectionCodes.length > 0) {
          const sections = await Promise.all(
            sectionCodes.map(code => this.getSectionByCode(code))
          );
          return sections.filter(s => s !== null);
        }
      }

      // No filters - return all from cache
      if (!filters.search && !filters.divisionCode && !filters.status) {
        const listKey = 'cache:sections:list';
        const cached = await this.cache.get(listKey);
        
        if (cached) {
          const codes = JSON.parse(cached);
          const sections = await Promise.all(
            codes.map(code => this.getSectionByCode(code))
          );
          return sections.filter(s => s !== null);
        }
      }

      // Fallback to MySQL for complex queries
      console.log('⚠️ Using MySQL for filtered section query');
      return await mysqlDataService.getSectionsFromMySQL(filters);

    } catch (error) {
      console.error('getSections error:', error);
      return await mysqlDataService.getSectionsFromMySQL(filters);
    }
  }

  /**
   * Get employee by ID
   */
  async getEmployeeById(empId) {
    try {
      const cacheKey = `cache:employee:${empId}`;
      const cached = await this.cache.get(cacheKey);
      
      if (cached) {
        return JSON.parse(cached);
      }

      console.log(`⚠️ Cache miss for employee: ${empId}`);
      const employee = await mysqlDataService.getEmployeeFromMySQL(empId);
      
      if (employee) {
        await this.cache.set(cacheKey, JSON.stringify(employee), 1800);
      }
      
      return employee;

    } catch (error) {
      console.error('getEmployeeById error:', error);
      return await mysqlDataService.getEmployeeFromMySQL(empId);
    }
  }

  /**
   * Get employees with filters
   */
  async getEmployees(filters = {}) {
    try {
      // If filtering by division only
      if (filters.divisionCode && !filters.search && !filters.sectionCode && this.cache.client) {
        const setKey = `cache:division:${filters.divisionCode}:employees`;
        const empIds = await this.cache.client.smembers(setKey);
        
        if (empIds && empIds.length > 0) {
          const employees = await Promise.all(
            empIds.map(id => this.getEmployeeById(id))
          );
          return employees.filter(e => e !== null);
        }
      }

      // If filtering by section only
      if (filters.sectionCode && !filters.search && !filters.divisionCode && this.cache.client) {
        const setKey = `cache:section:${filters.sectionCode}:employees`;
        const empIds = await this.cache.client.smembers(setKey);
        
        if (empIds && empIds.length > 0) {
          const employees = await Promise.all(
            empIds.map(id => this.getEmployeeById(id))
          );
          return employees.filter(e => e !== null);
        }
      }

      // No filters - return all from cache
      if (!filters.search && !filters.divisionCode && !filters.sectionCode) {
        const listKey = 'cache:employees:list';
        const cached = await this.cache.get(listKey);
        
        if (cached) {
          const ids = JSON.parse(cached);
          // For large datasets, paginate
          const page = filters.page || 1;
          const limit = filters.limit || 1000;
          const start = (page - 1) * limit;
          const end = start + limit;
          const paginatedIds = ids.slice(start, end);
          
          const employees = await Promise.all(
            paginatedIds.map(id => this.getEmployeeById(id))
          );
          return employees.filter(e => e !== null);
        }
      }

      // Complex queries fallback to MySQL
      console.log('⚠️ Using MySQL for filtered employee query');
      return await mysqlDataService.getEmployeesFromMySQL(filters);

    } catch (error) {
      console.error('getEmployees error:', error);
      return await mysqlDataService.getEmployeesFromMySQL(filters);
    }
  }

  /**
   * Search entities using index
   */
  async searchByIndex(entityType, indexKey, searchValue) {
    try {
      // Try to find in cache index
      const indexes = await CacheIndex.findAll({
        where: {
          entity_type: entityType,
          index_key: indexKey,
          index_value: {
            [sequelize.Sequelize.Op.like]: `%${searchValue}%`
          }
        },
        limit: 100
      });

      if (indexes.length > 0) {
        const results = await Promise.all(
          indexes.map(async (idx) => {
            const cached = await this.cache.get(idx.cache_key);
            return cached ? JSON.parse(cached) : null;
          })
        );
        return results.filter(r => r !== null);
      }

      return [];

    } catch (error) {
      console.error('searchByIndex error:', error);
      return [];
    }
  }

  /**
   * Get children of a parent entity using relationships
   */
  async getChildren(parentType, parentId, childType) {
    try {
      // Use Redis set for O(1) lookup
      if (this.cache.client) {
        const setKey = `cache:${parentType}:${parentId}:${childType}s`;
        const childIds = await this.cache.client.smembers(setKey);
        
        if (childIds && childIds.length > 0) {
          const getter = childType === 'division' ? this.getDivisionByCode.bind(this)
                       : childType === 'section' ? this.getSectionByCode.bind(this)
                       : this.getEmployeeById.bind(this);
          
          const children = await Promise.all(childIds.map(getter));
          return children.filter(c => c !== null);
        }
      }

      return [];

    } catch (error) {
      console.error('getChildren error:', error);
      return [];
    }
  }

  /**
   * Get division's sections
   */
  async getDivisionSections(divisionCode) {
    return await this.getChildren('division', divisionCode, 'section');
  }

  /**
   * Get division's employees
   */
  async getDivisionEmployees(divisionCode) {
    return await this.getChildren('division', divisionCode, 'employee');
  }

  /**
   * Get section's employees
   */
  async getSectionEmployees(sectionCode) {
    return await this.getChildren('section', sectionCode, 'employee');
  }

  /**
   * Batch get entities
   */
  async batchGet(entityType, ids) {
    try {
      const getter = entityType === 'division' ? this.getDivisionByCode.bind(this)
                   : entityType === 'section' ? this.getSectionByCode.bind(this)
                   : this.getEmployeeById.bind(this);

      const results = await Promise.all(ids.map(getter));
      return results.filter(r => r !== null);

    } catch (error) {
      console.error('batchGet error:', error);
      return [];
    }
  }

  /**
   * Check cache health
   */
  async checkHealth() {
    try {
      const divisionsExist = await this.cache.get('cache:divisions:list');
      const sectionsExist = await this.cache.get('cache:sections:list');
      const employeesExist = await this.cache.get('cache:employees:list');

      return {
        healthy: !!(divisionsExist && sectionsExist && employeesExist),
        divisions_cached: !!divisionsExist,
        sections_cached: !!sectionsExist,
        employees_cached: !!employeesExist,
        redis_connected: this.cache.isConnected
      };

    } catch (error) {
      return {
        healthy: false,
        error: error.message
      };
    }
  }
}

module.exports = new CacheDataService();
