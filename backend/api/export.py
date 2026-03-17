from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from pathlib import Path
import uuid

from models.schemas import Project, ExportJianyingRequest, ExportJianyingResponse
from core.storage import storage
from core.jianying import JianyingGenerator
from config import settings

router = APIRouter(prefix="/api", tags=["export"])

export_tasks = {}

@router.post("/projects/{project_id}/export/jianying", response_model=ExportJianyingResponse)
async def export_jianying(project_id: str, request: ExportJianyingRequest):
    project = storage.load_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    export_id = str(uuid.uuid4())

    try:
        proj_dir = Path(settings.data_dir) / "projects" / project_id
        export_dir = proj_dir / "export"
        export_dir.mkdir(exist_ok=True)

        generator = JianyingGenerator(project, export_dir)
        zip_path = generator.generate()

        export_tasks[export_id] = {
            "status": "ready",
            "zip_path": str(zip_path)
        }

        return ExportJianyingResponse(
            exportId=export_id,
            status="ready",
            downloadUrl=f"/api/projects/{project_id}/export/download?export_id={export_id}"
        )

    except Exception as e:
        return ExportJianyingResponse(
            exportId=export_id,
            status="failed",
            error=str(e)
        )

@router.get("/projects/{project_id}/export/download")
async def download_jianying(project_id: str, export_id: str):
    task = export_tasks.get(export_id)
    if not task or task["status"] != "ready":
        raise HTTPException(status_code=404, detail="Export not found")

    zip_path = Path(task["zip_path"])
    if not zip_path.exists():
        raise HTTPException(status_code=404, detail="Export file not found")

    return FileResponse(
        path=zip_path,
        filename=f"jianying_draft_{project_id[:8]}.zip",
        media_type="application/zip"
    )
