/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as THREE from 'three';

// Analytical heightmap function for instant ground checks (prevents falling through map and works at 60fps)
export function getTerrainHeight(x: number, z: number): number {
  // Boundary check
  if (Math.abs(x) > 250 || Math.abs(z) > 250) {
    return 0;
  }

  // Large scale rolling hills
  let h = Math.sin(x * 0.015) * Math.cos(z * 0.015) * 6;

  // Mountain zone in the northeast quadrant
  if (x > 50 && z > 50) {
    const d = Math.sqrt(Math.pow(x - 120, 2) + Math.pow(z - 120, 2));
    if (d < 100) {
      h += Math.cos((d / 100) * Math.PI / 2) * 22;
    }
  }

  // Mountain zone in the southwest quadrant
  if (x < -60 && z < -60) {
    const d = Math.sqrt(Math.pow(x + 120, 2) + Math.pow(z + 120, 2));
    if (d < 80) {
      h += Math.cos((d / 80) * Math.PI / 2) * 16;
    }
  }

  // River canal cutting diagonally from North-West to South-East
  // Diagonal line: x + z = 0
  const distToDiagonal = Math.abs(x + z) / Math.sqrt(2);
  if (distToDiagonal < 20) {
    const factor = distToDiagonal / 20; // 0 (center) to 1 (edge)
    const riverBed = -3.5 + Math.pow(factor, 2) * 3.5;
    // Blend the general height with riverbed
    h = THREE.MathUtils.lerp(riverBed, h, factor);
  }

  // Flattening critical gameplay sites (Military, Power Plant, Airport)
  // 1. Airport (Center: x=0, z=0)
  const distAirport = Math.sqrt(x*x + z*z);
  if (distAirport < 40) {
    const factor = distAirport / 40;
    h = THREE.MathUtils.lerp(0.5, h, Math.pow(factor, 2));
  }

  // 2. Military Base (North-West: x=-100, z=100)
  const distMil = Math.sqrt(Math.pow(x + 100, 2) + Math.pow(z - 100, 2));
  if (distMil < 35) {
    const factor = distMil / 35;
    h = THREE.MathUtils.lerp(2.0, h, Math.pow(factor, 2));
  }

  // 3. Power Plant (South-East: x=100, z=-100)
  const distPower = Math.sqrt(Math.pow(x - 100, 2) + Math.pow(z + 100, 2));
  if (distPower < 35) {
    const factor = distPower / 35;
    h = THREE.MathUtils.lerp(1.0, h, Math.pow(factor, 2));
  }

  return h;
}

// Procedural visual asset placement definitions
export interface MapLocation {
  name: string;
  x: number;
  z: number;
  radius: number;
}

export const MAP_LOCATIONS: MapLocation[] = [
  { name: 'Skelly Airport', x: 0, z: 0, radius: 40 },
  { name: 'Military Firebase', x: -100, z: 100, radius: 35 },
  { name: 'Apex Factory', x: -80, z: -20, radius: 25 },
  { name: 'Sunset Power Plant', x: 100, z: -100, radius: 35 },
  { name: 'Peak Highlands', x: 120, z: 120, radius: 40 },
  { name: 'Riverside Village', x: 40, z: -40, radius: 30 },
  { name: 'Sentinel Mountain', x: -120, z: -120, radius: 35 },
];

export class MapGenerator {
  scene: THREE.Scene;
  terrainMesh!: THREE.Mesh;
  waterMesh!: THREE.Mesh;
  colliders: THREE.Box3[] = [];
  lootContainers: THREE.Mesh[] = [];
  decorations: THREE.Object3D[] = [];

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  generateMap(graphicsPreset: 'low' | 'medium' | 'high' = 'medium') {
    // 1. Create Terrain
    const size = 500;
    const segments = graphicsPreset === 'high' ? 120 : (graphicsPreset === 'medium' ? 80 : 40);
    const geometry = new THREE.PlaneGeometry(size, size, segments, segments);
    
    // Displace vertices analytical height
    const posAttr = geometry.attributes.position;
    for (let i = 0; i < posAttr.count; i++) {
      const vx = posAttr.getX(i);
      const vy = posAttr.getY(i);
      const height = getTerrainHeight(vx, vy);
      posAttr.setZ(i, height);
    }
    geometry.computeVertexNormals();

    // Create custom materials based on height for a gorgeous bento look
    // Dark military terrain, green fields, sandy paths
    const terrainMaterial = new THREE.MeshStandardMaterial({
      roughness: 0.85,
      metalness: 0.1,
      flatShading: true,
      vertexColors: true,
    });

    // Colorize terrain based on heights & features
    const colors: number[] = [];
    const colorLow = new THREE.Color('#223f12'); // Dark swamp
    const colorGrass = new THREE.Color('#386b1d'); // Rich grass
    const colorSand = new THREE.Color('#c2b280'); // Sand/beach near river
    const colorRock = new THREE.Color('#4a5540'); // Dark slate mountains
    const colorSnow = new THREE.Color('#d1d5db'); // Light grey snow mountain caps
    const colorIndustrial = new THREE.Color('#1e293b'); // Dark tarmac / military airport concrete

    for (let i = 0; i < posAttr.count; i++) {
      const vx = posAttr.getX(i);
      const vy = posAttr.getY(i);
      const h = posAttr.getZ(i);

      let finalColor = colorGrass;

      // River check
      const distToDiag = Math.abs(vx + vy) / Math.sqrt(2);
      if (distToDiag < 24 && h < -0.5) {
        finalColor = colorSand;
      } else if (h > 18) {
        finalColor = colorSnow;
      } else if (h > 8) {
        finalColor = colorRock;
      } else if (h < -2) {
        finalColor = colorLow;
      }

      // Check key installations for structural cement styling
      const distAirport = Math.sqrt(vx*vx + vy*vy);
      const distMil = Math.sqrt(Math.pow(vx + 100, 2) + Math.pow(vy - 100, 2));
      const distPower = Math.sqrt(Math.pow(vx - 100, 2) + Math.pow(vy + 100, 2));
      if (distAirport < 36 || distMil < 30 || distPower < 30) {
        finalColor = colorIndustrial;
      }

      colors.push(finalColor.r, finalColor.g, finalColor.b);
    }
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

    this.terrainMesh = new THREE.Mesh(geometry, terrainMaterial);
    this.terrainMesh.rotation.x = -Math.PI / 2; // Make lay flat
    this.terrainMesh.receiveShadow = true;
    this.scene.add(this.terrainMesh);

    // 2. Add Water Plane (River & Sea border)
    const waterGeom = new THREE.PlaneGeometry(size, size);
    const waterMat = new THREE.MeshStandardMaterial({
      color: '#0284c7',
      transparent: true,
      opacity: 0.65,
      roughness: 0.1,
      metalness: 0.9,
    });
    this.waterMesh = new THREE.Mesh(waterGeom, waterMat);
    this.waterMesh.rotation.x = -Math.PI / 2;
    this.waterMesh.position.y = -1.8; // Ocean height standard
    this.scene.add(this.waterMesh);

    // 3. Build structures at major locations
    this.buildSkellyAirport();
    this.buildMilitaryBase();
    this.buildPowerPlant();
    this.buildProceduralCities();

    // 4. Generate beautiful Trees (Forests)
    const treeCount = graphicsPreset === 'high' ? 140 : (graphicsPreset === 'medium' ? 80 : 30);
    this.generateProceduralTrees(treeCount);
  }

  private buildSkellyAirport() {
    // Large runway
    const runwayGeom = new THREE.BoxGeometry(10, 0.4, 75);
    const runwayMat = new THREE.MeshStandardMaterial({ color: '#111827', roughness: 0.9 });
    const runway = new THREE.Mesh(runwayGeom, runwayMat);
    runway.position.set(0, getTerrainHeight(0, 0) + 0.1, 0);
    runway.rotation.y = Math.PI / 4;
    this.scene.add(runway);

    // Hangar 1
    const hangarGroup = new THREE.Group();
    hangarGroup.position.set(-20, getTerrainHeight(-20, -15), -15);
    const wallMat = new THREE.MeshStandardMaterial({ color: '#708090', roughness: 0.6, flatShading: true });
    
    // Hangar structure
    const leftWall = new THREE.Mesh(new THREE.BoxGeometry(1, 8, 15), wallMat);
    leftWall.position.x = -6;
    const rightWall = new THREE.Mesh(new THREE.BoxGeometry(1, 8, 15), wallMat);
    rightWall.position.x = 6;
    const backWall = new THREE.Mesh(new THREE.BoxGeometry(12, 8, 1), wallMat);
    backWall.position.z = -7;
    
    // Curved roof approximation
    const roof = new THREE.Mesh(new THREE.BoxGeometry(14, 1, 16), new THREE.MeshStandardMaterial({ color: '#b0c4de' }));
    roof.position.y = 4.5;

    hangarGroup.add(leftWall, rightWall, backWall, roof);
    this.scene.add(hangarGroup);

    // Compute bounding colliders
    const hangarBox = new THREE.Box3().setFromObject(hangarGroup);
    this.colliders.push(hangarBox);
  }

  private buildMilitaryBase() {
    // Military command center (Multi-tier block tower)
    const milX = -100;
    const milZ = 100;
    const height = getTerrainHeight(milX, milZ);

    const baseGroup = new THREE.Group();
    baseGroup.position.set(milX, height, milZ);

    const steelMat = new THREE.MeshStandardMaterial({ color: '#2f4f4f', roughness: 0.5 });
    const rustMat = new THREE.MeshStandardMaterial({ color: '#8b4513', roughness: 0.7 });

    const firstTier = new THREE.Mesh(new THREE.BoxGeometry(12, 6, 12), steelMat);
    firstTier.position.y = 3;
    
    const secondTier = new THREE.Mesh(new THREE.BoxGeometry(8, 5, 8), rustMat);
    secondTier.position.y = 8.5;

    const radarTower = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 6), steelMat);
    radarTower.position.set(0, 14, 0);

    const radarDish = new THREE.Mesh(new THREE.SphereGeometry(2, 8, 8, 0, Math.PI), new THREE.MeshStandardMaterial({ color: '#d3d3d3' }));
    radarDish.position.set(0, 17, 0);
    radarDish.rotation.x = Math.PI / 4;

    baseGroup.add(firstTier, secondTier, radarTower, radarDish);
    this.scene.add(baseGroup);

    this.colliders.push(new THREE.Box3().setFromObject(firstTier));

    // Scatter 4 supply shipping containers
    const containerColors = ['#991b1b', '#1e3a8a', '#14532d', '#7c2d12'];
    for (let i = 0; i < 4; i++) {
      const cx = milX + (i % 2 === 0 ? 12 : -12) + (i > 1 ? 4 : -4);
      const cz = milZ + (i % 2 === 0 ? -12 : 12) + (i > 1 ? -4 : 4);
      const ch = getTerrainHeight(cx, cz);

      const container = new THREE.Mesh(
        new THREE.BoxGeometry(4, 3, 8),
        new THREE.MeshStandardMaterial({ color: containerColors[i], roughness: 0.7 })
      );
      container.position.set(cx, ch + 1.5, cz);
      container.rotation.y = (i * Math.PI) / 6;
      this.scene.add(container);
      this.colliders.push(new THREE.Box3().setFromObject(container));
    }
  }

  private buildPowerPlant() {
    const ppX = 100;
    const ppZ = -100;
    const height = getTerrainHeight(ppX, ppZ);

    const plantGroup = new THREE.Group();
    plantGroup.position.set(ppX, height, ppZ);

    const concreteMat = new THREE.MeshStandardMaterial({ color: '#555555', roughness: 0.9 });
    const metalMat = new THREE.MeshStandardMaterial({ color: '#8c8c8c', roughness: 0.4 });

    // Cooling Towers (represented by hollow open cylinders or scaled cones)
    const tower = new THREE.Mesh(
      new THREE.CylinderGeometry(4, 6, 14, 8),
      concreteMat
    );
    tower.position.set(-6, 7, -6);
    
    const chimney = new THREE.Mesh(
      new THREE.CylinderGeometry(2, 2, 22, 6),
      concreteMat
    );
    chimney.position.set(6, 11, 6);

    const turbineHouse = new THREE.Mesh(
      new THREE.BoxGeometry(10, 6, 15),
      metalMat
    );
    turbineHouse.position.set(4, 3, -4);

    plantGroup.add(tower, chimney, turbineHouse);
    this.scene.add(plantGroup);

    this.colliders.push(new THREE.Box3().setFromObject(turbineHouse));
    this.colliders.push(new THREE.Box3().setFromObject(tower));
  }

  private buildProceduralCities() {
    // Generate scattered survival sheds and tactical structures
    // Let's place 15 survival shacks in the villages and forests
    const shackMat = new THREE.MeshStandardMaterial({ color: '#8b5a2b', roughness: 0.9 });
    const roofMat = new THREE.MeshStandardMaterial({ color: '#3f000f', roughness: 0.8 });

    const seedPositions = [
      { x: -50, z: -50 }, { x: -65, z: -40 }, { x: -30, z: -80 },
      { x: 30, z: -30 }, { x: 50, z: -50 }, { x: 45, z: -20 },
      { x: -110, z: 20 }, { x: -90, z: 40 },
      { x: 80, z: 40 }, { x: 100, z: 60 }, { x: 60, z: 90 }
    ];

    seedPositions.forEach((pos, idx) => {
      const h = getTerrainHeight(pos.x, pos.z);
      const shack = new THREE.Group();
      shack.position.set(pos.x, h, pos.z);

      const body = new THREE.Mesh(new THREE.BoxGeometry(5, 3.5, 5), shackMat);
      body.position.y = 1.75;

      const roof = new THREE.Mesh(new THREE.ConeGeometry(4, 2.5, 4), roofMat);
      roof.position.y = 3.5 + 1.25;
      roof.rotation.y = Math.PI / 4;

      shack.add(body, roof);
      this.scene.add(shack);

      const box = new THREE.Box3().setFromObject(body);
      this.colliders.push(box);
    });
  }

  private generateProceduralTrees(count: number) {
    const trunkMat = new THREE.MeshStandardMaterial({ color: '#5c4033', roughness: 0.9 });
    const foliageMat = new THREE.MeshStandardMaterial({ color: '#1b4d3e', roughness: 0.8, flatShading: true });

    for (let i = 0; i < count; i++) {
      // Avoid center and deep riverbed
      const tx = (Math.random() * 400) - 200;
      const tz = (Math.random() * 400) - 200;
      
      const distToDiag = Math.abs(tx + tz) / Math.sqrt(2);
      const distAirport = Math.sqrt(tx*tx + tz*tz);
      
      if (distToDiag < 15 || distAirport < 35) {
        continue; // Keep runways and river clear
      }

      const th = getTerrainHeight(tx, tz);
      if (th < -1.5) continue; // No underwater trees

      const treeGroup = new THREE.Group();
      treeGroup.position.set(tx, th, tz);

      const scale = 0.7 + Math.random() * 0.6;
      
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.3 * scale, 0.4 * scale, 3 * scale, 5), trunkMat);
      trunk.position.y = 1.5 * scale;

      const foliage = new THREE.Mesh(new THREE.ConeGeometry(1.8 * scale, 4 * scale, 5), foliageMat);
      foliage.position.y = (3 + 1.8) * scale;

      treeGroup.add(trunk, foliage);
      this.scene.add(treeGroup);
      this.decorations.push(treeGroup);
    }
  }

  // Visual Safe Zone glowing storm barrier
  createStormZoneVisual(): THREE.Mesh {
    const geom = new THREE.CylinderGeometry(1, 1, 150, 32, 1, true); // open ended cylinder
    const mat = new THREE.MeshBasicMaterial({
      color: '#a855f7',
      transparent: true,
      opacity: 0.28,
      side: THREE.DoubleSide,
      wireframe: false,
    });
    
    // Add pulsing edge rings
    const stormMesh = new THREE.Mesh(geom, mat);
    stormMesh.position.y = 30; // center height
    this.scene.add(stormMesh);
    return stormMesh;
  }
}
