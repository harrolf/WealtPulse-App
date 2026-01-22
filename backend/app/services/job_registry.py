import datetime
from typing import Dict, Optional, List, Any
from enum import Enum
import threading


class JobStatus(str, Enum):
    RUNNING = "running"
    IDLE = "idle"
    FAILED = "failed"
    WAITING = "waiting"


class JobInfo:
    def __init__(self, name: str, status: JobStatus = JobStatus.IDLE):
        self.name = name
        self.status = status
        self.last_run: Optional[datetime.datetime] = None
        self.next_run: Optional[datetime.datetime] = None
        self.last_error: Optional[str] = None
        self.metadata: Dict[str, Any] = {}


class JobRegistry:
    _instance = None
    _jobs: Dict[str, JobInfo] = {}
    _lock = threading.Lock()

    @classmethod
    def get_instance(cls):
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def register_job(self, name: str):
        with self._lock:
            if name not in self._jobs:
                self._jobs[name] = JobInfo(name)

    def update_job(
        self,
        name: str,
        status: Optional[str] = None,
        last_run: Optional[datetime.datetime] = None,
        next_run: Optional[datetime.datetime] = None,
        error: Optional[str] = None,
        metadata: Optional[Dict] = None,
    ):
        with self._lock:
            if name not in self._jobs:
                self._jobs[name] = JobInfo(name)

            job = self._jobs[name]
            if status:
                job.status = status
            if last_run:
                job.last_run = last_run
            if next_run:
                job.next_run = next_run
            if error is not None:
                job.last_error = error  # Allow clearing error with empty string if needed, or None to ignore
            if metadata:
                job.metadata.update(metadata)

    def get_all_jobs(self) -> List[Dict]:
        with self._lock:
            return [
                {
                    "name": j.name,
                    "status": j.status,
                    "last_run": j.last_run.isoformat() if j.last_run else None,
                    "next_run": j.next_run.isoformat() if j.next_run else None,
                    "last_error": j.last_error,
                    "metadata": j.metadata,
                }
                for j in self._jobs.values()
            ]


def get_job_registry():
    return JobRegistry.get_instance()
