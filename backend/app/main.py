"""
FastAPI app instance, router includes
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.database import init_db


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield


app = FastAPI(title="OHP — Oral Health Providers", lifespan=lifespan)


@app.get("/api/health")
async def health_check():
    return {"status": "ok"}
