#!/usr/bin/env python3
"""Export IFC metadata (spatial tree, psets, quantities, materials, ...) to JSON.

Companion to IfcConvert: glTF cannot hold IFC property sets, so the geometry
goes to GLB (converted with --use-element-guids, so node names == IFC GlobalId)
and everything else goes to <name>_ifc.json, keyed by GlobalId.

Usage: ifc_metadata.py input.ifc output.json
Requires: pip install ifcopenshell
"""
import json
import sys

import ifcopenshell
import ifcopenshell.util.element as element_util


def plain(value):
    """Convert IfcOpenShell values to JSON-serialisable ones."""
    if isinstance(value, ifcopenshell.entity_instance):
        return {"type": value.is_a(), "id": value.id(), "guid": getattr(value, "GlobalId", None)}
    if isinstance(value, dict):
        return {str(k): plain(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [plain(v) for v in value]
    return value


def ref(entity):
    return getattr(entity, "GlobalId", None) if entity is not None else None


def describe(entity):
    data = {
        "type": entity.is_a(),
        "name": getattr(entity, "Name", None),
        "description": getattr(entity, "Description", None),
        "objectType": getattr(entity, "ObjectType", None),
        "predefinedType": getattr(entity, "PredefinedType", None),
        "tag": getattr(entity, "Tag", None),
    }
    psets = element_util.get_psets(entity)  # psets + quantities, incl. type psets
    if psets:
        data["psets"] = plain(psets)
    type_obj = element_util.get_type(entity)
    if type_obj is not None:
        data["typeRef"] = {"guid": ref(type_obj), "name": getattr(type_obj, "Name", None)}
    material = element_util.get_material(entity)
    if material is not None:
        data["material"] = getattr(material, "Name", None) or material.is_a()
    container = element_util.get_container(entity)
    if container is not None:
        data["container"] = ref(container)
    return {k: v for k, v in data.items() if v not in (None, "", [], {})}


def spatial_tree(entity):
    """Walk IfcRelAggregates / IfcRelContainedInSpatialStructure one level at a time."""
    node = {"guid": ref(entity), "type": entity.is_a(), "name": getattr(entity, "Name", None)}
    children = []
    for rel in getattr(entity, "IsDecomposedBy", None) or []:
        children += [spatial_tree(c) for c in rel.RelatedObjects]
    for rel in getattr(entity, "ContainsElements", None) or []:
        children += [spatial_tree(c) for c in rel.RelatedElements]
    if children:
        node["children"] = children
    return node


def main(src, dst):
    model = ifcopenshell.open(src)
    project = model.by_type("IfcProject")[0]
    out = {
        "schema": model.schema,
        "project": {"guid": ref(project), "name": project.Name},
        "tree": spatial_tree(project),
        "elements": {},
    }
    for entity in model.by_type("IfcObjectDefinition"):
        guid = ref(entity)
        if guid:
            out["elements"][guid] = describe(entity)
    with open(dst, "w", encoding="utf-8") as fh:
        json.dump(out, fh, ensure_ascii=False, separators=(",", ":"), default=str)


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2])
