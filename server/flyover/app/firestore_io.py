"""Firestore async-job state — STAGE C.

Stage B is synchronous: POST /render blocks until the MP4 is ready and returns it
in the response. Stage C will switch to async jobs:
  POST /render → returns { jobId } immediately, writes flyoverJobs/{jobId} = queued
  Worker:        updates flyoverJobs/{jobId} as it progresses; SPA listens via onSnapshot.
"""
from __future__ import annotations

# Placeholder — Stage C populates this module with:
#
#   from google.cloud import firestore
#
#   def write_status(job_id: str, status: str, *, progress: float | None = None,
#                    download_url: str | None = None, uid: str | None = None) -> None:
#       client = firestore.Client()
#       doc = {"status": status, "updatedAt": firestore.SERVER_TIMESTAMP}
#       if progress is not None: doc["progress"] = progress
#       if download_url is not None: doc["downloadUrl"] = download_url
#       if uid is not None: doc["uid"] = uid
#       client.collection("flyoverJobs").document(job_id).set(doc, merge=True)
