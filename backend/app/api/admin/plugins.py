"""Admin routes for plugin registry and instance-bound plugin bindings."""

from __future__ import annotations

from fastapi import APIRouter, Depends, status
from fastapi.responses import JSONResponse

from app.api.admin.instance_scope import resolve_admin_instance_scope
from app.api.admin.security import (
    require_admin_instance_permission,
    require_admin_mutation_role,
)
from app.governance.models import AuthenticatedAdmin
from app.instances.models import InstanceRecord
from app.plugins.dependencies import PluginCatalogService, get_plugin_catalog_service
from app.plugins.models import (
    CreatePluginManifest,
    UpdatePluginManifest,
    UpsertPluginBinding,
)

router = APIRouter(prefix="/plugins", tags=["admin-plugins"])


def _error(status_code: int, error_type: str, message: str) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content={"error": {"type": error_type, "message": message}},
    )


@router.get("")
def list_plugins(
    _admin: AuthenticatedAdmin = Depends(require_admin_instance_permission("instance.read")),
    instance: InstanceRecord = Depends(resolve_admin_instance_scope),
    service: PluginCatalogService = Depends(get_plugin_catalog_service),
) -> dict[str, object]:
    """
    List all plugins available to the current instance.

    :param _admin: Injected authentication/admin dependency
    :type _admin: AuthenticatedAdmin
    :param instance: The resolved instance record
    :type instance: InstanceRecord
    :param service: Injected plugin catalog service
    :type service: PluginCatalogService
    :return: Status, instance data, summary, and list of plugins
    :rtype: dict[str, object]
    """
    plugins, summary = service.list_plugins(instance=instance)
    return {
        "status": "ok",
        "instance": instance.model_dump(mode="json"),
        "summary": summary.model_dump(mode="json"),
        "plugins": [item.model_dump(mode="json") for item in plugins],
    }


@router.get("/{plugin_id}")
def get_plugin(
    plugin_id: str,
    _admin: AuthenticatedAdmin = Depends(require_admin_instance_permission("instance.read")),
    instance: InstanceRecord = Depends(resolve_admin_instance_scope),
    service: PluginCatalogService = Depends(get_plugin_catalog_service),
) -> object:
    """
    Retrieve a single plugin by its ID.

    :param plugin_id: Unique identifier of the plugin
    :type plugin_id: str
    :param _admin: Injected authentication/admin dependency
    :type _admin: AuthenticatedAdmin
    :param instance: The resolved instance record
    :type instance: InstanceRecord
    :param service: Injected plugin catalog service
    :type service: PluginCatalogService
    :return: Status, instance data, and plugin data
    :rtype: object
    :raises ValueError: If the plugin is not found, returns a 404 error response
    """
    try:
        plugin = service.get_plugin(instance=instance, plugin_id=plugin_id)
    except ValueError as exc:
        return _error(status.HTTP_404_NOT_FOUND, "plugin_not_found", str(exc))
    return {
        "status": "ok",
        "instance": instance.model_dump(mode="json"),
        "plugin": plugin.model_dump(mode="json"),
    }


@router.post("", status_code=status.HTTP_201_CREATED)
def create_plugin(
    payload: CreatePluginManifest,
    _admin: AuthenticatedAdmin = Depends(require_admin_mutation_role("admin")),
    service: PluginCatalogService = Depends(get_plugin_catalog_service),
) -> object:
    """
    Register a new plugin manifest in the catalog.

    :param payload: Plugin manifest creation payload
    :type payload: CreatePluginManifest
    :param _admin: Injected authentication/admin dependency
    :type _admin: AuthenticatedAdmin
    :param service: Injected plugin catalog service
    :type service: PluginCatalogService
    :return: Status and created plugin data
    :rtype: object
    :raises ValueError: If the plugin already exists or the manifest is invalid
    """
    try:
        plugin = service.create_plugin(payload)
    except ValueError as exc:
        error_type = "plugin_conflict" if "already exists" in str(exc) else "plugin_invalid"
        error_status = status.HTTP_409_CONFLICT if error_type == "plugin_conflict" else status.HTTP_400_BAD_REQUEST
        return _error(error_status, error_type, str(exc))
    return {"status": "ok", "plugin": plugin.model_dump(mode="json")}


@router.patch("/{plugin_id}")
def update_plugin(
    plugin_id: str,
    payload: UpdatePluginManifest,
    _admin: AuthenticatedAdmin = Depends(require_admin_mutation_role("admin")),
    service: PluginCatalogService = Depends(get_plugin_catalog_service),
) -> object:
    """
    Update an existing plugin manifest.

    :param plugin_id: Unique identifier of the plugin to update
    :type plugin_id: str
    :param payload: Plugin manifest update payload
    :type payload: UpdatePluginManifest
    :param _admin: Injected authentication/admin dependency
    :type _admin: AuthenticatedAdmin
    :param service: Injected plugin catalog service
    :type service: PluginCatalogService
    :return: Status and updated plugin data
    :rtype: object
    :raises ValueError: If the plugin is not found or the update is invalid
    """
    try:
        plugin = service.update_plugin(plugin_id, payload)
    except ValueError as exc:
        error_type = "plugin_not_found" if "was not found" in str(exc) else "plugin_invalid"
        error_status = status.HTTP_404_NOT_FOUND if error_type == "plugin_not_found" else status.HTTP_400_BAD_REQUEST
        return _error(error_status, error_type, str(exc))
    return {"status": "ok", "plugin": plugin.model_dump(mode="json")}


@router.put("/{plugin_id}/binding")
def upsert_plugin_binding(
    plugin_id: str,
    payload: UpsertPluginBinding,
    _admin: AuthenticatedAdmin = Depends(require_admin_mutation_role("admin")),
    instance: InstanceRecord = Depends(resolve_admin_instance_scope),
    service: PluginCatalogService = Depends(get_plugin_catalog_service),
) -> object:
    """
    Create or update the plugin binding for the current instance.

    :param plugin_id: Unique identifier of the plugin
    :type plugin_id: str
    :param payload: Plugin binding payload
    :type payload: UpsertPluginBinding
    :param _admin: Injected authentication/admin dependency
    :type _admin: AuthenticatedAdmin
    :param instance: The resolved instance record
    :type instance: InstanceRecord
    :param service: Injected plugin catalog service
    :type service: PluginCatalogService
    :return: Status, instance data, and plugin data with binding
    :rtype: object
    :raises ValueError: If the plugin is not found or the binding is invalid
    """
    try:
        plugin = service.upsert_binding(instance=instance, plugin_id=plugin_id, payload=payload)
    except ValueError as exc:
        error_type = "plugin_not_found" if "was not found" in str(exc) else "plugin_binding_invalid"
        error_status = status.HTTP_404_NOT_FOUND if error_type == "plugin_not_found" else status.HTTP_400_BAD_REQUEST
        return _error(error_status, error_type, str(exc))
    return {
        "status": "ok",
        "instance": instance.model_dump(mode="json"),
        "plugin": plugin.model_dump(mode="json"),
    }


__all__ = ["router"]
