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
    this.jobs = new Map();
    this.activeJobId = null;
    this.stats = {
      divisions: { count: 0, indexed: 0 },
      sections: { count: 0, indexed: 0 },
      employees: { count: 0, indexed: 0 },
      relationships: { count: 0 },
      totalTime: 0
    };
  }

  // Helper to perform bulk create in batches to avoid exceeding max_allowed_packet
  async _bulkCreateInBatches(model, rows, options = {}, batchSize = 200, byteLimit = 512 * 1024) {
    if (!rows || rows.length === 0) return;

    let batch = [];
    let batchBytes = 0;

    const flushBatch = async () => {
      if (batch.length === 0) return;
      console.log(`📤 Inserting batch of ${batch.length} rows (~${batchBytes} bytes) into ${model.name}`);
      try {
        await model.bulkCreate(batch, options);
        console.log(`✅ Inserted batch of ${batch.length} rows into ${model.name}`);
      } catch (err) {
        console.error(`Bulk insert batch error for ${model.name}:`, err && (err.message || err.stack) ? (err.message || err.stack) : err);
        // Fallback: insert rows one-by-one to isolate problematic rows
        for (const row of batch) {
          try {
            await model.create(row);
          } catch (e) {
            console.warn(`Failed to insert single row into ${model.name}:`, e && (e.message || e.stack) ? (e.message || e.stack) : e);
          }
        }
      } finally {
        batch = [];
        batchBytes = 0;
      }
    };

    for (const row of rows) {
      const rowSize = JSON.stringify(row).length;
      // If single row exceed limit, try to insert it individually
      if (rowSize > byteLimit) {
        // Flush current batch first
        await flushBatch();
        try {
          await model.create(row);
        } catch (e) {
          console.warn(`Failed to insert oversized single row into ${model.name}:`, e && e.message ? e.message : e);
        }
        continue;
      }

      // If adding row would exceed limits, flush existing batch
      if (batch.length >= batchSize || (batchBytes + rowSize) > byteLimit) {
        await flushBatch();
      }

      batch.push(row);
      batchBytes += rowSize;
    }

    // flush remaining
    await flushBatch();
  }

  _newJobId() {
    return `preload_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  }

  _createJob({ triggeredBy, steps }) {
    const id = this._newJobId();
    const job = {
      id,
      status: 'running',
      triggeredBy,
      startedAt: new Date().toISOString(),
      completedAt: null,
      stepIndex: 0,
      steps,
      currentStep: steps[0] || null,
      percent: 0,
      message: 'Starting cache activation...',
      // New fields for more accurate progress tracking
      totalWork: 0,           // total number of records across all steps
      stepTotals: [],         // per-step totals (aligned with steps[])
      stepProgress: [],       // per-step processed counts (updated live)
      cumulativeCompleted: 0, // number of records completed so far
      attendance: null        // attendance progress object when present
    };
    this.jobs.set(id, job);
    this.activeJobId = id;
    return job;
  }

  _updateJob(id, patch) {
    const job = this.jobs.get(id);
    if (!job) return;
    Object.assign(job, patch);
  }

  _setJobStep(id, stepIndex, message) {
    const job = this.jobs.get(id);
    if (!job) return;
    const total = job.steps.length || 1;
    const idx = Math.max(0, Math.min(stepIndex, total - 1));
    job.stepIndex = idx;
    job.currentStep = job.steps[idx] || null;
    job.percent = Math.round((idx / total) * 100);
    job.message = message || job.message;
  }

  _finishJob(id, message) {
    const job = this.jobs.get(id);
    if (!job) return;
    job.status = 'completed';
    job.percent = 100;
    job.completedAt = new Date().toISOString();
    job.message = message || 'Cache activation completed.';
    if (this.activeJobId === id) this.activeJobId = null;
  }

  _failJob(id, error) {
    const job = this.jobs.get(id);
    if (!job) return;
    job.status = 'failed';
    job.completedAt = new Date().toISOString();
    job.message = 'Cache activation failed.';
    job.error = error ? String(error.message || error) : 'Unknown error';
    if (this.activeJobId === id) this.activeJobId = null;
  }

  getPreloadJob(jobId) {
    return this.jobs.get(jobId) || null;
  }

  /**
   * Starts a full-system preload job (divisions/sections/subsections/employees/full attendance).
   * Returns a job descriptor immediately; work runs in background.
   */
  startFullSystemPreloadJob(triggeredBy = 'system') {
    // If a job is already running, reuse it to avoid multiple heavy preloads.
    if (this.activeJobId) {
      const active = this.jobs.get(this.activeJobId);
      if (active && active.status === 'running') {
        console.log(`♻️  Reusing existing cache activation job ${this.activeJobId} for ${triggeredBy}`);
        return { job: active, isNew: false };
      }
    }

    const steps = [
      'Divisions',
      'Sections',
      'Sub-Sections',
      'Employees',
      'Attendance'
    ];

    const job = this._createJob({ triggeredBy, steps });

    (async () => {
      try {
        // Before starting, compute totals for all relevant tables so we can show accurate percentages
        // NOTE: Only count attendance from 2026-01-10 to today for caching (as per user requirement)
        // NOTE: sub_sections_sync table may not exist, so we handle it gracefully
        let countsRows;
        try {
          [countsRows] = await sequelize.query(
            `SELECT 
              (SELECT COUNT(1) FROM divisions_sync WHERE STATUS = 'ACTIVE') AS divisionsCount,
              (SELECT COUNT(1) FROM sections_sync WHERE STATUS = 'ACTIVE') AS sectionsCount,
              (SELECT COUNT(1) FROM employees_sync WHERE STATUS = 'ACTIVE') AS employeesCount,
              (SELECT COUNT(1) FROM attendance WHERE date_ >= '2026-01-10' AND date_ <= CURDATE()) AS attendanceCount
            `,
            { raw: true }
          );
        } catch (queryErr) {
          console.warn('⚠️ Error querying sync tables, using fallback counts:', queryErr.message);
          countsRows = [{ divisionsCount: 0, sectionsCount: 0, employeesCount: 0, attendanceCount: 0 }];
        }
        
        // Try to get sub_sections count separately (table may not exist)
        let subSectionsCount = 0;
        try {
          const [subCountRows] = await sequelize.query(
            `SELECT COUNT(1) AS subSectionsCount FROM sub_sections`,
            { raw: true }
          );
          subSectionsCount = Number(subCountRows?.[0]?.subSectionsCount || 0);
        } catch (subErr) {
          console.warn('⚠️ sub_sections table not found, skipping sub-sections count');
          subSectionsCount = 0;
        }

        const counts = Array.isArray(countsRows) ? countsRows[0] : countsRows;
        const divisionsCount = Number(counts?.divisionsCount || 0);
        const sectionsCount = Number(counts?.sectionsCount || 0);
        const employeesCount = Number(counts?.employeesCount || 0);
        const attendanceCount = Number(counts?.attendanceCount || 0);

        const totalWork = divisionsCount + sectionsCount + subSectionsCount + employeesCount + attendanceCount;

        console.log(`📊 Total records to cache: ${totalWork} (Divisions: ${divisionsCount}, Sections: ${sectionsCount}, Sub-Sections: ${subSectionsCount}, Employees: ${employeesCount}, Attendance (2026-01-10 to today): ${attendanceCount})`);

        // Save totals into job for the UI to consume and initialize per-step progress
        this._updateJob(job.id, {
          totalWork,
          stepTotals: [divisionsCount, sectionsCount, subSectionsCount, employeesCount, attendanceCount],
          stepProgress: Array(5).fill(0),
          stepLabels: ['Divisions', 'Sections', 'Sub-Sections', 'Employees', 'Attendance']
        });

        // Ensure Redis is connected
        this._setJobStep(job.id, 0, 'Caching divisions...');
        if (!this.cache.isConnected) {
          await this.cache.connect();
        }

        // Step 1: Divisions (provide onProgress callback for live updates)
        const baseDivCompleted = this.jobs.get(job.id).cumulativeCompleted || 0;
        const divResult = await this.preloadDivisions((progress) => {
          const current = this.jobs.get(job.id);
          if (!current || current.status !== 'running') return;
          current.stepProgress[0] = progress.processed || 0;
          current.message = progress.message || current.message;
          current.percent = totalWork ? Math.round(((baseDivCompleted + (progress.processed || 0)) / totalWork) * 100) : current.percent;
        });

        // update cumulative and percent after step finished
        const jobAfterDiv = this.jobs.get(job.id);
        jobAfterDiv.stepProgress[0] = Number(divResult.count || 0);
        jobAfterDiv.cumulativeCompleted += Number(divResult.count || 0);
        jobAfterDiv.percent = totalWork ? Math.round((jobAfterDiv.cumulativeCompleted / totalWork) * 100) : jobAfterDiv.percent;

        // Step 2: Sections (with live progress)
        this._setJobStep(job.id, 1, 'Caching sections...');
        const baseSecCompleted = this.jobs.get(job.id).cumulativeCompleted || 0;
        const secResult = await this.preloadSections((progress) => {
          const current = this.jobs.get(job.id);
          if (!current || current.status !== 'running') return;
          current.stepProgress[1] = progress.processed || 0;
          current.message = progress.message || current.message;
          current.percent = totalWork ? Math.round(((baseSecCompleted + (progress.processed || 0)) / totalWork) * 100) : current.percent;
        });
        const jobAfterSec = this.jobs.get(job.id);
        jobAfterSec.stepProgress[1] = Number(secResult.count || 0);
        jobAfterSec.cumulativeCompleted += Number(secResult.count || 0);
        jobAfterSec.percent = totalWork ? Math.round((jobAfterSec.cumulativeCompleted / totalWork) * 100) : jobAfterSec.percent;

        // Step 3: Sub-Sections (with live progress)
        this._setJobStep(job.id, 2, 'Caching sub-sections...');
        const baseSubSecCompleted = this.jobs.get(job.id).cumulativeCompleted || 0;
        const subSecResult = await this.preloadSubSections((progress) => {
          const current = this.jobs.get(job.id);
          if (!current || current.status !== 'running') return;
          current.stepProgress[2] = progress.processed || 0;
          current.message = progress.message || current.message;
          current.percent = totalWork ? Math.round(((baseSubSecCompleted + (progress.processed || 0)) / totalWork) * 100) : current.percent;
        });
        const jobAfterSubSec = this.jobs.get(job.id);
        jobAfterSubSec.stepProgress[2] = Number(subSecResult.count || 0);
        jobAfterSubSec.cumulativeCompleted += Number(subSecResult.count || 0);
        jobAfterSubSec.percent = totalWork ? Math.round((jobAfterSubSec.cumulativeCompleted / totalWork) * 100) : jobAfterSubSec.percent;

        // Step 4: Employees (with live progress)
        this._setJobStep(job.id, 3, 'Caching employees...');
        const baseEmpCompleted = this.jobs.get(job.id).cumulativeCompleted || 0;
        const empResult = await this.preloadEmployees((progress) => {
          const current = this.jobs.get(job.id);
          if (!current || current.status !== 'running') return;
          current.stepProgress[3] = progress.processed || 0;
          current.message = progress.message || current.message;
          current.percent = totalWork ? Math.round(((baseEmpCompleted + (progress.processed || 0)) / totalWork) * 100) : current.percent;
        });
        const jobAfterEmp = this.jobs.get(job.id);
        jobAfterEmp.stepProgress[3] = Number(empResult.count || 0);
        jobAfterEmp.cumulativeCompleted += Number(empResult.count || 0);
        jobAfterEmp.percent = totalWork ? Math.round((jobAfterEmp.cumulativeCompleted / totalWork) * 100) : jobAfterEmp.percent;

        // Step 5: Attendance (from 2026-01-10 to today) — optional
        const preloadAttendance = process.env.PRELOAD_FULL_ATTENDANCE_ON_LOGIN !== 'false';
        if (preloadAttendance) {
          this._setJobStep(job.id, 4, 'Activating attendance cache (2026-01-10 to today)...');
          await this.preloadAttendanceRange('2026-01-10', null, triggeredBy, (progress) => {
            const current = this.jobs.get(job.id);
            if (!current || current.status !== 'running') return;

            // Keep the attendance progress object for UI
            if (progress && typeof progress.processed === 'number' && typeof progress.total === 'number') {
              current.attendance = {
                processed: progress.processed,
                total: progress.total,
                inserted: progress.inserted,
                updated: progress.updated
              };
              current.stepProgress[4] = progress.processed || 0;

              // compute percent based on cumulativeCompleted + attendance processed
              const processedSoFar = current.cumulativeCompleted + (progress.processed || 0);
              current.percent = totalWork ? Math.round((processedSoFar / totalWork) * 100) : current.percent;
            }

            if (progress && typeof progress.message === 'string') {
              current.message = progress.message;
            }
          });
        } else {
          // Skip heavy attendance preload
          this._setJobStep(job.id, 4, 'Attendance preload skipped (disabled via env)');
          const jobAfterSkip = this.jobs.get(job.id);
          jobAfterSkip.stepProgress[4] = 0;
          jobAfterSkip.message = 'Attendance preload skipped due to configuration';
          jobAfterSkip.percent = totalWork ? Math.round((jobAfterSkip.cumulativeCompleted / totalWork) * 100) : jobAfterSkip.percent;
        }

        // Mark complete
        this._finishJob(job.id, 'Cache activation completed. Redirecting...');
      } catch (err) {
        console.error('❌ Full-system preload job failed:', err);
        this._failJob(job.id, err);
      }
    })();

    return { job, isNew: true };
  }

  /**
   * Starts a page-wise cache preload job for UI-specific data.
   * This caches aggregated/computed data for each page in the application.
   * Returns a job descriptor immediately; work runs in background.
   */
  startPageWiseCacheJob(triggeredBy = 'system') {
    // If a page-wise job is already running, reuse it
    const activePageJob = Array.from(this.jobs.values()).find(j => j.type === 'page-wise' && j.status === 'running');
    if (activePageJob) {
      console.log(`♻️  Reusing existing page-wise cache job ${activePageJob.id} for ${triggeredBy}`);
      return { job: activePageJob, isNew: false };
    }

    const steps = [
      'Dashboard Data',
      'Division Management',
      'Section Management',
      'Employee Management',
      'Report Templates'
    ];

    const job = this._createJob({ triggeredBy, steps });
    job.type = 'page-wise'; // Mark as page-wise job

    (async () => {
      try {
        console.log('📄 Starting page-wise cache preload...');

        // Calculate work for each page
        const [countsRows] = await sequelize.query(
          `SELECT 
            (SELECT COUNT(1) FROM divisions_sync WHERE STATUS = 'ACTIVE') AS divCount,
            (SELECT COUNT(1) FROM sections_sync WHERE STATUS = 'ACTIVE') AS secCount,
            (SELECT COUNT(1) FROM employees_sync WHERE STATUS = 'ACTIVE') AS empCount,
            (SELECT COUNT(DISTINCT employee_ID) FROM attendance WHERE date_ >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)) AS recentEmpCount
          `,
          { raw: true }
        );

        const counts = Array.isArray(countsRows) ? countsRows[0] : countsRows;
        const dashboardItems = 10; // Dashboard stats, recent activities, etc.
        const divMgmtItems = Number(counts?.divCount || 0);
        const secMgmtItems = Number(counts?.secCount || 0);
        const empMgmtItems = Number(counts?.empCount || 0);
        const reportTemplates = 5; // Common report templates

        const totalWork = dashboardItems + divMgmtItems + secMgmtItems + empMgmtItems + reportTemplates;

        console.log(`📊 Total page-wise items to cache: ${totalWork}`);

        this._updateJob(job.id, {
          totalWork,
          stepTotals: [dashboardItems, divMgmtItems, secMgmtItems, empMgmtItems, reportTemplates],
          stepProgress: Array(5).fill(0),
          stepLabels: ['Dashboard Data', 'Division Management', 'Section Management', 'Employee Management', 'Report Templates'],
          pageData: {} // Store detailed page data
        });

        // Ensure Redis is connected
        if (!this.cache.isConnected) {
          await this.cache.connect();
        }

        // Page 1: Dashboard Data
        this._setJobStep(job.id, 0, 'Caching dashboard data...');
        const dashResult = await this.cacheDashboardData((progress) => {
          const current = this.jobs.get(job.id);
          if (!current || current.status !== 'running') return;
          current.stepProgress[0] = progress.processed || 0;
          current.message = progress.message || current.message;
          current.percent = totalWork ? Math.round(((progress.processed || 0) / totalWork) * 100) : 0;
          if (progress.data) current.pageData.dashboard = progress.data;
        });
        const jobAfterDash = this.jobs.get(job.id);
        jobAfterDash.stepProgress[0] = dashResult.count;
        jobAfterDash.cumulativeCompleted = dashResult.count;
        jobAfterDash.percent = totalWork ? Math.round((jobAfterDash.cumulativeCompleted / totalWork) * 100) : 0;

        // Page 2: Division Management
        this._setJobStep(job.id, 1, 'Caching division management data...');
        const baseDivCompleted = this.jobs.get(job.id).cumulativeCompleted || 0;
        const divMgmtResult = await this.cacheDivisionManagementData((progress) => {
          const current = this.jobs.get(job.id);
          if (!current || current.status !== 'running') return;
          current.stepProgress[1] = progress.processed || 0;
          current.message = progress.message || current.message;
          current.percent = totalWork ? Math.round(((baseDivCompleted + (progress.processed || 0)) / totalWork) * 100) : current.percent;
          if (progress.data) current.pageData.divisionManagement = progress.data;
        });
        const jobAfterDiv = this.jobs.get(job.id);
        jobAfterDiv.stepProgress[1] = divMgmtResult.count;
        jobAfterDiv.cumulativeCompleted += divMgmtResult.count;
        jobAfterDiv.percent = totalWork ? Math.round((jobAfterDiv.cumulativeCompleted / totalWork) * 100) : 0;

        // Page 3: Section Management
        this._setJobStep(job.id, 2, 'Caching section management data...');
        const baseSecCompleted = this.jobs.get(job.id).cumulativeCompleted || 0;
        const secMgmtResult = await this.cacheSectionManagementData((progress) => {
          const current = this.jobs.get(job.id);
          if (!current || current.status !== 'running') return;
          current.stepProgress[2] = progress.processed || 0;
          current.message = progress.message || current.message;
          current.percent = totalWork ? Math.round(((baseSecCompleted + (progress.processed || 0)) / totalWork) * 100) : current.percent;
          if (progress.data) current.pageData.sectionManagement = progress.data;
        });
        const jobAfterSec = this.jobs.get(job.id);
        jobAfterSec.stepProgress[2] = secMgmtResult.count;
        jobAfterSec.cumulativeCompleted += secMgmtResult.count;
        jobAfterSec.percent = totalWork ? Math.round((jobAfterSec.cumulativeCompleted / totalWork) * 100) : 0;

        // Page 4: Employee Management
        this._setJobStep(job.id, 3, 'Caching employee management data...');
        const baseEmpCompleted = this.jobs.get(job.id).cumulativeCompleted || 0;
        const empMgmtResult = await this.cacheEmployeeManagementData((progress) => {
          const current = this.jobs.get(job.id);
          if (!current || current.status !== 'running') return;
          current.stepProgress[3] = progress.processed || 0;
          current.message = progress.message || current.message;
          current.percent = totalWork ? Math.round(((baseEmpCompleted + (progress.processed || 0)) / totalWork) * 100) : current.percent;
          if (progress.data) current.pageData.employeeManagement = progress.data;
        });
        const jobAfterEmp = this.jobs.get(job.id);
        jobAfterEmp.stepProgress[3] = empMgmtResult.count;
        jobAfterEmp.cumulativeCompleted += empMgmtResult.count;
        jobAfterEmp.percent = totalWork ? Math.round((jobAfterEmp.cumulativeCompleted / totalWork) * 100) : 0;

        // Page 5: Report Templates
        this._setJobStep(job.id, 4, 'Caching report templates...');
        const baseRepCompleted = this.jobs.get(job.id).cumulativeCompleted || 0;
        const reportResult = await this.cacheReportTemplates((progress) => {
          const current = this.jobs.get(job.id);
          if (!current || current.status !== 'running') return;
          current.stepProgress[4] = progress.processed || 0;
          current.message = progress.message || current.message;
          current.percent = totalWork ? Math.round(((baseRepCompleted + (progress.processed || 0)) / totalWork) * 100) : current.percent;
          if (progress.data) current.pageData.reportTemplates = progress.data;
        });
        const jobAfterRep = this.jobs.get(job.id);
        jobAfterRep.stepProgress[4] = reportResult.count;
        jobAfterRep.cumulativeCompleted += reportResult.count;
        jobAfterRep.percent = 100;

        // Mark complete
        this._finishJob(job.id, 'Page-wise cache activation completed!');
      } catch (err) {
        console.error('❌ Page-wise cache job failed:', err);
        this._failJob(job.id, err);
      }
    })();

    return { job, isNew: true };
  }

  /**
   * Full cache preload - loads all entities with indexes
   */
  async preloadAll(triggeredBy = 'system') {
    // TEMPORARILY DISABLE PRELOAD SYSTEM
    console.log('🚫 Cache preload system is temporarily disabled');
    return {
      success: false,
      message: 'Cache preload system is temporarily disabled',
      disabled: true,
      triggeredBy: triggeredBy
    };

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

      try {
        await CacheSyncLog.create(syncLog);
      } catch (dbErr) {
        console.error('CacheSyncLog DB write failed, falling back to file:', dbErr && (dbErr.message || dbErr.stack) ? (dbErr.message || dbErr.stack) : dbErr);
        try {
          const fs = require('fs');
          const path = require('path');
          const logDir = path.join(__dirname, '..', 'logs');
          if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
          const fallbackPath = path.join(logDir, 'cache_sync_log_fallback.jsonl');
          fs.appendFileSync(fallbackPath, JSON.stringify({ timestamp: new Date().toISOString(), syncLog, dbErr: String(dbErr && (dbErr.message || dbErr.stack) || dbErr) }) + '\n');
        } catch (fileErr) {
          console.error('Failed to write cache sync fallback log:', fileErr && (fileErr.message || fileErr.stack) ? (fileErr.message || fileErr.stack) : fileErr);
        }
      }

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
      syncLog.error_message = (error && (error.stack || error.message) || 'Unknown error').substring(0, 2000); // Store stack (truncated)
      syncLog.completed_at = new Date();
      syncLog.duration_ms = Date.now() - startTime;

      // Persist detailed error to log file for post-mortem
      try {
        const fs = require('fs');
        const path = require('path');
        const logDir = path.join(__dirname, '..', 'logs');
        if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
        const logPath = path.join(logDir, 'cache_preload_errors.log');
        fs.appendFileSync(logPath, `${new Date().toISOString()} - ${error && (error.stack || error.message) || 'Unknown error'}\n\n`);
      } catch (logErr) {
        console.error('Failed to write preload error log:', logErr && (logErr.message || logErr.stack) ? (logErr.message || logErr.stack) : logErr);
      }
      

      try {
        await CacheSyncLog.create(syncLog);
      } catch (dbErr) {
        console.error('CacheSyncLog DB write failed while recording failure, falling back to file:', dbErr && (dbErr.message || dbErr.stack) ? (dbErr.message || dbErr.stack) : dbErr);
        try {
          const fs = require('fs');
          const path = require('path');
          const logDir = path.join(__dirname, '..', 'logs');
          if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
          const fallbackPath = path.join(logDir, 'cache_sync_log_fallback.jsonl');
          fs.appendFileSync(fallbackPath, JSON.stringify({ timestamp: new Date().toISOString(), syncLog, dbErr: String(dbErr && (dbErr.message || dbErr.stack) || dbErr) }) + '\n');
        } catch (fileErr) {
          console.error('Failed to write cache sync fallback log:', fileErr && (fileErr.message || fileErr.stack) ? (fileErr.message || fileErr.stack) : fileErr);
        }
      }

      throw error;
    }
  }

  /**
   * Preload all divisions with indexes
   */
  async preloadDivisions(onProgress) {
    try {
      // Fetch all divisions from MySQL
      const [divisions] = await sequelize.query(
        `SELECT * FROM divisions_sync WHERE STATUS = 'ACTIVE' ORDER BY HIE_NAME ASC`,
        { raw: true }
      );

      if (!divisions || divisions.length === 0) {
        console.log('⚠️ No divisions found to preload');
        if (typeof onProgress === 'function') onProgress({ processed: 0, total: 0, message: 'No divisions to process' });
        return { count: 0, indexed: 0 };
      }

      console.log(`📦 Loading ${divisions.length} divisions...`);

      const indexes = [];
      let processed = 0;

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
        await this.cache.set(cacheKey, divisionData, 3600);

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
        await this.cache.zadd('cache:divisions:all', 0, div.HIE_CODE);

        processed++;
        // Report progress periodically (every 50 items) and at the end
        if (typeof onProgress === 'function' && (processed % 50 === 0 || processed === divisions.length)) {
          onProgress({ processed, total: divisions.length, message: `Caching divisions: ${processed}/${divisions.length}` });
        }
      }

      // Store all divisions list
      await this.cache.set(
        'cache:divisions:list',
        JSON.stringify(divisions.map(d => d.HIE_CODE)),
        3600
      );

      // Bulk insert indexes to MySQL (for metadata tracking)
      if (indexes.length > 0) {
        await this._bulkCreateInBatches(CacheIndex, indexes, { updateOnDuplicate: ['index_value', 'cache_key', 'updated_at'] }, 500);
      }

      // Update metadata
      try {
        await CacheMetadata.upsert({
          cache_key: 'cache:divisions:all',
          entity_type: 'division',
          record_count: divisions.length,
          data_size_bytes: JSON.stringify(divisions).length,
          last_sync_at: new Date(),
          expires_at: new Date(Date.now() + 3600000), // 1 hour
          is_valid: true
        });
      } catch (e) {
        console.error('CacheMetadata upsert error (divisions):', e && (e.message || e.stack) ? (e.message || e.stack) : e);
      }

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
  async preloadSections(onProgress) {
    try {
      const [sections] = await sequelize.query(
        `SELECT * FROM sections_sync WHERE STATUS = 'ACTIVE' ORDER BY HIE_NAME ASC`,
        { raw: true }
      );

      if (!sections || sections.length === 0) {
        console.log('⚠️ No sections found to preload');
        if (typeof onProgress === 'function') onProgress({ processed: 0, total: 0, message: 'No sections to process' });
        return { count: 0, indexed: 0 };
      }

      console.log(`📦 Loading ${sections.length} sections...`);

      const indexes = [];
      let processed = 0;

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
        await this.cache.set(cacheKey, sectionData, 3600);

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
        await this.cache.zadd('cache:sections:all', 0, sec.HIE_CODE);
        
        // Add to division's sections set
        await this.cache.sadd(`cache:division:${sec.HIE_RELATIONSHIP}:sections`, sec.HIE_CODE);

        processed++;
        if (typeof onProgress === 'function' && (processed % 50 === 0 || processed === sections.length)) {
          onProgress({ processed, total: sections.length, message: `Caching sections: ${processed}/${sections.length}` });
        }
      }

      await this.cache.set(
        'cache:sections:list',
        JSON.stringify(sections.map(s => s.HIE_CODE)),
        3600
      );

      if (indexes.length > 0) {
        await this._bulkCreateInBatches(CacheIndex, indexes, { updateOnDuplicate: ['index_value', 'cache_key', 'updated_at'] }, 500);
      }

      try {
        await CacheMetadata.upsert({
          cache_key: 'cache:sections:all',
          entity_type: 'section',
          record_count: sections.length,
          data_size_bytes: JSON.stringify(sections).length,
          last_sync_at: new Date(),
          expires_at: new Date(Date.now() + 3600000),
          is_valid: true
        });
      } catch (e) {
        console.error('CacheMetadata upsert error (sections):', e && (e.message || e.stack) ? (e.message || e.stack) : e);
      }

      console.log(`✅ Loaded ${sections.length} sections with ${indexes.length} indexes`);
      return { count: sections.length, indexed: indexes.length };

    } catch (error) {
      console.error('❌ Section preload error:', error);
      throw error;
    }
  }

  /**
   * Preload all sub-sections with indexes
   */
  async preloadSubSections(onProgress) {
    try {
      let subSections = [];
      try {
        const [result] = await sequelize.query(
          `SELECT * FROM sub_sections ORDER BY sub_section_name ASC`,
          { raw: true }
        );
        subSections = result || [];
      } catch (queryErr) {
        console.warn('⚠️ sub_sections table not found, skipping sub-sections preload:', queryErr.message);
        if (typeof onProgress === 'function') onProgress({ processed: 0, total: 0, message: 'Sub-sections table not available' });
        return { count: 0, indexed: 0 };
      }

      if (!subSections || subSections.length === 0) {
        console.log('⚠️ No sub-sections found to preload');
        if (typeof onProgress === 'function') onProgress({ processed: 0, total: 0, message: 'No sub-sections to process' });
        return { count: 0, indexed: 0 };
      }

      console.log(`📦 Loading ${subSections.length} sub-sections...`);

      const indexes = [];
      let processed = 0;

      for (const subSec of subSections) {
        // Map sub_sections table columns (id, sub_section_name, sub_section_code, section_code, division_code)
        const subSecId = subSec.id || subSec.sub_section_code || subSec.HIE_CODE;
        const subSecName = subSec.sub_section_name || subSec.HIE_NAME || '';
        const subSecCode = subSec.sub_section_code || subSec.HIE_CODE || '';
        
        const subSectionData = {
          _id: `mysql_subsec_${subSecId}`,
          id: subSec.id,
          sub_section_name: subSecName,
          sub_section_code: subSecCode,
          section_code: subSec.section_code || subSec.HIE_RELATIONSHIP,
          division_code: subSec.division_code,
          HIE_CODE: subSecCode,
          HIE_NAME: subSecName,
          HIE_NAME_SINHALA: subSec.HIE_NAME_SINHALA,
          HIE_NAME_TAMIL: subSec.HIE_NAME_TAMIL,
          HIE_RELATIONSHIP: subSec.section_code || subSec.HIE_RELATIONSHIP,
          DEF_LEVEL: subSec.DEF_LEVEL,
          STATUS: subSec.STATUS || 'ACTIVE',
          DESCRIPTION: subSec.DESCRIPTION,
          code: subSecCode,
          name: subSecName,
          synced_at: subSec.synced_at || new Date().toISOString(),
          source: 'MySQL'
        };

        // Store in Redis with TTL (1 hour)
        const cacheKey = `cache:subsection:${subSecId}`;
        await this.cache.set(cacheKey, subSectionData, 3600);

        // Build indexes
        indexes.push({
          entity_type: 'subsection',
          entity_id: subSecId,
          index_key: 'code',
          index_value: subSecCode,
          cache_key: cacheKey
        });

        indexes.push({
          entity_type: 'subsection',
          entity_id: subSecId,
          index_key: 'name',
          index_value: subSecName,
          cache_key: cacheKey
        });

        // Add to sorted set for listing
        await this.cache.zadd('cache:subsections:all', 0, subSecId);

        processed++;
        // Report progress periodically (every 50 items) and at the end
        if (typeof onProgress === 'function' && (processed % 50 === 0 || processed === subSections.length)) {
          onProgress({ processed, total: subSections.length, message: `Caching sub-sections: ${processed}/${subSections.length}` });
        }
      }

      // Store all sub-sections list
      await this.cache.set(
        'cache:subsections:list',
        JSON.stringify(subSections.map(s => s.id || s.sub_section_code || s.HIE_CODE)),
        3600
      );

      // Bulk insert indexes to MySQL (for metadata tracking)
      if (indexes.length > 0) {
        await this._bulkCreateInBatches(CacheIndex, indexes, { updateOnDuplicate: ['index_value', 'cache_key', 'updated_at'] }, 500);
      }

      // Update metadata
      try {
        await CacheMetadata.upsert({
          cache_key: 'cache:subsections:all',
          entity_type: 'subsection',
          record_count: subSections.length,
          data_size_bytes: JSON.stringify(subSections).length,
          last_sync_at: new Date(),
          expires_at: new Date(Date.now() + 3600000), // 1 hour
          is_valid: true
        });
      } catch (e) {
        console.error('CacheMetadata upsert error (sub-sections):', e && (e.message || e.stack) ? (e.message || e.stack) : e);
      }

      console.log(`✅ Loaded ${subSections.length} sub-sections with ${indexes.length} indexes`);
      return { count: subSections.length, indexed: indexes.length };

    } catch (error) {
      console.error('❌ Sub-section preload error:', error);
      throw error;
    }
  }


  /**
   * Preload all employees with indexes
   */
  async preloadEmployees(onProgress) {
    try {
      const [employees] = await sequelize.query(
        `SELECT * FROM employees_sync ORDER BY EMP_NAME ASC`,
        { raw: true }
      );

      if (!employees || employees.length === 0) {
        console.log('⚠️ No employees found to preload');
        if (typeof onProgress === 'function') onProgress({ processed: 0, total: 0, message: 'No employees to process' });
        return { count: 0, indexed: 0 };
      }

      console.log(`📦 Loading ${employees.length} employees...`);

      const indexes = [];
      let processed = 0;

      for (const emp of employees) {
        // Normalize employee identifiers and organizational fields to support different sync schemas
        const empId = emp && (emp.EMP_ID || emp.EMP_NO || (emp.EMP_NO && emp.EMP_NO.toString()));
        if (!emp || !empId) {
          console.warn('Skipping employee with missing EMP_ID:', emp && (emp.EMP_NAME || emp));
          continue;
        }

        const divisionId = emp.DIVISION_ID || emp.DIV_CODE || (emp.DIV_CODE && emp.DIV_CODE.toString());
        const sectionId = emp.SECTION_ID || emp.SEC_CODE || (emp.SEC_CODE && emp.SEC_CODE.toString());
        const empName = emp.EMP_NAME || emp.EMP_NAME_WITH_INITIALS || emp.EMP_FIRST_NAME || '';
        const empEmail = emp.EMAIL || emp.EMP_EMAIL || null;
        const empPhone = emp.PHONE || emp.EMP_PHONE || emp.EMP_MOBILE || null;
        const empTitle = emp.EMP_TITLE || emp.EMP_DESIGNATION || null;

        const employeeData = {
          _id: `mysql_emp_${empId}`,
          EMP_ID: empId,
          EMP_NAME: empName,
          EMP_TITLE: empTitle,
          EMP_TYPE: emp.EMP_TYPE,
          SECTION_ID: sectionId,
          SECTION_NAME: emp.SECTION_NAME || emp.SEC_NAME || null,
          DIVISION_ID: divisionId,
          DIVISION_NAME: emp.DIVISION_NAME || emp.DIV_NAME || null,
          LOCATION: emp.LOCATION || null,
          STATUS: emp.STATUS || emp.EMP_STATUS || null,
          EMAIL: empEmail,
          PHONE: empPhone,
          code: empId,
          name: empName,
          synced_at: emp.synced_at,
          source: 'MySQL'
        };

        const cacheKey = `cache:employee:${empId}`;
        await this.cache.set(cacheKey, employeeData, 1800); // 30 min TTL

        // Multiple indexes for employees
        indexes.push(
          {
            entity_type: 'employee',
            entity_id: empId,
            index_key: 'id',
            index_value: empId,
            cache_key: cacheKey
          },
          {
            entity_type: 'employee',
            entity_id: empId,
            index_key: 'name',
            index_value: empName,
            cache_key: cacheKey
          },
          {
            entity_type: 'employee',
            entity_id: empId,
            index_key: 'division_id',
            index_value: divisionId,
            cache_key: cacheKey
          },
          {
            entity_type: 'employee',
            entity_id: empId,
            index_key: 'section_id',
            index_value: sectionId,
            cache_key: cacheKey
          }
        );

        if (empEmail) {
          indexes.push({
            entity_type: 'employee',
            entity_id: empId,
            index_key: 'email',
            index_value: empEmail,
            cache_key: cacheKey
          });
        }

        // report progress periodically
        processed++;
        if (typeof onProgress === 'function' && (processed % 100 === 0 || processed === employees.length)) {
          onProgress({ processed, total: employees.length, message: `Caching employees: ${processed}/${employees.length}` });
        }
      }

      if (indexes.length > 0) {
        await this._bulkCreateInBatches(CacheIndex, indexes, { updateOnDuplicate: ['index_value', 'cache_key', 'updated_at'] }, 500);
      }

      await this.cache.set('cache:employees:list', JSON.stringify(employees.map(e => e.EMP_ID)), 1800);

      try {
        await CacheMetadata.upsert({
          cache_key: 'cache:employees:list',
          entity_type: 'employee',
          record_count: employees.length,
          data_size_bytes: JSON.stringify(employees).length,
          last_sync_at: new Date(),
          expires_at: new Date(Date.now() + 1800000),
          is_valid: true
        });
      } catch (e) {
        console.error('CacheMetadata upsert error (employees):', e && (e.message || e.stack) ? (e.message || e.stack) : e);
      }

      console.log(`✅ Loaded ${employees.length} employees with ${indexes.length} indexes`);
      return { count: employees.length, indexed: indexes.length };

    } catch (error) {
      console.error('❌ Employee preload error:', error);
      throw error;
    }
  }

  /**
   * Preload attendance-specific data into cache (uses optimized attendance table if available)
   */
  async preloadAttendance(days = 7, triggeredBy = 'manual') {
    try {
      console.log(`📥 Preloading attendance cache (last ${days} days) ...`);

      // Use optimized attendance sync service to ensure optimized table is up-to-date
      const optimizedAttendanceService = require('./optimizedAttendanceSyncService');
      const stats = await optimizedAttendanceService.syncLastDays(days);

      // Store metadata about preload
      await CacheMetadata.upsert({
        cache_key: `cache:attendance:last_${days}_days`,
        entity_type: 'attendance',
        record_count: stats.recordsInserted + stats.recordsUpdated || 0,
        data_size_bytes: 0,
        last_sync_at: new Date(),
        expires_at: new Date(Date.now() + 3600000),
        is_valid: true
      });

      console.log(`✅ Attendance preload completed: ${stats.recordsInserted} inserted, ${stats.recordsUpdated} updated`);
      return { success: true, stats };

    } catch (error) {
      console.error('❌ Attendance preload error:', error);
      throw error;
    }
  }

  /**
   * Preload attendance cache for the full available database range.
   * Uses the optimized attendance sync pipeline and reports progress when possible.
   */
  async preloadAttendanceFull(triggeredBy = 'manual', onProgress) {
    try {
      console.log('📥 Preloading attendance cache (full database range) ...');

      const [rangeRows] = await sequelize.query(
        `SELECT MIN(DATE(date_)) AS min_date, MAX(DATE(date_)) AS max_date, COUNT(*) AS total_rows FROM attendance`,
        { raw: true }
      );

      const range = Array.isArray(rangeRows) ? rangeRows[0] : rangeRows;
      const minDate = range?.min_date;
      const maxDate = range?.max_date;
      const totalRows = Number(range?.total_rows || 0);

      if (!minDate || !maxDate || totalRows === 0) {
        if (typeof onProgress === 'function') {
          onProgress({ message: 'No attendance data found to preload.', processed: 0, total: 0, inserted: 0, updated: 0 });
        }
        return { success: true, stats: { recordsProcessed: 0, recordsInserted: 0, recordsUpdated: 0 } };
      }

      const optimizedAttendanceService = require('./optimizedAttendanceSyncService');

      if (typeof onProgress === 'function') {
        onProgress({ message: `Syncing attendance from ${minDate} to ${maxDate}...`, processed: 0, total: totalRows, inserted: 0, updated: 0 });
      }

      const stats = await optimizedAttendanceService.syncAttendanceData(
        String(minDate),
        String(maxDate),
        {
          onProgress: (p) => {
            if (typeof onProgress !== 'function') return;
            onProgress({
              message: p?.message,
              processed: p?.processed,
              total: p?.total,
              inserted: p?.inserted,
              updated: p?.updated
            });
          }
        }
      );

      await CacheMetadata.upsert({
        cache_key: 'cache:attendance:full',
        entity_type: 'attendance',
        record_count: (stats.recordsInserted || 0) + (stats.recordsUpdated || 0),
        data_size_bytes: 0,
        last_sync_at: new Date(),
        expires_at: new Date(Date.now() + 3600000),
        is_valid: true
      });

      console.log(`✅ Attendance full preload completed: ${stats.recordsInserted} inserted, ${stats.recordsUpdated} updated`);
      return { success: true, stats };

    } catch (error) {
      console.error('❌ Attendance full preload error:', error);
      throw error;
    }
  }

  /**
   * Preload attendance data for a specific date range
   * @param {string} fromDate - Start date (YYYY-MM-DD format, or null for 2026-01-10)
   * @param {string} toDate - End date (YYYY-MM-DD format, or null for today)
   * @param {string} triggeredBy - Who triggered this
   * @param {function} onProgress - Progress callback
   */
  async preloadAttendanceRange(fromDate = null, toDate = null, triggeredBy = 'manual', onProgress) {
    try {
      // Default to 2026-01-10 if no start date provided
      const startDate = fromDate || '2026-01-10';
      // Default to today if no end date provided
      const endDate = toDate || new Date().toISOString().split('T')[0];

      console.log(`📥 Preloading attendance cache (${startDate} to ${endDate}) ...`);

      // Get the count of records in this range
      const [rangeRows] = await sequelize.query(
        `SELECT COUNT(*) AS total_rows 
         FROM attendance 
         WHERE date_ >= ? AND date_ <= ?
         AND (fingerprint_id NOT LIKE '%Emergancy Exit%' OR fingerprint_id IS NULL)`,
        { replacements: [startDate, endDate], raw: true }
      );

      const range = Array.isArray(rangeRows) ? rangeRows[0] : rangeRows;
      const totalRows = Number(range?.total_rows || 0);

      if (totalRows === 0) {
        if (typeof onProgress === 'function') {
          onProgress({ message: 'No attendance data found in date range.', processed: 0, total: 0, inserted: 0, updated: 0 });
        }
        return { success: true, stats: { recordsProcessed: 0, recordsInserted: 0, recordsUpdated: 0 } };
      }

      const optimizedAttendanceService = require('./optimizedAttendanceSyncService');

      if (typeof onProgress === 'function') {
        onProgress({ message: `Syncing attendance from ${startDate} to ${endDate} (${totalRows} records)...`, processed: 0, total: totalRows, inserted: 0, updated: 0 });
      }

      const stats = await optimizedAttendanceService.syncAttendanceData(
        startDate,
        endDate,
        {
          onProgress: (p) => {
            if (typeof onProgress !== 'function') return;
            onProgress({
              message: p?.message,
              processed: p?.processed,
              total: p?.total,
              inserted: p?.inserted,
              updated: p?.updated
            });
          }
        }
      );

      await CacheMetadata.upsert({
        cache_key: `cache:attendance:range:${startDate}:${endDate}`,
        entity_type: 'attendance',
        record_count: (stats.recordsInserted || 0) + (stats.recordsUpdated || 0),
        data_size_bytes: 0,
        last_sync_at: new Date(),
        expires_at: new Date(Date.now() + 3600000),
        is_valid: true
      });

      console.log(`✅ Attendance range preload completed (${startDate} to ${endDate}): ${stats.recordsInserted} inserted, ${stats.recordsUpdated} updated`);
      return { success: true, stats };

    } catch (error) {
      console.error('❌ Attendance range preload error:', error);
      throw error;
    }
  }

  /**
   * Preload audit-specific data into cache (sync audit table then build indexes)
   */
  async preloadAudit(days = 30, triggeredBy = 'manual') {
    try {
      const auditService = require('./auditSyncService');
      console.log(`📥 Preloading audit cache (last ${days} days) ...`);

      const result = await auditService.syncLastNDays(days, {}, triggeredBy);

      // Optionally build Redis indexes for quick lookups (e.g., by date, issue_type)
      const [auditRows] = await sequelize.query(
        `SELECT employee_id, event_date, issue_type FROM audit_sync WHERE event_date BETWEEN DATE_SUB(CURDATE(), INTERVAL ? DAY) AND CURDATE()`,
        { replacements: [days], raw: true }
      );

      // Store a compact set in Redis for quick membership checks
      const key = `cache:audit:last_${days}_days`;
      await this.cache.set(key, JSON.stringify(auditRows), 3600);

      await CacheMetadata.upsert({
        cache_key: key,
        entity_type: 'audit',
        record_count: auditRows.length,
        data_size_bytes: JSON.stringify(auditRows).length,
        last_sync_at: new Date(),
        expires_at: new Date(Date.now() + 3600000),
        is_valid: true
      });

      console.log(`✅ Audit preload completed: ${auditRows.length} records cached`);
      return { success: true, synced: result, cached: auditRows.length };

    } catch (error) {
      console.error('❌ Audit preload error:', error);
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

      // Build division -> employees relationships (use DIV_CODE and EMP_NO)
      const [divisionEmployees] = await sequelize.query(
        `SELECT DISTINCT DIV_CODE as division_code, EMP_NO as employee_id
         FROM employees_sync
         WHERE DIV_CODE IS NOT NULL`,
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

      // Build section -> employees relationships (use SEC_CODE and EMP_NO)
      const [sectionEmployees] = await sequelize.query(
        `SELECT DISTINCT SEC_CODE as section_code, EMP_NO as employee_id
         FROM employees_sync
         WHERE SEC_CODE IS NOT NULL`,
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

      // Bulk insert relationships in batches
      if (relationships.length > 0) {
        await this._bulkCreateInBatches(CacheRelationship, relationships, { updateOnDuplicate: ['updated_at'] }, 500);
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

  /**
   * Cache dashboard-specific data (stats, recent activities, charts)
   */
  async cacheDashboardData(onProgress) {
    try {
      console.log('📊 Caching dashboard data...');
      let processed = 0;
      const items = [];

      // 1. Total employees
      if (onProgress) onProgress({ processed: ++processed, total: 10, message: 'Caching total employees...' });
      const [empCount] = await sequelize.query('SELECT COUNT(1) AS total FROM employees_sync WHERE STATUS = "ACTIVE"', { raw: true });
      items.push({ key: 'total_employees', value: empCount[0]?.total || 0 });
      await this.cache.set('cache:dashboard:total_employees', empCount[0]?.total || 0, 3600);

      // 2. Total divisions
      if (onProgress) onProgress({ processed: ++processed, total: 10, message: 'Caching total divisions...' });
      const [divCount] = await sequelize.query('SELECT COUNT(1) AS total FROM divisions_sync WHERE STATUS = "ACTIVE"', { raw: true });
      items.push({ key: 'total_divisions', value: divCount[0]?.total || 0 });
      await this.cache.set('cache:dashboard:total_divisions', divCount[0]?.total || 0, 3600);

      // 3. Total sections
      if (onProgress) onProgress({ processed: ++processed, total: 10, message: 'Caching total sections...' });
      const [secCount] = await sequelize.query('SELECT COUNT(1) AS total FROM sections_sync WHERE STATUS = "ACTIVE"', { raw: true });
      items.push({ key: 'total_sections', value: secCount[0]?.total || 0 });
      await this.cache.set('cache:dashboard:total_sections', secCount[0]?.total || 0, 3600);

      // 4. Today's attendance
      if (onProgress) onProgress({ processed: ++processed, total: 10, message: 'Caching today\'s attendance...' });
      const [todayAtt] = await sequelize.query('SELECT COUNT(DISTINCT employee_ID) AS total FROM attendance WHERE DATE(date_) = CURDATE()', { raw: true });
      items.push({ key: 'today_attendance', value: todayAtt[0]?.total || 0 });
      await this.cache.set('cache:dashboard:today_attendance', todayAtt[0]?.total || 0, 1800);

      // 5-10. Recent activities, charts data, etc.
      for (let i = 5; i <= 10; i++) {
        if (onProgress) onProgress({ processed: ++processed, total: 10, message: `Caching dashboard item ${i}/10...` });
        await new Promise(resolve => setTimeout(resolve, 50)); // Simulate work
      }

      console.log(`✅ Cached ${processed} dashboard items`);
      if (onProgress) onProgress({ processed, total: 10, message: 'Dashboard cache complete', data: items });
      return { count: processed, items };
    } catch (error) {
      console.error('❌ Dashboard cache error:', error);
      throw error;
    }
  }

  /**
   * Cache division management page data
   */
  async cacheDivisionManagementData(onProgress) {
    try {
      console.log('📊 Caching division management data...');
      const [divisions] = await sequelize.query('SELECT * FROM divisions_sync WHERE STATUS = "ACTIVE"', { raw: true });
      const items = [];
      let processed = 0;

      for (const div of divisions) {
        // Cache division with employee count
        const [empCount] = await sequelize.query(
          'SELECT COUNT(1) AS total FROM employees_sync WHERE DIV_CODE = ? AND STATUS = "ACTIVE"',
          { replacements: [div.HIE_CODE], raw: true }
        );

        const divData = {
          ...div,
          employeeCount: empCount[0]?.total || 0,
          cached_at: new Date().toISOString()
        };

        await this.cache.set(`cache:divmgmt:${div.HIE_CODE}`, divData, 3600);
        items.push(divData);

        processed++;
        if (onProgress && (processed % 5 === 0 || processed === divisions.length)) {
          onProgress({ processed, total: divisions.length, message: `Caching division ${processed}/${divisions.length}...`, data: items });
        }
      }

      // Cache division list
      await this.cache.set('cache:divmgmt:list', items, 3600);

      console.log(`✅ Cached ${processed} divisions for management page`);
      return { count: processed, items };
    } catch (error) {
      console.error('❌ Division management cache error:', error);
      throw error;
    }
  }

  /**
   * Cache section management page data
   */
  async cacheSectionManagementData(onProgress) {
    try {
      console.log('📊 Caching section management data...');
      const [sections] = await sequelize.query('SELECT * FROM sections_sync WHERE STATUS = "ACTIVE"', { raw: true });
      const items = [];
      let processed = 0;

      for (const sec of sections) {
        // Cache section with employee count and parent division
        const [empCount] = await sequelize.query(
          'SELECT COUNT(1) AS total FROM employees_sync WHERE SEC_CODE = ? AND STATUS = "ACTIVE"',
          { replacements: [sec.HIE_CODE], raw: true }
        );

        const [parentDiv] = await sequelize.query(
          'SELECT HIE_NAME FROM divisions_sync WHERE HIE_CODE = ? AND STATUS = "ACTIVE"',
          { replacements: [sec.HIE_RELATIONSHIP], raw: true }
        );

        const secData = {
          ...sec,
          employeeCount: empCount[0]?.total || 0,
          parentDivisionName: parentDiv[0]?.HIE_NAME || '',
          cached_at: new Date().toISOString()
        };

        await this.cache.set(`cache:secmgmt:${sec.HIE_CODE}`, secData, 3600);
        items.push(secData);

        processed++;
        if (onProgress && (processed % 5 === 0 || processed === sections.length)) {
          onProgress({ processed, total: sections.length, message: `Caching section ${processed}/${sections.length}...`, data: items });
        }
      }

      // Cache section list
      await this.cache.set('cache:secmgmt:list', items, 3600);

      console.log(`✅ Cached ${processed} sections for management page`);
      return { count: processed, items };
    } catch (error) {
      console.error('❌ Section management cache error:', error);
      throw error;
    }
  }

  /**
   * Cache employee management page data
   */
  async cacheEmployeeManagementData(onProgress) {
    try {
      console.log('📊 Caching employee management data...');
      const [employees] = await sequelize.query('SELECT * FROM employees_sync WHERE STATUS = "ACTIVE" LIMIT 500', { raw: true });
      const items = [];
      let processed = 0;

      for (const emp of employees) {
        // Cache employee with division/section names
        const empData = {
          ...emp,
          divisionName: emp.DIV_NAME || '',
          sectionName: emp.SEC_NAME || '',
          cached_at: new Date().toISOString()
        };

        await this.cache.set(`cache:empmgmt:${emp.EMP_NO}`, empData, 3600);
        items.push(empData);

        processed++;
        if (onProgress && (processed % 20 === 0 || processed === employees.length)) {
          onProgress({ processed, total: employees.length, message: `Caching employee ${processed}/${employees.length}...`, data: items.slice(0, 10) });
        }
      }

      // Cache employee list summary
      await this.cache.set('cache:empmgmt:list', items.map(e => ({ EMP_NO: e.EMP_NO, EMP_NAME: e.EMP_NAME })), 3600);

      console.log(`✅ Cached ${processed} employees for management page`);
      return { count: processed, items: items.slice(0, 10) };
    } catch (error) {
      console.error('❌ Employee management cache error:', error);
      throw error;
    }
  }

  /**
   * Cache report templates and common report data
   */
  async cacheReportTemplates(onProgress) {
    try {
      console.log('📊 Caching report templates...');
      const templates = [
        { id: 'daily', name: 'Daily Attendance Report', type: 'attendance' },
        { id: 'monthly', name: 'Monthly Attendance Summary', type: 'attendance' },
        { id: 'division', name: 'Division-wise Report', type: 'attendance' },
        { id: 'incomplete', name: 'Incomplete Punch Report', type: 'audit' },
        { id: 'late', name: 'Late Arrivals Report', type: 'audit' }
      ];

      let processed = 0;
      for (const template of templates) {
        await this.cache.set(`cache:report:template:${template.id}`, template, 7200);
        processed++;
        if (onProgress) {
          onProgress({ processed, total: templates.length, message: `Caching report template: ${template.name}...`, data: templates });
        }
      }

      // Cache common report filters
      await this.cache.set('cache:report:templates:all', templates, 7200);

      console.log(`✅ Cached ${processed} report templates`);
      return { count: processed, items: templates };
    } catch (error) {
      console.error('❌ Report templates cache error:', error);
      throw error;
    }
  }
}

module.exports = new CachePreloadService();
