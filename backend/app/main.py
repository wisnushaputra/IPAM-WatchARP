import json
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import Base, engine
from app.routers import ips, subnets


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(
    title="WatchARP IPAM",
    description="Lightweight IP Address Management with Active ARP Scanner",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS configuration
default_origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]
cors_env = os.getenv("CORS_ORIGINS")
if cors_env:
    try:
        origins = json.loads(cors_env) if cors_env.strip().startswith("[") else [o.strip() for o in cors_env.split(",") if o.strip()]
    except Exception:
        origins = default_origins
else:
    origins = default_origins

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(subnets.router)
app.include_router(ips.router)


@app.get("/api/health", tags=["system"])
def health_check():
    return {"status": "ok"}
