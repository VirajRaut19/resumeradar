import redis
import os
import json
import hashlib

redis_client = redis.Redis(
    host=os.getenv("REDIS_HOST", "localhost"),
    port=int(os.getenv("REDIS_PORT", 6379)),
    db=0,
    decode_responses=True
)

def make_cache_key(resume_id: str, jd_text: str) -> str:
    jd_hash = hashlib.sha256(jd_text.encode()).hexdigest()[:16]
    return f"match:{resume_id}:{jd_hash}"

def get_cached_result(resume_id: str, jd_text: str):
    key = make_cache_key(resume_id, jd_text)
    try:
        cached = redis_client.get(key)
        if cached:
            print(f">>> Cache HIT for key: {key}")
            return json.loads(cached)
        print(f">>> Cache MISS for key: {key}")
        return None
    except Exception as e:
        print(f">>> Redis error (get): {e}")
        return None

def set_cached_result(resume_id: str, jd_text: str, result: dict, ttl: int = 3600):
    key = make_cache_key(resume_id, jd_text)
    try:
        redis_client.setex(key, ttl, json.dumps(result))
        print(f">>> Cached result for key: {key} (TTL: {ttl}s)")
    except Exception as e:
        print(f">>> Redis error (set): {e}")