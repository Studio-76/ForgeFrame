"""Plugin registry and instance binding domain."""

from app.plugins.models import (
    CreatePluginManifest,
    InstancePluginBindingRecord,
    PluginCatalogEntry,
    PluginCatalogSummary,
    PluginManifestRecord,
    PluginRegistryStateRecord,
    PluginSecurityPosture,
    UpdatePluginManifest,
    UpsertPluginBinding,
)

__all__ = [
    "CreatePluginManifest",
    "InstancePluginBindingRecord",
    "PluginCatalogEntry",
    "PluginCatalogService",
    "PluginCatalogSummary",
    "PluginManifestRecord",
    "PluginRegistryStateRecord",
    "PluginSecurityPosture",
    "UpdatePluginManifest",
    "UpsertPluginBinding",
    "PluginCatalogService",
    "clear_plugin_catalog_service_cache",
    "get_plugin_catalog_service",
]


def __getattr__(name: str):
    if name in {
        "PluginCatalogService",
        "clear_plugin_catalog_service_cache",
        "get_plugin_catalog_service",
    }:
        from app.plugins.dependencies import (
            PluginCatalogService,
            clear_plugin_catalog_service_cache,
            get_plugin_catalog_service,
        )

        exports = {
            "PluginCatalogService": PluginCatalogService,
            "clear_plugin_catalog_service_cache": clear_plugin_catalog_service_cache,
            "get_plugin_catalog_service": get_plugin_catalog_service,
        }
        return exports[name]
    raise AttributeError(name)
