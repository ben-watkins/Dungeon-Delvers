/**
 * DUNGEON TIMER
 * 
 * M+ keystone timer that counts down.
 * Deaths add a time penalty.
 * Timer determines if the key is upgraded (+1, +2, +3) at the end.
 * 
 * Thresholds:
 *   Completed in time       → +1 key upgrade
 *   40% time remaining      → +2 key upgrade
 *   20% time remaining      → +3 key upgrade (timed perfectly)
 *   Over time               → Key depleted (no upgrade)
 */

export class DungeonTimer {
  constructor(scene, timeLimitSeconds) {
    this.scene = scene;
    this.timeLimit = timeLimitSeconds * 1000;  // Convert to ms
    this.timeRemaining = this.timeLimit;
    this.deaths = 0;
    this.deathPenalty = 5000;  // 5 seconds per death
    this.running = false;
    this.completed = false;

    scene.events.on('playerDeath', this.onDeath, this);
  }

  start() {
    this.running = true;
  }

  pause() {
    this.running = false;
  }

  onDeath(entity) {
    this.deaths++;
    this.timeRemaining -= this.deathPenalty;
    this.scene.events.emit('timerPenalty', {
      deaths: this.deaths,
      penalty: this.deathPenalty / 1000,
    });
  }

  update(dt) {
    if (!this.running || this.completed) return;
    this.timeRemaining -= dt;

    if (this.timeRemaining <= 0) {
      this.timeRemaining = 0;
      // Don't stop — the dungeon can still be completed over time
    }
  }

  complete() {
    this.completed = true;
    this.running = false;
  }

  /**
   * Get formatted time string MM:SS
   */
  getTimeString() {
    const totalSec = Math.max(0, Math.ceil(this.timeRemaining / 1000));
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    return `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  }

  /**
   * Check if over time
   */
  isOverTime() {
    return this.timeRemaining <= 0;
  }

  /**
   * Get key upgrade level based on time remaining
   */
  getKeyUpgrade() {
    if (this.timeRemaining <= 0) return 0;
    const pctRemaining = this.timeRemaining / this.timeLimit;
    if (pctRemaining >= 0.4) return 3;
    if (pctRemaining >= 0.2) return 2;
    return 1;
  }

  /**
   * Get time remaining as percentage (0-1)
   */
  getPercentRemaining() {
    return Math.max(0, this.timeRemaining / this.timeLimit);
  }

  destroy() {
    this.scene.events.off('playerDeath', this.onDeath, this);
  }
}
