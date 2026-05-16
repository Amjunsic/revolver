import { COMBO_MILESTONE, FEVER_DURATION_MS, BUILDUP_COMBO_START } from './comboFever.js';

export class UIManager {
    /**
     * @param {{
     *   scoreDisplay: HTMLElement;
     *   statusText: HTMLElement;
     *   comboDisplay: HTMLElement;
     *   feverTimer: HTMLElement;
     *   feverTimerFill: HTMLElement;
     *   feverVignette: HTMLElement;
     *   crosshairAura: HTMLElement;
     *   combatZone: HTMLElement;
     * }} els
     */
    constructor(els) {
        this.scoreDisplay = els.scoreDisplay;
        this.statusText = els.statusText;
        this.comboDisplay = els.comboDisplay;
        this.feverTimer = els.feverTimer;
        this.feverTimerFill = els.feverTimerFill;
        this.feverVignette = els.feverVignette;
        this.crosshairAura = els.crosshairAura;
        this.combatZone = els.combatZone;
        this._feverRaf = null;
    }

    setScore(score) {
        this.scoreDisplay.innerText = `SCORE: ${score}`;
    }

    setCombo(combo) {
        this.comboDisplay.innerText = String(combo);
        this.comboDisplay.classList.toggle('combo-display--hot', combo >= BUILDUP_COMBO_START);
        const nearMilestone = combo >= BUILDUP_COMBO_START && combo % COMBO_MILESTONE !== 0;
        this.comboDisplay.classList.toggle('combo-display--buildup', nearMilestone);
    }

    flashStatus(msg, color) {
        this.statusText.innerText = msg;
        this.statusText.style.color = color;
        setTimeout(() => {
            this.statusText.style.color = '#64748b';
        }, 1500);
    }

    showFeverBonus(amount) {
        this.flashStatus(`COMBO BONUS +${amount}`, '#fbbf24');
    }

    updateCrosshairAura(clientX, clientY, combo) {
        const rect = this.combatZone.getBoundingClientRect();
        const inCombat =
            clientX >= rect.left &&
            clientX <= rect.right &&
            clientY >= rect.top &&
            clientY <= rect.bottom;
        const buildup = combo >= BUILDUP_COMBO_START && combo % COMBO_MILESTONE !== 0;
        if (!buildup || !inCombat) {
            this.crosshairAura.classList.remove('crosshair-aura--visible');
            return;
        }

        const progress = (combo - BUILDUP_COMBO_START) / (COMBO_MILESTONE - BUILDUP_COMBO_START - 1);
        this.crosshairAura.style.left = `${clientX}px`;
        this.crosshairAura.style.top = `${clientY}px`;
        this.crosshairAura.style.setProperty('--aura-scale', String(0.85 + progress * 0.35));
        this.crosshairAura.style.setProperty('--aura-opacity', String(0.35 + progress * 0.55));
        this.crosshairAura.classList.add('crosshair-aura--visible');
    }

    hideCrosshairAura() {
        this.crosshairAura.classList.remove('crosshair-aura--visible');
    }

    startFeverTimer() {
        this.stopFeverTimer();
        this.feverTimer.hidden = false;
        this.feverVignette.classList.add('fever-vignette--active');
        this.feverVignette.setAttribute('aria-hidden', 'false');
        const started = performance.now();

        const tick = () => {
            const elapsed = performance.now() - started;
            const remaining = Math.max(0, 1 - elapsed / FEVER_DURATION_MS);
            this.feverTimerFill.style.transform = `scaleX(${remaining})`;
            if (remaining > 0) {
                this._feverRaf = requestAnimationFrame(tick);
            }
        };
        this._feverRaf = requestAnimationFrame(tick);
    }

    stopFeverTimer() {
        if (this._feverRaf !== null) {
            cancelAnimationFrame(this._feverRaf);
            this._feverRaf = null;
        }
        this.feverTimer.hidden = true;
        this.feverTimerFill.style.transform = 'scaleX(0)';
        this.feverVignette.classList.remove('fever-vignette--active');
        this.feverVignette.setAttribute('aria-hidden', 'true');
    }
}
