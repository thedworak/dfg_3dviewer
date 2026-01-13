export const objectsConfig = {
  models: [
    {
      name: "Astronaut_mesh", // optional unique id
      url:  "https://raw.githubusercontent.com/IIIF/3d/main/assets/astronaut/astronaut.glb", // required
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      scale:    { x: 1, y: 1, z: 1 }
    },
    /*{
      name: "Synagogue",
      url:  "https://models.babylonjs.com/Synagogue.glb",
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 45, z: 0 },
      scale:    { x: 1, y: 1, z: 1 }
    }*/
  ],

  camera: {
    position: { x: 0, y: 5, z: 10 },
    target:   { x: 0, y: 0, z: 0 }
  },

  scene: {
    background: "radial-gradient(circle, #ffffff 0%, #999999 100%)",
    lights: [
      {
        type: "directional",
        color: "0xffffff",
        intensity: 1,
        position: { x: 0, y: 100, z: 100 },
        target:   { x: 0, y: 0, z: 0 }
      },
      {
        type: "ambient",
        color: "0x404040",
        intensity: 1
      },
      {
        type: "point",
        color: "0xffffff",
        intensity: 1,
        position: { x: 2, y: 3, z: 4 }
      }
    ]
  }
};