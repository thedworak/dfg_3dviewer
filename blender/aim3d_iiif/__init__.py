# IIIF / AIM3D manifests in Blender: File > Import / Export, and a sidebar
# panel (View3D > Sidebar > AIM3D) for the comments and the stored manifest.

bl_info = {
    "name": "IIIF / AIM3D Manifests",
    "author": "DFG 3D Viewer",
    "version": (0, 1, 0),
    "blender": (4, 0, 0),
    "location": "File > Import / Export, View3D > Sidebar > AIM3D",
    "description": "Import and export IIIF Presentation 4 manifests with the AIM3DViewer block",
    "category": "Import-Export",
}

import bpy
from bpy.props import BoolProperty, StringProperty
from bpy_extras.io_utils import ExportHelper, ImportHelper

from . import exporter, importer, state


def report_all(operator, reports):
    for level, message in reports:
        operator.report({level}, message)


class AIM3D_OT_import_manifest(bpy.types.Operator, ImportHelper):
    """Import a IIIF Presentation 4 / AIM3DViewer manifest"""

    bl_idname = "import_scene.aim3d_manifest"
    bl_label = "Import IIIF / AIM3D Manifest"
    bl_options = {"REGISTER", "UNDO"}

    filename_ext = ".json"
    filter_glob: StringProperty(default="*.json", options={"HIDDEN"})
    url: StringProperty(
        name="URL",
        description="Manifest URL to read instead of the file chosen",
        default="",
    )
    import_models: BoolProperty(
        name="Import models",
        description="Load the model files the manifest paints into its Scene",
        default=True,
    )
    model_base: StringProperty(
        name="Model base",
        description="Folder or URL that relative model paths resolve against "
        "(default: the manifest's folder and its parents)",
        default="",
    )

    def execute(self, context):
        source = self.url.strip() or self.filepath
        try:
            reports = importer.import_manifest(context, source, self.import_models, self.model_base.strip())
        except (OSError, ValueError) as error:
            self.report({"ERROR"}, str(error))
            return {"CANCELLED"}
        report_all(self, reports)
        return {"FINISHED"}


class AIM3D_OT_export_manifest(bpy.types.Operator, ExportHelper):
    """Export the scene as a IIIF Presentation 4 / AIM3DViewer manifest"""

    bl_idname = "export_scene.aim3d_manifest"
    bl_label = "Export IIIF / AIM3D Manifest"

    filename_ext = ".json"
    filter_glob: StringProperty(default="*.json", options={"HIDDEN"})
    write_aim3d: BoolProperty(
        name="AIM3DViewer block",
        description="For a manifest made from the scene: write the view camera, the lights and the model "
        "transform to the AIM3DViewer block (otherwise IIIF cameras and lights only). "
        "An imported manifest keeps its form",
        default=True,
    )
    export_model: BoolProperty(
        name="Export meshes as GLB",
        description="Without an imported manifest: write the scene's meshes next to the manifest "
        "and paint them into its Scene",
        default=True,
    )

    def execute(self, context):
        try:
            reports = exporter.export_manifest(context, self.filepath, self.write_aim3d, self.export_model)
        except (OSError, ValueError) as error:
            self.report({"ERROR"}, str(error))
            return {"CANCELLED"}
        report_all(self, reports)
        return {"FINISHED"}


class AIM3D_OT_add_comment(bpy.types.Operator):
    """Add a comment on the point under the 3D cursor"""

    bl_idname = "aim3d.add_comment"
    bl_label = "Add Comment"
    bl_options = {"REGISTER", "UNDO"}

    def execute(self, context):
        collection = importer.ensure_collection(context.scene, "comment")
        obj = bpy.data.objects.new("Comment", None)
        obj.empty_display_type = "SPHERE"
        obj.empty_display_size = 0.05
        obj.show_name = True
        collection.objects.link(obj)
        obj.location = context.scene.cursor.location
        obj["aim3d_label"] = "Comment"
        obj["aim3d_text"] = ""
        for other in context.selected_objects:
            other.select_set(False)
        obj.select_set(True)
        context.view_layer.objects.active = obj
        return {"FINISHED"}


class AIM3D_PT_sidebar(bpy.types.Panel):
    bl_label = "AIM3D"
    bl_space_type = "VIEW_3D"
    bl_region_type = "UI"
    bl_category = "AIM3D"

    def draw(self, context):
        layout = self.layout
        scene = context.scene
        source = scene.get("aim3d_source")
        layout.label(text=source if source else "No manifest imported", icon="FILE")
        if scene.get("aim3d_manifest"):
            layout.label(text=f"Stored as text: {scene['aim3d_manifest']}", icon="TEXT")
        row = layout.row(align=True)
        row.operator(AIM3D_OT_import_manifest.bl_idname, text="Import", icon="IMPORT")
        row.operator(AIM3D_OT_export_manifest.bl_idname, text="Export", icon="EXPORT")
        layout.operator(AIM3D_OT_add_comment.bl_idname, icon="OUTLINER_OB_EMPTY")

        obj = context.active_object
        if obj is None:
            return
        box = layout.box()
        role = obj.get(state.ROLE)
        box.label(text=f"{obj.name}: {role or 'new'}")
        if obj.get("aim3d_id"):
            box.label(text=obj["aim3d_id"])
        if role == "comment" or "aim3d_label" in obj:
            box.prop(obj, '["aim3d_label"]', text="Label")
            box.prop(obj, '["aim3d_text"]', text="Text")
        if "aim3d_distance" in obj:
            box.prop(obj, '["aim3d_distance"]', text="Target distance")
        if role == "model" and "aim3d_up_axis" in obj:
            box.label(text=f"Up axis: {obj['aim3d_up_axis']}")


def menu_import(self, _context):
    self.layout.operator(AIM3D_OT_import_manifest.bl_idname, text="IIIF / AIM3D Manifest (.json)")


def menu_export(self, _context):
    self.layout.operator(AIM3D_OT_export_manifest.bl_idname, text="IIIF / AIM3D Manifest (.json)")


CLASSES = (AIM3D_OT_import_manifest, AIM3D_OT_export_manifest, AIM3D_OT_add_comment, AIM3D_PT_sidebar)


def register():
    for cls in CLASSES:
        bpy.utils.register_class(cls)
    bpy.types.TOPBAR_MT_file_import.append(menu_import)
    bpy.types.TOPBAR_MT_file_export.append(menu_export)


def unregister():
    bpy.types.TOPBAR_MT_file_export.remove(menu_export)
    bpy.types.TOPBAR_MT_file_import.remove(menu_import)
    for cls in reversed(CLASSES):
        bpy.utils.unregister_class(cls)
