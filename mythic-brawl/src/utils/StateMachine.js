/**
 * FINITE STATE MACHINE
 * 
 * Used for character animation/behavior states.
 * States: idle, walk, attack1, attack2, attack3, special, hitstun, knockdown, getup, death, block
 * 
 * Each state defines:
 *   enter()   — Called once when entering state
 *   update()  — Called every frame while in state
 *   exit()    — Called once when leaving state
 *   transitions — Map of event names to target state names
 * 
 * Usage:
 *   const fsm = new StateMachine(owner, {
 *     idle: { enter() {}, update(dt) {}, transitions: { attack: 'attack1' } }
 *   });
 *   fsm.transition('attack');  // Moves to attack1 state
 */
export class StateMachine {
  constructor(owner, states) {
    this.owner = owner;
    this.states = states;
    this.currentState = null;
    this.currentStateName = null;
    this.locked = false;  // When true, transitions are blocked (during un-cancellable attacks)
  }

  start(stateName) {
    this.currentStateName = stateName;
    this.currentState = this.states[stateName];
    if (this.currentState?.enter) {
      this.currentState.enter.call(this.owner);
    }
  }

  transition(event) {
    if (this.locked) return false;
    if (!this.currentState?.transitions?.[event]) return false;

    const nextStateName = this.currentState.transitions[event];
    if (!this.states[nextStateName]) {
      console.warn(`StateMachine: No state defined for '${nextStateName}'`);
      return false;
    }

    if (this.currentState?.exit) {
      this.currentState.exit.call(this.owner);
    }

    this.currentStateName = nextStateName;
    this.currentState = this.states[nextStateName];

    if (this.currentState?.enter) {
      this.currentState.enter.call(this.owner);
    }

    return true;
  }

  /**
   * Force a state change, ignoring lock and transitions map.
   * Use for things like death or hitstun that override everything.
   */
  forceState(stateName) {
    if (!this.states[stateName]) return;

    if (this.currentState?.exit) {
      this.currentState.exit.call(this.owner);
    }

    this.locked = false;
    this.currentStateName = stateName;
    this.currentState = this.states[stateName];

    if (this.currentState?.enter) {
      this.currentState.enter.call(this.owner);
    }
  }

  update(dt) {
    if (this.currentState?.update) {
      this.currentState.update.call(this.owner, dt);
    }
  }

  is(stateName) {
    return this.currentStateName === stateName;
  }
}
