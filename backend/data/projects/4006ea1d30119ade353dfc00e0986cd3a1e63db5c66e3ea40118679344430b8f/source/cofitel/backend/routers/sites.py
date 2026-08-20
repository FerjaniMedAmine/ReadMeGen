from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text
 
from dependencies import get_db
 
 
router = APIRouter(
    tags=["Sites"]
)
 
 
@router.get("/sites")
def get_sites(db: Session = Depends(get_db)):
    result = db.execute(text("""
        SELECT id, name
        FROM sites
        ORDER BY name
    """))
 
    sites = [dict(row) for row in result.mappings().all()]
    return sites
 