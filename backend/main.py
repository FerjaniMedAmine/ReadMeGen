from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from core.config import PROJECTS_DIR
from routers.ingestion import router as ingestion_router

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(ingestion_router)


