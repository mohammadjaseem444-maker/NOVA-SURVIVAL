/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as THREE from 'three';
import { Combatant, GameSettings } from '../types';
import { getTerrainHeight } from './mapGenerator';

export class PlayerController {
  player: Combatant;
  settings: GameSettings;
  
  // Physics states
  velocityY = 0;
  isGrounded = true;
  stance: 'standing' | 'crouching' | 'prone' = 'standing';
  isSprinting = false;

  // Input states
  keys: { [key: string]: boolean } = {};
  mouseDragStart = { x: 0, y: 0 };
  isDraggingLook = false;

  // Camera angles
  yaw = 0; // Horizontal rotation
  pitch = 0; // Vertical rotation
  cameraRadius = 6.0; // Distance behind player
  targetFov: number;

  constructor(player: Combatant, settings: GameSettings) {
    this.player = player;
    this.settings = settings;
    this.yaw = player.rotationY;
    this.targetFov = settings.fov;
    this.setupListeners();
  }

  private setupListeners() {
    // Keyboard inputs
    const onKeyDown = (e: KeyboardEvent) => {
      this.keys[e.key.toLowerCase()] = true;
      if (e.key === ' ' && this.isGrounded) {
        this.velocityY = 12.0; // Jump force
        this.isGrounded = false;
        this.player.action = 'idle';
      }
      if (e.key.toLowerCase() === 'c') {
        this.toggleCrouch();
      }
      if (e.key.toLowerCase() === 'z') {
        this.toggleProne();
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      this.keys[e.key.toLowerCase()] = false;
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    // Mouse drag-to-look setup (highly reliable inside iframe environments)
    const onMouseDown = (e: MouseEvent) => {
      // Ignore clicks on HUD buttons
      if ((e.target as HTMLElement).closest('button') || (e.target as HTMLElement).closest('input')) {
        return;
      }
      this.isDraggingLook = true;
      this.mouseDragStart.x = e.clientX;
      this.mouseDragStart.y = e.clientY;
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!this.isDraggingLook) return;
      const dx = e.clientX - this.mouseDragStart.x;
      const dy = e.clientY - this.mouseDragStart.y;

      const sensitivityScale = 0.002;
      this.yaw -= dx * this.settings.sensitivityX * sensitivityScale;
      this.pitch -= dy * this.settings.sensitivityY * sensitivityScale;

      // Lock vertical pitch to avoid flipping upside down
      this.pitch = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, this.pitch));

      this.mouseDragStart.x = e.clientX;
      this.mouseDragStart.y = e.clientY;

      this.player.rotationY = this.yaw;
      this.player.pitch = this.pitch;
    };

    const onMouseUp = () => {
      this.isDraggingLook = false;
    };

    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }

  toggleCrouch() {
    if (this.stance === 'crouching') {
      this.stance = 'standing';
    } else {
      this.stance = 'crouching';
    }
  }

  toggleProne() {
    if (this.stance === 'prone') {
      this.stance = 'standing';
    } else {
      this.stance = 'prone';
    }
  }

  update(deltaTime: number, camera: THREE.PerspectiveCamera, colliders: THREE.Box3[]) {
    const pos = this.player.position;

    // 1. Stance height modifiers
    let currentHeightOffset = 1.6; // default eye-level
    if (this.stance === 'crouching') currentHeightOffset = 1.0;
    if (this.stance === 'prone') currentHeightOffset = 0.4;

    // 2. Sprint modifier
    this.isSprinting = this.keys['shift'] && (this.keys['w'] || this.keys['a'] || this.keys['s'] || this.keys['d']) && this.stance === 'standing';

    // 3. Movement speed
    let speed = 5.0; // standard walking
    if (this.isSprinting) speed = 8.0;
    if (this.stance === 'crouching') speed = 2.5;
    if (this.stance === 'prone') speed = 1.2;

    let moveX = 0;
    let moveZ = 0;

    if (this.keys['w'] || this.keys['arrowup']) {
      moveX += Math.cos(this.yaw);
      moveZ += Math.sin(this.yaw);
    }
    if (this.keys['s'] || this.keys['arrowdown']) {
      moveX -= Math.cos(this.yaw);
      moveZ -= Math.sin(this.yaw);
    }
    if (this.keys['a'] || this.keys['arrowleft']) {
      moveX += Math.sin(this.yaw);
      moveZ -= Math.cos(this.yaw);
    }
    if (this.keys['d'] || this.keys['arrowright']) {
      moveX -= Math.sin(this.yaw);
      moveZ += Math.cos(this.yaw);
    }

    // Normalize movement vectors
    if (moveX !== 0 || moveZ !== 0) {
      const length = Math.sqrt(moveX * moveX + moveZ * moveZ);
      const dx = (moveX / length) * speed * deltaTime;
      const dz = (moveZ / length) * speed * deltaTime;

      // Temporary positions to test collider bounds
      const nextX = pos.x + dx;
      const nextZ = pos.z + dz;

      // Bounding box testing
      const tempBox = new THREE.Box3(
        new THREE.Vector3(nextX - 0.8, pos.y, nextZ - 0.8),
        new THREE.Vector3(nextX + 0.8, pos.y + 2.0, nextZ + 0.8)
      );

      let collided = false;
      for (const box of colliders) {
        if (tempBox.intersectsBox(box)) {
          collided = true;
          break;
        }
      }

      if (!collided) {
        pos.x = nextX;
        pos.z = nextZ;
      }

      // Update active animation label
      if (this.isSprinting) {
        this.player.action = 'sprinting';
      } else if (this.stance === 'crouching') {
        this.player.action = 'walking';
      } else {
        this.player.action = 'running';
      }
    } else {
      if (this.player.action !== 'healing' && this.player.action !== 'reloading') {
        this.player.action = 'idle';
      }
    }

    // 4. Gravity & Jump physics
    const gravity = -32.0;
    const terrainH = getTerrainHeight(pos.x, pos.z);

    if (!this.isGrounded) {
      this.velocityY += gravity * deltaTime;
      pos.y += this.velocityY * deltaTime;

      if (pos.y <= terrainH) {
        pos.y = terrainH;
        this.velocityY = 0;
        this.isGrounded = true;
      }
    } else {
      pos.y = terrainH; // Stick directly to ground mesh
    }

    // Boundary containment
    pos.x = Math.max(-240, Math.min(240, pos.x));
    pos.z = Math.max(-240, Math.min(240, pos.z));

    // 5. Update Camera Rig position
    const isFps = this.settings.cameraMode === 'fps';
    
    // Smoothly transition FOV (for aiming zoom support)
    camera.fov = THREE.MathUtils.lerp(camera.fov, this.targetFov, 0.15);
    camera.updateProjectionMatrix();

    if (isFps) {
      // First person view snapping directly to character's eyes
      const eyeY = pos.y + currentHeightOffset;
      camera.position.set(pos.x, eyeY, pos.z);

      const lookTarget = new THREE.Vector3(
        pos.x + Math.cos(this.yaw) * Math.cos(this.pitch),
        eyeY + Math.sin(this.pitch),
        pos.z + Math.sin(this.yaw) * Math.cos(this.pitch)
      );
      camera.lookAt(lookTarget);
    } else {
      // Third Person View snapping slightly above and behind the avatar
      const playerEye = new THREE.Vector3(pos.x, pos.y + currentHeightOffset, pos.z);
      
      const cameraOffset = new THREE.Vector3(
        -Math.cos(this.yaw) * Math.cos(this.pitch),
        -Math.sin(this.pitch) + 0.3, // slight up angle
        -Math.sin(this.yaw) * Math.cos(this.pitch)
      ).normalize().multiplyScalar(this.cameraRadius);

      const idealCamPos = playerEye.clone().add(cameraOffset);

      // Simple Raycast-to-terrain check to avoid camera going below mountains!
      const terrainCamHeight = getTerrainHeight(idealCamPos.x, idealCamPos.z);
      if (idealCamPos.y < terrainCamHeight + 1.2) {
        idealCamPos.y = terrainCamHeight + 1.2;
      }

      camera.position.copy(idealCamPos);
      
      // Look slightly above the player's head for standard crosshair placement
      const lookTarget = playerEye.clone().add(new THREE.Vector3(
        Math.cos(this.yaw) * 4.0,
        Math.sin(this.pitch) * 4.0,
        Math.sin(this.yaw) * 4.0
      ));
      camera.lookAt(lookTarget);
    }
  }

  // Inject aim inputs from touch controllers
  applyLookDelta(dx: number, dy: number) {
    const sensitivityScale = 0.005;
    this.yaw -= dx * this.settings.sensitivityX * sensitivityScale;
    this.pitch -= dy * this.settings.sensitivityY * sensitivityScale;
    this.pitch = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, this.pitch));

    this.player.rotationY = this.yaw;
    this.player.pitch = this.pitch;
  }
}
