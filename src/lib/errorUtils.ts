// Utility to prevent spamming Sentry with repeated errors
const errorCache = new Map<string, number>();
const MAX_ERRORS_PER_MESSAGE = 3;
const CACHE_RESET_TIME = 60000; // 1 minute

// Reset cache periodically
setInterval(() => {
  errorCache.clear();
}, CACHE_RESET_TIME);

export function logError(message: string, error?: any) {
  const errorKey = message + (error?.message || '');
  const currentCount = errorCache.get(errorKey) || 0;
  
  if (currentCount < MAX_ERRORS_PER_MESSAGE) {
    console.error(message, error);
    errorCache.set(errorKey, currentCount + 1);
  }
}

export function logWarning(message: string, error?: any) {
  const errorKey = message + (error?.message || '');
  const currentCount = errorCache.get(errorKey) || 0;
  
  if (currentCount < MAX_ERRORS_PER_MESSAGE) {
    console.warn(message, error);
    errorCache.set(errorKey, currentCount + 1);
  }
}