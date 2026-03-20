/**
 * COMBO STATE MACHINE
 * 
 * Handles the Streets of Rage-style combo input system:
 * 
 * INPUT BUFFERING:
 *   Player presses attack during an ongoing attack animation.
 *   The input is stored in a buffer.
 *   When the current attack reaches its "canCancel" frame,
 *   the buffered input triggers the next combo hit.
 * 
 * COMBO WINDOW:
 *   After an attack ends, there's a brief window (comboWindow ms)
 *   where pressing attack continues the combo chain.
 *   If the window expires, combo resets to hit 1.
 * 
 * COMBO CHAIN:
 *   Each class defines a combo sequence (e.g., [atk1, atk2, atk3]).
 *   The chain loops or resets depending on whether the finisher was reached.
 * 
 * This system is embedded in the Player entity's state machine.
 * This file provides helper utilities for combo management.
 */

/**
 * Calculate whether an input should be buffered or executed.
 * 
 * @param {Object} attackData - Current attack's data from ATTACKS config
 * @param {number} currentFrame - Current animation frame
 * @returns {string} 'execute' | 'buffer' | 'reject'
 */
export function checkComboInput(attackData, currentFrame) {
  if (!attackData) return 'execute';

  // During active frames — reject new input
  if (currentFrame >= attackData.activeStart && currentFrame <= attackData.activeEnd) {
    return 'buffer';
  }

  // After cancel frame — execute immediately
  if (attackData.canCancel >= 0 && currentFrame >= attackData.canCancel) {
    return 'execute';
  }

  // During windup or recovery — buffer
  return 'buffer';
}

/**
 * Get damage with combo scaling.
 * Later hits in a combo deal bonus damage.
 * 
 * @param {number} baseDamage - Attack's base damage
 * @param {number} comboIndex - Position in combo chain (0-based)
 * @returns {number} Scaled damage
 */
export function comboDamage(baseDamage, comboIndex) {
  const comboMultipliers = [1.0, 1.1, 1.25, 1.5];  // Escalating damage
  const mult = comboMultipliers[Math.min(comboIndex, comboMultipliers.length - 1)];
  return Math.round(baseDamage * mult);
}

/**
 * Get hitstun with combo scaling.
 * Finisher hits have longer hitstun for knockdown setups.
 * 
 * @param {number} baseHitstun - Attack's base hitstun in ms
 * @param {number} comboIndex - Position in combo chain
 * @param {number} comboLength - Total combo chain length
 * @returns {number} Scaled hitstun in ms
 */
export function comboHitstun(baseHitstun, comboIndex, comboLength) {
  // Finisher gets 50% more hitstun
  if (comboIndex === comboLength - 1) {
    return Math.round(baseHitstun * 1.5);
  }
  return baseHitstun;
}
