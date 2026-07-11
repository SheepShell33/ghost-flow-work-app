from fastapi import APIRouter

from .endpoints.connections import router as connections_router
from .endpoints.tasks import router as tasks_router
from .endpoints.task_runs import router as task_runs_router
from .endpoints.execute import router as execute_router
from .endpoints.schedules import router as schedules_router

api_router = APIRouter()
api_router.include_router(connections_router)
api_router.include_router(tasks_router)
api_router.include_router(task_runs_router)
api_router.include_router(execute_router)
api_router.include_router(schedules_router)
