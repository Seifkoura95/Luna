"""
Health check endpoint
"""
from fastapi import APIRouter
from datetime import datetime, timezone

router = APIRouter(tags=["Health"])


@router.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "Luna Group VIP API",
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
