export const COMBO_MILESTONE = 50;
export const COMBO_BONUS_WEIGHT = 10;
export const FEVER_DURATION_MS = 5000;
export const FEVER_SCORE_MULTIPLIER = 2;
export const BASE_KILL_SCORE = 100;
export const BUILDUP_COMBO_START = 45;

/**
 * @param {{
 *   onComboChange?: (combo: number) => void;
 *   onScoreBonus?: (amount: number) => void;
 *   onFeverStart?: () => void;
 *   onFeverEnd?: () => void;
 * }} callbacks
 */
export class ComboFeverSystem {
    constructor(callbacks = {}) {
        this.callbacks = callbacks;
        this.combo = 0;
        this.weight = COMBO_BONUS_WEIGHT;
        this.feverActive = false;
        this.feverEndsAt = 0;
    }

    isFeverActive() {
        return this.feverActive && performance.now() < this.feverEndsAt;
    }

    getFeverRemainingMs() {
        if (!this.isFeverActive()) return 0;
        return Math.max(0, this.feverEndsAt - performance.now());
    }

    getKillScore() {
        return this.isFeverActive()
            ? BASE_KILL_SCORE * FEVER_SCORE_MULTIPLIER
            : BASE_KILL_SCORE;
    }

    registerHit(addScoreFn) {
        this.combo += 1;
        this.callbacks.onComboChange?.(this.combo);

        if (this.combo % COMBO_MILESTONE === 0) {
            const bonus = this.combo * this.weight;
            addScoreFn(bonus);
            this.callbacks.onScoreBonus?.(bonus);
            this.startFever();
        }
    }

    registerMiss() {
        if (this.isFeverActive()) return;
        this.combo = 0;
        this.callbacks.onComboChange?.(this.combo);
    }

    startFever() {
        this.feverActive = true;
        this.feverEndsAt = performance.now() + FEVER_DURATION_MS;
        this.callbacks.onFeverStart?.();
    }

    update() {
        if (!this.feverActive) return;
        if (performance.now() >= this.feverEndsAt) {
            this.endFever();
        }
    }

    endFever() {
        if (!this.feverActive) return;
        this.feverActive = false;
        this.feverEndsAt = 0;
        this.callbacks.onFeverEnd?.();
    }
}
