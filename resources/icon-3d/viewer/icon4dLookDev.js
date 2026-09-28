// Hand refinements applied on top of the generated factory (createIcon4dEmblemModel.ts).
// Every value here is recorded in object-sculpt-spec.json (geometryDescriptor.edgeTreatment,
// materials[].textureProjection / emissive / opacity, lightingFromPhoto) so the generated
// code is never the only copy of a reconstruction decision.
import * as THREE from 'three';
const ORDER = ['none', 'form', 'material', 'lighting', 'interaction', 'optimization'];
const atLeast = (stage, min) => ORDER.indexOf(stage) >= ORDER.indexOf(min);
// Reference camera (referenceCamera in the spec): vertical FOV 60, at (0, 0, 11) looking at the origin.
export const REFERENCE_CAMERA = { fov: 60, position: new THREE.Vector3(0, 0, 11), target: new THREE.Vector3(0, 0, 0) };
export function createReferenceCamera(aspect = 1) {
    const camera = new THREE.PerspectiveCamera(REFERENCE_CAMERA.fov, aspect, 0.1, 100);
    camera.position.copy(REFERENCE_CAMERA.position);
    camera.lookAt(REFERENCE_CAMERA.target);
    camera.updateMatrixWorld();
    return camera;
}
const GLYPH_BEVEL = { thickness: 0.035, size: 0.03, segments: 3 };
function componentOf(mesh) {
    return mesh.userData.sculptComponent;
}
// Form: glyph caps get a real rounded bevel (spec edgeTreatment chamfer), keeping the outline
// and the front-cap plane where the blockout measured them (bevelOffset = -size, depth shrunk).
function bevelGlyph(mesh) {
    const profile = componentOf(mesh)?.geometryDescriptor?.profile2D;
    if (!profile)
        return;
    const shape = new THREE.Shape(profile.points.map(([x, y]) => new THREE.Vector2(x, y)));
    for (const loop of profile.holes ?? [])
        shape.holes.push(new THREE.Path(loop.map(([x, y]) => new THREE.Vector2(x, y))));
    const geometry = new THREE.ExtrudeGeometry(shape, {
        depth: profile.depth - 2 * GLYPH_BEVEL.thickness,
        bevelEnabled: true,
        bevelThickness: GLYPH_BEVEL.thickness,
        bevelSize: GLYPH_BEVEL.size,
        bevelOffset: -GLYPH_BEVEL.size,
        bevelSegments: GLYPH_BEVEL.segments,
        curveSegments: 12,
    });
    geometry.translate(0, 0, GLYPH_BEVEL.thickness);
    mesh.geometry.dispose();
    mesh.geometry = geometry;
}
// Material: true projective texturing. The reference camera's view-projection is applied per
// fragment (not per vertex), so the print stays undistorted on large triangles and from any orbit.
function projectedPrint(map, restMatrix, options) {
    const camera = createReferenceCamera();
    // projector = reference camera x the part's rest pose, so the print stays glued to the part when it moves
    const projector = new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse).multiply(restMatrix);
    // The artwork is the albedo AND its own lighting, so it is emitted as-is (black base, not tone
    // mapped); the clearcoat/environment then adds the glossy response on top.
    const material = new THREE.MeshPhysicalMaterial({ color: 0x000000, emissive: 0xffffff, emissiveMap: map, toneMapped: false, ...options });
    material.onBeforeCompile = (shader) => {
        shader.uniforms.refProjector = { value: projector };
        shader.vertexShader = shader.vertexShader
            .replace('void main() {', 'uniform mat4 refProjector;\nvarying vec4 vRefClip;\nvoid main() {')
            .replace('#include <project_vertex>', '#include <project_vertex>\nvRefClip = refProjector * vec4( transformed, 1.0 );');
        shader.fragmentShader = shader.fragmentShader
            .replace('void main() {', 'varying vec4 vRefClip;\nvoid main() {\nvec2 refUv = vRefClip.xy / vRefClip.w * 0.5 + 0.5;')
            .replace('#include <emissivemap_fragment>', THREE.ShaderChunk.emissivemap_fragment.replace('vEmissiveMapUv', 'refUv'));
    };
    return material;
}
function disposeMaterial(material) {
    for (const value of Object.values(material))
        if (value instanceof THREE.Texture)
            value.dispose();
    material.dispose();
}
function loadTexture(url) {
    const texture = new THREE.TextureLoader().load(url);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 8;
    return texture;
}
const RIMS = {
    'panel-rim-cyan': { color: 0x7fe3ff, emissive: 0x2fb8ff, intensity: 1.6 },
    'panel-rim-white': { color: 0xe8fdff, emissive: 0x9eebff, intensity: 1.0 },
    'panel-rim-red': { color: 0xff5a5a, emissive: 0xff2030, intensity: 1.4 },
    'panel-rim-sky': { color: 0x6ccbff, emissive: 0x1e90ff, intensity: 1.3 },
};
const SPHERES = { 'sphere-blue': 0x0090fb, 'sphere-red': 0xf02050, 'sphere-violet': 0x873cf8 };
function buildMaterials(textureBase) {
    const panelMap = loadTexture(`${textureBase}panel-texture.png`);
    const glyphMap = loadTexture(`${textureBase}glyph-texture.png`);
    // Printed artwork already carries its own shading, so it is mostly emissive with a clearcoat on top.
    const printed = (rest) => projectedPrint(panelMap, rest, { roughness: 0.3, clearcoat: 0.6, clearcoatRoughness: 0.2, envMapIntensity: 0.35, side: THREE.DoubleSide });
    const glyph = (rest) => projectedPrint(glyphMap, rest, { roughness: 0.15, clearcoat: 1.0, clearcoatRoughness: 0.08, envMapIntensity: 0.5 });
    const glass = new THREE.MeshPhysicalMaterial({
        color: 0xcff6ff, transparent: true, opacity: 0.06, roughness: 0.05, clearcoat: 1, envMapIntensity: 0.3, depthWrite: false, side: THREE.DoubleSide,
    });
    // material analysis bound glyph-4 / sphere-05 to the shared gloss layers; they resolve to the same looks
    // projected materials are per mesh (each carries its own rest pose); the rest are shared
    const projected = {
        'printed-panel': printed, 'glyph-4-gloss': glyph, 'glyph-d-gloss': glyph, 'glyph-gloss': glyph,
    };
    const materials = { glass };
    for (const [id, rim] of Object.entries(RIMS)) {
        materials[id] = new THREE.MeshStandardMaterial({
            color: rim.color, emissive: rim.emissive, emissiveIntensity: rim.intensity, roughness: 0.2, toneMapped: false,
            transparent: id === 'panel-rim-white', opacity: id === 'panel-rim-white' ? 0.35 : 1,
        });
    }
    for (const [id, color] of Object.entries(SPHERES)) {
        // saturated candy spheres: self-tinted so ACES/env do not wash them out, clearcoat adds the highlight
        materials[id] = new THREE.MeshPhysicalMaterial({
            color, emissive: color, emissiveIntensity: 0.45, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.05, envMapIntensity: 0.5, toneMapped: false,
        });
    }
    materials['sphere-gloss'] = materials['sphere-blue'];
    return { projected, materials };
}
// Lighting from spec.lightingFromPhoto: key upper-left, cool fill right, pink rim behind.
export function createIcon4dLights() {
    const lights = new THREE.Group();
    lights.name = 'Icon 4D lights (lightingFromPhoto)';
    const key = new THREE.DirectionalLight(0xffffff, 1.6);
    key.position.set(-5, 8, 6);
    const fill = new THREE.DirectionalLight(0xcfe6ff, 0.5);
    fill.position.set(7, 2, 5);
    const rim = new THREE.DirectionalLight(0xff7ad0, 0.8);
    rim.position.set(2, 4, -10);
    lights.add(key, fill, rim, new THREE.HemisphereLight(0xeaf4ff, 0x1a1030, 0.35));
    return lights;
}
export function configureIcon4dRenderer(renderer) {
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
}
// Interaction: every named part can be picked, and explode scales the layout about the
// model centre so gaps actually open (geometry_patterns.md assembly rule).
export function enableExplode(root) {
    const parts = partsOf(root);
    const centre = new THREE.Box3().setFromObject(root).getCenter(new THREE.Vector3());
    const home = parts.map((part) => part.position.clone());
    const worldCentres = parts.map((part) => new THREE.Box3().setFromObject(part).getCenter(new THREE.Vector3()));
    return (amount) => {
        parts.forEach((part, i) => {
            // parts hang off root / sphere-cluster, both identity transforms at the origin
            part.position.copy(home[i]).addScaledVector(worldCentres[i].clone().sub(centre), amount);
        });
    };
}
export function partsOf(root) {
    const parts = [];
    root.traverse((node) => {
        const component = componentOf(node);
        if (!component || node instanceof THREE.Mesh)
            return;
        if (component.groupOnly || component.parent !== 'root' && component.parent !== 'sphere-cluster')
            return;
        parts.push(node);
    });
    return parts;
}
export function pickPart(root, camera, ndc) {
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(ndc, camera);
    const parts = new Set(partsOf(root));
    for (const hit of raycaster.intersectObject(root, true)) {
        let node = hit.object;
        while (node && !parts.has(node))
            node = node.parent;
        if (node)
            return node;
    }
    return null;
}
export function applyIcon4dLookDev(root, stage, textureBase = './') {
    root.updateMatrixWorld(true);
    const placeholders = [];
    const materials = atLeast(stage, 'material') ? buildMaterials(textureBase) : null;
    root.traverse((node) => {
        if (!(node instanceof THREE.Mesh))
            return;
        const component = componentOf(node);
        if (!component)
            return;
        node.name = component.name;
        if (component.groupOnly) {
            placeholders.push(node);
            return;
        } // pivot-only placeholder mesh
        if (atLeast(stage, 'form') && component.id?.startsWith('glyph-'))
            bevelGlyph(node);
        if (materials) {
            const old = node.material;
            const make = materials.projected[component.material];
            const material = make ? make(node.matrixWorld.clone()) : materials.materials[component.material];
            if (material) {
                node.material = material;
                disposeMaterial(old);
            }
        }
        node.castShadow = false;
        node.receiveShadow = false;
        if (component.material === 'glass')
            node.renderOrder = 2;
    });
    // 0.001-unit meshes the generator emits under group-only pivots (root, sphere-cluster)
    for (const mesh of placeholders) {
        if (atLeast(stage, 'optimization')) {
            mesh.removeFromParent();
            mesh.geometry.dispose();
            disposeMaterial(mesh.material);
        }
        else
            mesh.visible = false;
    }
    return root;
}
