from fastapi import APIRouter, HTTPException
from pathlib import Path
import logging

from models.schemas import ExportJianyingRequest, ExportJianyingResponse
from core.storage import storage
from core.jianying_exporter import JianyingExporter
from config import settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["export"])


@router.post("/projects/{project_id}/export/jianying", response_model=ExportJianyingResponse)
async def export_jianying(project_id: str, request: ExportJianyingRequest):
    """导出项目为剪映草稿"""

    # 加载全局设置
    global_settings = storage.load_global_settings()
    draft_path = global_settings.jianying.draftPath or settings.jianying_draft_path

    if not draft_path:
        raise HTTPException(
            status_code=400,
            detail="请先在设置中配置剪映草稿保存路径"
        )

    draft_base_path = Path(draft_path)

    # 验证草稿路径
    try:
        draft_base_path.mkdir(parents=True, exist_ok=True)
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"无法访问剪映草稿路径: {e}"
        )

    # 加载项目
    project = storage.load_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")

    project_dir = storage._get_project_dir(project_id)

    # 初始化导出器
    template_dir = Path(__file__).parent.parent / "core" / "assets" / "jianying_template"

    if not template_dir.exists():
        raise HTTPException(
            status_code=500,
            detail="剪映模板文件不存在"
        )

    exporter = JianyingExporter(template_dir, draft_base_path)

    try:
        # 执行导出
        result = exporter.export_project(project, project_dir)

        return ExportJianyingResponse(
            exportId=result["draft_id"],
            status="success",
            draftPath=result["draft_path"]
        )

    except Exception as e:
        logger.error(f"导出失败: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"导出失败: {str(e)}"
        )
