# app/constants.py

# Single source of truth: MIME type → file extension (no dot)
IMAGE_TYPE_MAP = {
    "image/jpeg": "jpg",
    "image/png":  "png",
    "image/webp": "webp",
}

ALLOWED_CONTENT_TYPES = set(IMAGE_TYPE_MAP.keys())

# Reverse lookup for storage: ".ext" → MIME type
CONTENT_TYPE_FROM_EXT = {
    f".{ext}": mime for mime, ext in IMAGE_TYPE_MAP.items()
}

MAX_PHOTO_SIZE = 5 * 1024 * 1024  # 5 MB