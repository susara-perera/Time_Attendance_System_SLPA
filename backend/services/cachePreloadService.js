/**
 * Cache Preload Service
 * 
 * Loads entire database into Redis cache with intelligent indexing
 * Provides O(1) lookups for all common operations
 */

const { getCache } = require('../config/reportCache');
const { sequelize } = require('../config/mysql');
const { CacheMetadata, CacheIndex, CacheRelationship, CacheSyncLog } = require('../models/mysql');

class CachePreloadService {
  constructor() {
    this.cache = getCache();
    this.stats = {
      divisions: { count: 0, indexed: 0 },
      sections: { count: 0, indexed: 0 },
      employees: { count: 0, indexed: 0 },
      relationships: { count: 0 },
      totalTime: 0
    };
  }

  /**
   * Full cache preload - loads all entities with indexes
   */
  async preloadAll(triggeredBy = 'system') {
    const startTime = Date.now();
    const syncLog = {
      sync_type: 'full_preload',
      entity_types: 'divisions,sections,employees',
      records_synced: 0,
      indexes_built: 0,
      started_at: new Date(),
      triggered_by: triggeredBy,
      status: 'in_progress'
    };

    try {
      console.log('🚀 Starting full cache preload...');

      // Ensure Redis is connected
      if (!this.cache.isConnected) {
        await this.cache.connect();
      }

      // Step 1: Load divisions
      console.log('📊 Preloading divisions...');
      const divisionsResult = await this.preloadDivisions();
      this.stats.divisions = divisionsResult;

      // Step 2: Load sections
      console.log('📊 Preloading sections...');
      const sectionsResult = await this.preloadSections();
      this.stats.sections = sectionsResult;

      // Step 3: Load employees
      console.log('📊 Preloading employees...');
      const employeesResult = await this.preloadEmployees();
      this.stats.employees = employeesResult;

      // Step 4: Build relationships
      console.log('🔗 Building relationships...');
      const relationshipsResult = await this.buildRelationships();
      this.stats.relationships = relationshipsResult;

      // Calculate totals
      const totalRecords = divisionsResult.count + sectionsResult.count + employeesResult.count;
      const totalIndexes = divisionsResult.indexed + sectionsResult.indexed + employeesResult.indexed;
      
      this.stats.totalTime = Date.now() - startTime;

      // Update sync log
      syncLog.records_synced = totalRecords;
      syncLog.indexes_built = totalIndexes;
      syncLog.duration_ms = this.stats.totalTime;
      syncLog.completed_at = new Date();
      syncLog.status = 'completed';

      await CacheSyncLog.create(syncLog);

      console.log('✅ Cache preload completed:', {
        records: totalRecords,
        indexes: totalIndexes,
        relationships: relationshipsResult.count,
        duration: `${this.stats.totalTime}ms`
      });

      return {
        success: true,
        stats: this.stats,
        message: 'Cache preload completed successfully'
      };

    } catch (error) {
      console.error('❌ Cache preload failed:', error);
      
      syncLog.status = 'failed';
      syncLog.error_message = error.message;
      syncLog.completed_at = new Date();
      syncLog.duration_ms = Date.now() - startTime;
      
      await CacheSyncLog.create(syncLog);

      throw error;
    }
  }

  /**
   * Preload all divisions with indexes
   */
  async preloadDivisions() {
    try {
      // Fetch all divisions from MySQL
      const [divisions] = await sequelize.query(
        `SELECT * FROM divisions_sync WHERE STATUS = 'ACTIVE' ORDER BY HIE_NAME ASC`,
        { raw: true }
      );

      if (!divisions || divisions.length === 0) {
        console.log('⚠️ No divisions found to preload');
        return { count: 0, indexed: 0 };
      }

      console.log(`📦 Loading ${divisions.length} divisions...`);

      // Use Redis pipeline for batch operations
      const pipeline = this.cache.client.pipeline();
      const indexes = [];

      for (const div of divisions) {
        const divisionData = {
          _id: `mysql_div_${div.HIE_CODE}`,
          HIE_CODE: div.HIE_CODE,
          HIE_NAME: div.HIE_NAME,
          HIE_NAME_SINHALA: div.HIE_NAME_SINHALA,
          HIE_NAME_TAMIL: div.HIE_NAME_TAMIL,
          HIE_RELATIONSHIP: div.HIE_RELATIONSHIP,
          DEF_LEVEL: div.DEF_LEVEL,
          STATUS: div.STATUS,
          DESCRIPTION: div.DESCRIPTION,
          code: div.HIE_CODE,
          name: div.HIE_NAME,
          synced_at: div.synced_at,
          source: 'MySQL'
        };

        // Store in Redis with TTL (1 hour)
        const cacheKey = `cache:division:${div.HIE_CODE}`;
        pipeline.setex(cacheKey, 3600, JSON.stringify(divisionData));

        // Build indexes
        indexes.push({
          entity_type: 'division',
          entity_id: div.HIE_CODE,
          index_key: 'code',
          index_value: div.HIE_CODE,
          cache_key: cacheKey
        });

        indexes.push({
          entity_type: 'division',
          entity_id: div.HIE_CODE,
          index_key: 'name',
          index_value: div.HIE_NAME,
          cache_key: cacheKey
        });

        // Add to sorted set for listing
        pipeline.zadd('cache:divisions:all', 0, div.HIE_CODE);
      }

      // Execute Redis pipeline
      await pipeline.exec();

      // Store all divisions list
      await this.cache.set(
        'cache:divisions:list',
        JSON.stringify(divisions.map(d => d.HIE_CODE)),
        3600
      );

      // Bulk insert indexes to MySQL (for metadata tracking)
      if (indexes.length > 0) {
        await CacheIndex.bulkCreate(indexes, {
          updateOnDuplicate: ['index_value', 'cache_key', 'updated_at']
        });
      }

      // Update metadata
      await CacheMetadata.upsert({
        cache_key: 'cache:divisions:all',
        entity_type: 'division',
        record_count: divisions.length,
        data_size_bytes: JSON.stringify(divisions).length,
        last_sync_at: new Date(),
        expires_at: new Date(Date.now() + 3600000), // 1 hour
        is_valid: true
      });

      console.log(`✅ Loaded ${divisions.length} divisions with ${indexes.length} indexes`);
      return { count: divisions.length, indexed: indexes.length };

    } catch (error) {
      console.error('❌ Division preload error:', error);
      throw error;
    }
  }

  /**
   * Preload all sections with indexes
   */
  async preloadSections() {
    try {
      const [sections] = await sequelize.query(
        `SELECT * FROM sections_sync WHERE STATUS = 'ACTIVE' ORDER BY HIE_NAME ASC`,
        { raw: true }
      );

      if (!sections || sections.length === 0) {
        console.log('⚠️ No sections found to preload');
        return { count: 0, indexed: 0 };
      }

      console.log(`📦 Loading ${sections.length} sections...`);

      const pipeline = this.cache.client.pipeline();
      const indexes = [];

      for (const sec of sections) {
        const sectionData = {
          _id: `mysql_sec_${sec.HIE_CODE}`,
          HIE_CODE: sec.HIE_CODE,
          HIE_NAME: sec.HIE_NAME,
          HIE_NAME_SINHALA: sec.HIE_NAME_SINHALA,
          HIE_NAME_TAMIL: sec.HIE_NAME_TAMIL,
          HIE_RELATIONSHIP: sec.HIE_RELATIONSHIP,
          DEF_LEVEL: sec.DEF_LEVEL,
          STATUS: sec.STATUS,
          DESCRIPTION: sec.DESCRIPTION,
          code: sec.HIE_CODE,
          name: sec.HIE_NAME,
          division_code: sec.HIE_RELATIONSHIP,
          synced_at: sec.synced_at,
          source: 'MySQL'
        };

        const cacheKey = `cache:section:${sec.HIE_CODE}`;
        pipeline.setex(cacheKey, 3600, JSON.stringify(sectionData));

        // Indexes
        indexes.push({
          entity_type: 'section',
          entity_id: sec.HIE_CODE,
          index_key: 'code',
          index_value: sec.HIE_CODE,
          cache_key: cacheKey
        });

        indexes.push({
          entity_type: 'section',
          entity_id: sec.HIE_CODE,
          index_key: 'name',
          index_value: sec.HIE_NAME,
          cache_key: cacheKey
        });

        indexes.push({
          entity_type: 'section',
          entity_id: sec.HIE_CODE,
          index_key: 'division_code',
          index_value: sec.HIE_RELATIONSHIP,
          cache_key: cacheKey
        });

        // Add to sorted set
        pipeline.zadd('cache:sections:all', 0, sec.HIE_CODE);
        
        // Add to division's sections set
        pipeline.sadd(`cache:division:${sec.HIE_RELATIONSHIP}:sections`, sec.HIE_CODE);
      }

      await pipeline.exec();

      await this.cache.set(
        'cache:sections:list',
        JSON.stringify(sections.map(s => s.HIE_CODE)),
        3600
      );

      if (indexes.length > 0) {
        await CacheIndex.bulkCreate(indexes, {
          updateOnDuplicate: ['index_value', 'cache_key', 'updated_at']
        });
      }

      await CacheMetadata.upsert({
        cache_key: 'cache:sections:all',
        entity_type: 'section',
        record_count: sections.length,
        data_size_bytes: JSON.stringify(sections).length,
        last_sync_at: new Date(),
        expires_at: new Date(Date.now() + 3600000),
        is_valid: true
      });

      console.log(`✅ Loaded ${sections.length} sections with ${indexes.length} indexes`);
      return { count: sections.length, indexed: indexes.length };

    } catch (error) {
      console.error('❌ Section preload error:', error);
      throw error;
    }
  }

  /**
   * Preload all employees with indexes
   */
  async preloadEmployees() {
    try {
      const [employees] = await sequelize.query(
        `SELECT * FROM employees_sync ORDER BY EMP_NAME ASC`,
        { raw: true }
      );

      if (!employees || employees.length === 0) {
        console.log('⚠️ No employees found to preload');
        return { count: 0, indexed: 0 };
      }

      console.log(`📦 Loading ${employees.length} employees...`);

      const pipeline = this.cache.client.pipeline();
      const indexes = [];

      for (const emp of employees) {
        const employeeData = {
          _id: `mysql_emp_${emp.EMP_ID}`,
          EMP_ID: emp.EMP_ID,
          EMP_NAME: emp.EMP_NAME,
          EMP_TITLE: emp.EMP_TITLE,
          EMP_TYPE: emp.EMP_TYPE,
          SECTION_ID: emp.SECTION_ID,
          SECTION_NAME: emp.SECTION_NAME,
          DIVISION_ID: emp.DIVISION_ID,
          DIVISION_NAME: emp.DIVISION_NAME,
          LOCATION: emp.LOCATION,
          STATUS: emp.STATUS,
          EMAIL: emp.EMAIL,
          PHONE: emp.PHONE,
          code: emp.EMP_ID,
          name: emp.EMP_NAME,
          synced_at: emp.synced_at,
          source: 'MySQL'
        };

        const cacheKey = `cache:employee:${emp.EMP_ID}`;
        pipeline.setex(cacheKey, 1800, JSON.stringify(employeeData)); // 30 min TTL

        // Multiple indexes for employees
        indexes.push(
          {
            entity_type: 'employee',
            entity_id: emp.EMP_ID,
            index_key: 'id',
            index_value: emp.EMP_ID,
            cache_key: cacheKey
          },
          {
            entity_type: 'employee',
            entity_id: emp.EMP_ID,
            index_key: 'name',
            index_value: emp.EMP_NAME,
            cache_key: cacheKey
          },
          {
            entity_type: 'employee',
            entity_id: emp.EMP_ID,
            index_key: 'division_id',
            index_value: emp.DIVISION_ID,
            cache_key: cacheKey
          },
          {
            entity_type: 'employee',
            entity_id: emp.EMP_ID,
            index_key: 'section_id',
            index_value: emp.SECTION_ID,
            cache_key: cacheKey
          }
        );

        if (emp.EMAIL) {
          indexes.push({
            entity_type: 'employee',
            entity_id: emp.EMP_ID,
            index_key: 'email',
            index_value: emp.EMAIL,
            cache_key: cacheKey
          });
        }

        // Add to sets for relationships
        pipeline.zadd('cache:employees:all', 0, emp.EMP_ID);
        if (emp.DIVISION_ID) {
          pipeline.sadd(`cache:division:${emp.DIVISION_ID}:employees`, emp.EMP_ID);
        }
        if (emp.SECTION_ID) {
          pipeline.sadd(`cache:section:${emp.SECTION_ID}:employees`, emp.EMP_ID);
        }
      }

      await pipeline.exec();

      await this.cache.set(
        'cache:employees:list',
        JSON.stringify(employees.map(e => e.EMP_ID)),
        1800
      );

      if (indexes.length > 0) {
        await CacheIndex.bulkCreate(indexes, {
          updateOnDuplicate: ['index_value', 'cache_key', 'updated_at']
        });
      }

      await CacheMetadata.upsert({
        cache_key: 'cache:employees:all',
        entity_type: 'employee',
        record_count: employees.length,
        data_size_bytes: JSON.stringify(employees).length,
        last_sync_at: new Date(),
        expires_at: new Date(Date.now() + 1800000), // 30 min
        is_valid: true
      });

      console.log(`✅ Loaded ${employees.length} employees with ${indexes.length} indexes`);
      return { count: employees.length, indexed: indexes.length };

    } catch (error) {
      console.error('❌ Employee preload error:', error);
      throw error;
    }
  }

  /**
   * Build relationships between entities
   */
  async buildRelationships() {
    try {
      console.log('🔗 Building entity relationships...');

      const relationships = [];

      // Build division -> sections relationships
      const [divisionSections] = await sequelize.query(
        `SELECT DISTINCT HIE_RELATIONSHIP as division_code, HIE_CODE as section_code 
         FROM sections_sync 
         WHERE STATUS = 'ACTIVE' AND HIE_RELATIONSHIP IS NOT NULL`,
        { raw: true }
      );

      for (const rel of divisionSections) {
        relationships.push({
          parent_type: 'division',
          parent_id: rel.division_code,
          child_type: 'section',
          child_id: rel.section_code,
          relationship_type: 'has_section'
        });
      }

      // Build division -> employees relationships
      const [divisionEmployees] = await sequelize.query(
        `SELECT DISTINCT DIVISION_ID as division_code, EMP_ID as employee_id 
         FROM employees_sync 
         WHERE DIVISION_ID IS NOT NULL`,
        { raw: true }
      );

      for (const rel of divisionEmployees) {
        relationships.push({
          parent_type: 'division',
          parent_id: rel.division_code,
          child_type: 'employee',
          child_id: rel.employee_id,
          relationship_type: 'has_employee'
        });
      }

      // Build section -> employees relationships
      const [sectionEmployees] = await sequelize.query(
        `SELECT DISTINCT SECTION_ID as section_code, EMP_ID as employee_id 
         FROM employees_sync 
         WHERE SECTION_ID IS NOT NULL`,
        { raw: true }
      );

      for (const rel of sectionEmployees) {
        relationships.push({
          parent_type: 'section',
          parent_id: rel.section_code,
          child_type: 'employee',
          child_id: rel.employee_id,
          relationship_type: 'has_employee'
        });
      }

      // Bulk insert relationships
      if (relationships.length > 0) {
        await CacheRelationship.bulkCreate(relationships, {
          updateOnDuplicate: ['updated_at']
        });
      }

      console.log(`✅ Built ${relationships.length} relationships`);
      return { count: relationships.length };

    } catch (error) {
      console.error('❌ Relationship building error:', error);
      throw error;
    }
  }

  /**
   * Check if cache is warm and valid
   */
  async isCacheWarm() {
    try {
      const metadata = await CacheMetadata.findAll({
        where: {
          entity_type: ['division', 'section', 'employee'],
          is_valid: true
        }
      });

      if (metadata.length < 3) return false;

      // Check if any cache has expired
      const now = new Date();
      for (const meta of metadata) {
        if (meta.expires_at < now) {
          return false;
        }
      }

      return true;

    } catch (error) {
      console.error('Cache warm check error:', error);
      return false;
    }
  }

  /**
   * Invalidate all cache
   */
  async invalidateAll() {
    try {
      console.log('🗑️ Invalidating all cache...');

      // Mark all cache as invalid
      await CacheMetadata.update(
        { is_valid: false, version: sequelize.literal('version + 1') },
        { where: {} }
      );

      // Clear Redis cache
      const keys = await this.cache.client.keys('cache:*');
      if (keys.length > 0) {
        await this.cache.client.del(...keys);
      }

      // Clear indexes
      await CacheIndex.destroy({ where: {} });
      await CacheRelationship.destroy({ where: {} });

      console.log('✅ Cache invalidated successfully');

    } catch (error) {
      console.error('Cache invalidation error:', error);
      throw error;
    }
  }

  /**
   * Get cache statistics
   */
  async getStats() {
    try {
      const metadata = await CacheMetadata.findAll({
        where: { is_valid: true }
      });

      const indexCount = await CacheIndex.count();
      const relationshipCount = await CacheRelationship.count();

      const recentSyncs = await CacheSyncLog.findAll({
        limit: 10,
        order: [['started_at', 'DESC']]
      });

      return {
        cache_entries: metadata.length,
        total_records: metadata.reduce((sum, m) => sum + m.record_count, 0),
        total_size_bytes: metadata.reduce((sum, m) => sum + m.data_size_bytes, 0),
        index_count: indexCount,
        relationship_count: relationshipCount,
        recent_syncs: recentSyncs,
        cache_hit_ratio: this.cache.stats.hits / (this.cache.stats.hits + this.cache.stats.misses) || 0
      };

    } catch (error) {
      console.error('Get stats error:', error);
      throw error;
    }
  }
}

module.exports = new CachePreloadService();
