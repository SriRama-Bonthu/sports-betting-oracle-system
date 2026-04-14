async function withRetry(task, options = {}) {
  const retries = options.retries ?? 3;
  const baseDelayMs = options.baseDelayMs ?? 300;

  let attempt = 0;
  let lastError;

  while (attempt <= retries) {
    try {
      return await task();
    } catch (error) {
      lastError = error;
      if (attempt === retries) {
        break;
      }

      const delay = baseDelayMs * (2 ** attempt);
      await new Promise((resolve) => setTimeout(resolve, delay));
      attempt += 1;
    }
  }

  throw lastError;
}

module.exports = { withRetry };
