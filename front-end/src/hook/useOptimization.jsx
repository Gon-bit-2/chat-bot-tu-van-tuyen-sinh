import React from "react";

/**
 * Custom hook để debounce một giá trị
 * Giảm số lần re-render khi giá trị thay đổi liên tục
 */
export const useDebounce = (value, delay = 300) => {
  const [debouncedValue, setDebouncedValue] = React.useState(value);

  React.useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
};

/**
 * Custom hook để throttle một function
 * Giới hạn số lần function được gọi trong một khoảng thời gian
 */
export const useThrottle = (callback, delay = 300) => {
  const lastRan = React.useRef(Date.now());

  return React.useCallback(
    (...args) => {
      if (Date.now() - lastRan.current >= delay) {
        callback(...args);
        lastRan.current = Date.now();
      }
    },
    [callback, delay]
  );
};

/**
 * REMOVED: useMemoizedValue - không cần thiết, dùng useMemo trực tiếp
 * Example: const value = useMemo(() => computeExpensiveValue(), [deps]);
 */

/**
 * Custom hook để cancel request khi component unmount
 */
export const useAbortController = () => {
  const abortControllerRef = React.useRef(null);

  React.useEffect(() => {
    abortControllerRef.current = new AbortController();

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const getSignal = () => abortControllerRef.current?.signal;

  const abort = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = new AbortController();
    }
  };

  return { getSignal, abort };
};

/**
 * Custom hook để cache data trong memory với expiry time
 */
export const useCache = (initialData = {}, ttl = 60000) => {
  const [cache, setCache] = React.useState(initialData);
  const expiryMap = React.useRef(new Map());

  const set = React.useCallback(
    (key, value) => {
      setCache((prev) => ({ ...prev, [key]: value }));
      expiryMap.current.set(key, Date.now() + ttl);
    },
    [ttl]
  );

  const get = React.useCallback(
    (key) => {
      const expiry = expiryMap.current.get(key);
      if (expiry && Date.now() > expiry) {
        // Expired
        expiryMap.current.delete(key);
        setCache((prev) => {
          const newCache = { ...prev };
          delete newCache[key];
          return newCache;
        });
        return null;
      }
      return cache[key];
    },
    [cache]
  );

  const clear = React.useCallback((key) => {
    if (key) {
      setCache((prev) => {
        const newCache = { ...prev };
        delete newCache[key];
        return newCache;
      });
      expiryMap.current.delete(key);
    } else {
      setCache({});
      expiryMap.current.clear();
    }
  }, []);

  const has = React.useCallback(
    (key) => {
      const expiry = expiryMap.current.get(key);
      return (
        expiry &&
        Date.now() <= expiry &&
        Object.prototype.hasOwnProperty.call(cache, key)
      );
    },
    [cache]
  );

  return { get, set, clear, has, cache };
};

export default {
  useDebounce,
  useThrottle,
  useAbortController,
  useCache,
};
