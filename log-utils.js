/**
 * Logger utility for capturing and storing application logs in IndexedDB
 * - Captures console logs (log, warn, error) with source tracking
 * - Batches and queues logs for efficient storage
 * - Auto-saves on errors, page unload, and visibility changes
 * - Handles service worker logs and lifecycle events
 * - Provides UI modal for viewing logs (up to 1000 entries)
 */
class Logger {
  static DB_NAME = 'LoggerDB';
  static STORE_NAME = 'logs';
  static MAX_LOGS = 1000;
  static _db = null;
  static _lastTimestamp = 0;  // Track last used timestamp

  // In-memory queue configuration
  static _memoryQueue = [];
  static _flushInterval = null;
  static FLUSH_INTERVAL = 5000;    // Flush every 5 seconds
  static MAX_QUEUE_SIZE = 100;     // Or when queue reaches 100 items
  static _isFlushingQueue = false; // Lock to prevent concurrent flushes

  static MAX_BATCH_SIZE = 50;      // Maximum logs to process in one batch
  static RETRY_DELAY = 1000;       // Retry failed saves after 1 second
  static MAX_RETRIES = 3;          // Maximum number of retry attempts
  static _retryQueue = [];         // Queue for failed saves
  static _processingRetries = false;

  static async initDB() {
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open(this.DB_NAME, 1);
      
      request.onerror = (event) => {
        console.error('Database error:', event.target.error);
        reject(event.target.error);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(this.STORE_NAME)) {
          const store = db.createObjectStore(this.STORE_NAME, { 
            keyPath: 'id'  // Change to use generated id instead of timestamp
          });
          store.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };

      request.onsuccess = (event) => {
        this._db = event.target.result;
        resolve(this._db);
      };
    });

    // Start periodic flush interval
    this._flushInterval = setInterval(() => {
      this.flushQueue();
    }, this.FLUSH_INTERVAL);

    // Add visibility change handler
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
          this.flushQueue(true);
        }
      });
    }

    return db;
  }

  static async getDB() {
    if (!this._db) {
      await this.initDB();
    }
    return this._db;
  }

  static async flushQueue(force = false) {
    // Skip if queue is empty or already flushing
    if (this._memoryQueue.length === 0 || this._isFlushingQueue) return;
    
    this._isFlushingQueue = true;
    let logsToSave;
    
    try {
      const db = await this.getDB();
      const tx = db.transaction(this.STORE_NAME, 'readwrite');
      const store = tx.objectStore(this.STORE_NAME);

      // Process logs in smaller batches
      while (this._memoryQueue.length > 0) {
        // Take a batch of logs
        logsToSave = this._memoryQueue.splice(0, this.MAX_BATCH_SIZE);

        // Save batch
        const addPromises = logsToSave.map(log => 
          new Promise((resolve, reject) => {
            const request = store.add(log);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
          })
        );

        try {
          await Promise.all(addPromises);
        } catch (error) {
          // Add failed logs to retry queue
          this._retryQueue.push(...logsToSave);
          this.scheduleRetry();
          throw error; // Re-throw to trigger outer catch
        }
      }

      // Wait for transaction to complete
      await new Promise((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });

    } catch (error) {
      originalConsole.error('Failed to flush log queue:', error);
      // Put logs back in queue if save failed and not force flushing
      if (!force && logsToSave) {
        this._memoryQueue.unshift(...logsToSave);
      }
    } finally {
      this._isFlushingQueue = false;
    }
  }

  static async scheduleRetry() {
    if (this._processingRetries) return;
    
    this._processingRetries = true;
    let retryCount = 0;

    while (this._retryQueue.length > 0 && retryCount < this.MAX_RETRIES) {
      await new Promise(resolve => setTimeout(resolve, this.RETRY_DELAY));
      
      try {
        const db = await this.getDB();
        const tx = db.transaction(this.STORE_NAME, 'readwrite');
        const store = tx.objectStore(this.STORE_NAME);

        // Process retry queue in batches
        while (this._retryQueue.length > 0) {
          const batch = this._retryQueue.splice(0, this.MAX_BATCH_SIZE);
          const promises = batch.map(log => 
            new Promise((resolve, reject) => {
              const request = store.add(log);
              request.onsuccess = () => resolve();
              request.onerror = () => reject(request.error);
            })
          );

          await Promise.all(promises);
        }

        break; // Success - exit retry loop
      } catch (error) {
        retryCount++;
        if (retryCount >= this.MAX_RETRIES) {
          originalConsole.error('Max retries reached, some logs may be lost:', error);
        }
      }
    }

    this._processingRetries = false;
  }

  static generateUniqueId() {
    const timestamp = Date.now();
    if (timestamp <= this._lastTimestamp) {
      // If we get the same timestamp, increment last value
      this._lastTimestamp++;
    } else {
      this._lastTimestamp = timestamp;
    }
    return this._lastTimestamp;
  }

  static queueLog(level, messages, source) {
    const logEntry = {
      id: this.generateUniqueId(),  // Add unique id
      timestamp: Date.now(),
      level,
      message: messages,
      source
    };

    // Add to memory queue
    this._memoryQueue.push(logEntry);

    // Schedule immediate flush for errors
    if (level === 'error') {
      this.flushQueue(true);
      return;
    }

    // Schedule flush if queue is getting full
    if (this._memoryQueue.length >= this.MAX_QUEUE_SIZE) {
      this.flushQueue();
      return;
    }

    // If no flush is scheduled, schedule one
    if (this._flushInterval === null) {
      this._flushInterval = setInterval(() => {
        this.flushQueue();
      }, this.FLUSH_INTERVAL);
    }
  }

  static async getLogs() {
    // Force flush any pending logs
    await this.flushQueue(true);
    
    try {
      const db = await this.getDB();
      const tx = db.transaction(this.STORE_NAME, 'readonly');
      const store = tx.objectStore(this.STORE_NAME);
      
      // Use getAll() which returns records in insertion order
      return new Promise((resolve, reject) => {
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      originalConsole.error('Failed to get logs:', error);
      return [];
    }
  }

  static async clearLogs() {
    // Clear memory queue first
    this._memoryQueue = [];
    try {
      const db = await this.getDB();
      const tx = db.transaction(this.STORE_NAME, 'readwrite');
      const store = tx.objectStore(this.STORE_NAME);
      await store.clear();
    } catch (error) {
      console.error('Failed to clear logs:', error);
    }
  }

  // Update forceSave to handle retry queue
  static async forceSave() {
    clearInterval(this._flushInterval);
    await this.flushQueue(true);
    
    // Try to save any remaining retry queue items
    if (this._retryQueue.length > 0) {
      await this.scheduleRetry();
    }
  }

  static async saveState() {
    // Force save any pending logs
    await this.flushQueue(true);
  }
}

// Store original console methods
const originalConsole = {
  log: console.log.bind(console),
  warn: console.warn.bind(console),
  error: console.error.bind(console)
};

// Shared processing function
const processValue = (arg) => {
  if (arg === undefined) return '"undefined"';
  if (arg === null) return '"null"';
  if (arg === '') return '""';
  if (typeof arg === 'object') {
    try {
      // Handle empty objects/arrays
      return Object.keys(arg).length === 0 ? 
             (Array.isArray(arg) ? '[]' : '{}') : 
             JSON.stringify(arg, null, 2);
    } catch (e) {
      return String(arg);
    }
  }
  return String(arg);
};

// Helper to get current script source
const getCurrentSource = () => {
  // Check if we're in a service worker context more safely
  try {
    if (typeof self !== 'undefined' && 
        typeof ServiceWorkerGlobalScope !== 'undefined' && 
        self instanceof ServiceWorkerGlobalScope) {
      return 'service-worker.js';
    }
  } catch (e) {
    // Ignore error - not in service worker context
  }

  // Try to detect source from URL if available
  try {
    const currentScript = document.currentScript;
    if (currentScript && currentScript.src) {
      const scriptName = currentScript.src.split('/').pop();
      return scriptName;
    }
  } catch (e) {
    // Ignore error - can't get script source
  }

  // Default fallback
  return 'app.js';
};

// Override console methods to show logs and use queue
console.log = (...args) => {
  originalConsole.log(...args);  // Show in console immediately
  if (!args.some(arg => String(arg).includes('favicon.ico'))) {
    const processedArgs = args.map(processValue);
    const source = { __source: getCurrentSource() };
    Logger.queueLog('info', processedArgs, source.__source);
  }
};

console.warn = (...args) => {
  originalConsole.warn(...args);  // Show in console immediately
  const processedArgs = args.map(processValue);
  const source = { __source: getCurrentSource() };
  Logger.queueLog('warn', processedArgs, source.__source);
};

console.error = (...args) => {
  originalConsole.error(...args);  // Already showing errors
  const processedArgs = args.map(processValue);
  const source = { __source: getCurrentSource() };
  Logger.queueLog('error', processedArgs, source.__source);
};

// Consolidate these handlers - they're duplicated in initDB() and at bottom of file
if (typeof window !== 'undefined') {
  // Handle page unload and visibility in one place
  window.addEventListener('unload', () => Logger.forceSave());
  window.addEventListener('beforeunload', () => Logger.forceSave());
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') Logger.forceSave();
  });
}

// In service worker context
if (typeof ServiceWorkerGlobalScope !== 'undefined' && self instanceof ServiceWorkerGlobalScope) {
  self.addEventListener('unload', async () => {
    await Logger.forceSave();
  });
}
