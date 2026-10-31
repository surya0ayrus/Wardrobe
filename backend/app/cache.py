"""Small cache used for dropdown lists and login throttling.

In-memory by default; Redis when CACHE_STORE=redis (use Redis in production when several
worker processes run, so a cleared list is cleared everywhere)."""
import json
import threading
import time
from typing import Any, Callable

from app.config import settings


class MemoryStore:
    def __init__(self) -> None:
        self._data: dict[str, tuple[Any, float | None]] = {}
        self._lock = threading.Lock()

    def get(self, key: str) -> Any:
        with self._lock:
            item = self._data.get(key)
            if not item:
                return None
            value, expires = item
            if expires is not None and expires < time.time():
                del self._data[key]
                return None
            return value

    def set(self, key: str, value: Any, ttl: int | None = None) -> None:
        with self._lock:
            self._data[key] = (value, time.time() + ttl if ttl else None)

    def forget(self, key: str) -> None:
        with self._lock:
            self._data.pop(key, None)

    def incr(self, key: str, ttl: int) -> int:
        with self._lock:
            item = self._data.get(key)
            if item and (item[1] is None or item[1] >= time.time()):
                count = item[0] + 1
                self._data[key] = (count, item[1])
            else:
                count = 1
                self._data[key] = (1, time.time() + ttl)
            return count

    def ttl(self, key: str) -> int:
        item = self._data.get(key)
        return max(int(item[1] - time.time()), 0) if item and item[1] else 0

    def flush(self) -> None:
        with self._lock:
            self._data.clear()


class RedisStore:
    def __init__(self) -> None:
        import redis

        self._r = redis.Redis(
            host=settings.redis_host, port=settings.redis_port,
            password=settings.redis_password or None, decode_responses=True,
        )
        self._prefix = settings.redis_prefix + "cache:"

    def get(self, key: str) -> Any:
        raw = self._r.get(self._prefix + key)
        return None if raw is None else json.loads(raw)

    def set(self, key: str, value: Any, ttl: int | None = None) -> None:
        self._r.set(self._prefix + key, json.dumps(value), ex=ttl)

    def forget(self, key: str) -> None:
        self._r.delete(self._prefix + key)

    def incr(self, key: str, ttl: int) -> int:
        k = self._prefix + key
        count = self._r.incr(k)
        if count == 1:
            self._r.expire(k, ttl)
        return int(count)

    def ttl(self, key: str) -> int:
        return max(int(self._r.ttl(self._prefix + key)), 0)

    def flush(self) -> None:
        for k in self._r.scan_iter(self._prefix + "*"):
            self._r.delete(k)


store: MemoryStore | RedisStore = RedisStore() if settings.cache_store == "redis" else MemoryStore()


def remember(key: str, ttl: int, fn: Callable[[], Any]) -> Any:
    value = store.get(key)
    if value is None:
        value = fn()
        store.set(key, value, ttl)
    return value


def forget(key: str) -> None:
    store.forget(key)


def has(key: str) -> bool:
    return store.get(key) is not None
