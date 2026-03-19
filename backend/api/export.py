from fastapi import APIRouter, HTTPException

router = APIRouter(prefix="/api", tags=["export"])

# 剪映导出功能暂时禁用 - 待找到合适参考后重新实现
# @router.post("/projects/{project_id}/export/jianying")
# async def export_jianying(project_id: str):
#     raise HTTPException(status_code=501, detail="Jianying export temporarily disabled")
