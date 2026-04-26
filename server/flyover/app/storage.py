"""Firebase Storage upload — STAGE C.

Stage B returns the rendered MP4 directly in the HTTP response (in-memory roundtrip).
Stage C will upload the MP4 to gs://promogroup.firebasestorage.app/users/{uid}/flyovers/{jobId}.mp4
and return a 30-day signed URL via the Firestore job document.
"""
from __future__ import annotations

# Placeholder — Stage C populates this module with:
#
#   from google.cloud import storage
#   from datetime import timedelta
#
#   def upload_and_sign(bucket_name: str, uid: str, job_id: str, local_path: Path) -> str:
#       client = storage.Client()
#       bucket = client.bucket(bucket_name)
#       blob = bucket.blob(f"users/{uid}/flyovers/{job_id}.mp4")
#       blob.upload_from_filename(str(local_path), content_type="video/mp4")
#       return blob.generate_signed_url(version="v4", expiration=timedelta(days=30))
