/**
 * DEPTH SORT — 2.5D Y-sorting for entities
 * 
 * In a 2.5D beat-em-up, entities closer to the bottom of the screen (higher Y)
 * should render in front of entities higher on screen (lower Y).
 * 
 * Call sortGroup() every frame on the entity group to keep rendering order correct.
 */

import { GAME_CONFIG } from '../config/game.js';

/**
 * Sort all children of a Phaser group by their groundY position.
 * groundY is the Y coordinate of the entity's "feet" on the ground plane.
 * Entities with higher groundY render in front (higher depth value).
 * 
 * @param {Phaser.GameObjects.Group} group - The group containing entities to sort
 */
export function sortGroup(group) {
  const children = group.getChildren();
  for (let i = 0; i < children.length; i++) {
    const entity = children[i];
    if (!entity.active) continue; // Skip destroyed entities
    // groundY is stored on the entity; fallback to sprite y
    const groundY = entity.groundY ?? entity.y;
    entity.setDepth(GAME_CONFIG.layers.entities + groundY);
  }
}

/**
 * Clamp a Y position to the walkable ground plane.
 * Prevents characters from walking off the ground area.
 * 
 * @param {number} y - The desired Y position
 * @returns {number} - Clamped Y position
 */
export function clampToGround(y) {
  return Phaser.Math.Clamp(y, GAME_CONFIG.groundMinY, GAME_CONFIG.groundMaxY);
}
