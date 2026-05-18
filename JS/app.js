import { createReactiveGameState, BULLET_STATE } from './state.js';
import { UIManager } from './ui.js';
import { EnemyManager } from './enemies.js';
import { Revolver } from './revolver.js';
import { ComboFeverSystem } from './comboFever.js';

class Game {
    constructor() {
        this.els = Game.cacheElements();
        this.ui = new UIManager({
            scoreDisplay: this.els.scoreDisplay,
            livesDisplay: this.els.livesDisplay,
            statusText: this.els.statusText,
            comboDisplay: this.els.comboDisplay,
            feverTimer: this.els.feverTimer,
            feverTimerFill: this.els.feverTimerFill,
            feverVignette: this.els.feverVignette,
            crosshairAura: this.els.crosshairAura,
            combatZone: this.els.combatZone,
        });

        let revolverRef = /** @type {Revolver | null} */ (null);

        this.reactive = createReactiveGameState({
            onScore: (v) => this.ui.setScore(v),
            onLives: (v) => this.ui.setLives(v),
            onChambersVisual: () => revolverRef?.renderCylinder(),
        });

        this.comboFever = new ComboFeverSystem({
            onComboChange: (combo) => this.ui.setCombo(combo),
            onScoreBonus: (amount) => this.ui.showFeverBonus(amount),
            onFeverStart: () => {
                this.revolver.forceCloseCylinder();
                for (let i = 0; i < 6; i++) {
                    this.reactive.state.chambers[i] = BULLET_STATE.LIVE;
                }
                revolverRef?.renderCylinder();
                this.ui.startFeverTimer();
                this.ui.flashStatus('FEVER TIME', '#fbbf24');
            },
            onFeverEnd: () => this.ui.stopFeverTimer(),
        });

        this.enemyManager = new EnemyManager(
            this.els.combatZone,
            () => this.reactive.state.isOpen,
            () => this.onEnemyPassedDeadline()
        );

        this.revolver = new Revolver(
            {
                cylinder: this.els.cylinder,
                revolverArea: this.els.revolverArea,
                slotsAnchor: this.els.slotsAnchor,
                pouch: this.els.pouch,
                ammoPanel: this.els.ammoPanel,
                muzzleFlash: this.els.muzzleFlash,
                dragProxy: this.els.dragProxy,
            },
            this.reactive.state,
            this.ui,
            this.enemyManager,
            this.reactive,
            this.comboFever,
        );
        revolverRef = this.revolver;
        this.gameStarted = false;
        this.lastTime = 0;

        this._boundKey = (e) => {
            if (!this.gameStarted) return;
            if (e.key.toLowerCase() === 'r') this.revolver.toggleCylinder();
        };
        this._boundCombatMouse = (e) => {
            if (!this.gameStarted) return;
            if (!this.reactive.state.isDragging) this.revolver.fire(e);
        };
        this._boundCombatMove = (e) => {
            if (!this.gameStarted) return;
            this.ui.updateCrosshairAura(e.clientX, e.clientY, this.comboFever.combo);
        };
        this._boundCombatLeave = () => {
            if (!this.gameStarted) return;
            this.ui.hideCrosshairAura();
        };
    }

    static cacheElements() {
        return {
            cylinder: /** @type {HTMLElement} */ (document.getElementById('cylinder')),
            revolverArea: /** @type {HTMLElement} */ (document.getElementById('cylinder-module')),
            slotsAnchor: /** @type {HTMLElement} */ (document.getElementById('slots-anchor')),
            pouch: /** @type {HTMLElement} */ (document.getElementById('pouch')),
            ammoPanel: /** @type {HTMLElement} */ (document.getElementById('ammo-panel')),
            combatZone: /** @type {HTMLElement} */ (document.getElementById('combat-zone')),
            statusText: /** @type {HTMLElement} */ (document.getElementById('status-text')),
            scoreDisplay: /** @type {HTMLElement} */ (document.getElementById('score-display')),
            livesDisplay: /** @type {HTMLElement} */ (document.getElementById('lives-display')),
            dragProxy: /** @type {HTMLElement} */ (document.getElementById('drag-proxy')),
            muzzleFlash: /** @type {HTMLElement} */ (document.getElementById('muzzle-flash')),
            comboDisplay: /** @type {HTMLElement} */ (document.getElementById('combo-display')),
            feverTimer: /** @type {HTMLElement} */ (document.getElementById('fever-timer')),
            feverTimerFill: /** @type {HTMLElement} */ (document.getElementById('fever-timer-fill')),
            feverVignette: /** @type {HTMLElement} */ (document.getElementById('fever-vignette')),
            crosshairAura: /** @type {HTMLElement} */ (document.getElementById('crosshair-aura')),
            startOverlay: /** @type {HTMLElement} */ (document.getElementById('start-overlay')),
            startBtn: /** @type {HTMLElement} */ (document.getElementById('start-btn')),
            countdownDisplay: /** @type {HTMLElement} */ (document.getElementById('countdown-display')),
        };
    }

    init() {
        this.ui.setScore(this.reactive.state.score);
        this.ui.setLives(this.reactive.state.lives);
        this.ui.setCombo(0);
        this.revolver.initPouch();
        this.revolver.setAmmoPanelVisible(false);
        this.revolver.renderCylinder();
        this.attachGlobalListeners();
        
        this.els.startBtn.addEventListener('click', () => this.startSequence());
    }

    startSequence() {
        this.els.startBtn.classList.add('hidden');
        this.els.countdownDisplay.classList.remove('hidden');
        let count = 3;
        this.els.countdownDisplay.textContent = count.toString();
        
        const interval = setInterval(() => {
            count--;
            if (count > 0) {
                this.els.countdownDisplay.textContent = count.toString();
            } else if (count === 0) {
                this.els.countdownDisplay.textContent = 'GO!';
            } else {
                clearInterval(interval);
                this.els.startOverlay.style.opacity = '0';
                setTimeout(() => {
                    this.els.startOverlay.style.display = 'none';
                    this.gameStarted = true;
                    this.lastTime = performance.now();
                    this.loop(this.lastTime);
                }, 300); // Wait for fade-out transition
            }
        }, 1000);
    }

    onEnemyPassedDeadline() {
        let lives = this.reactive.state.lives;
        if (lives > 0) {
            this.reactive.state.lives = lives - 1;
            if (this.reactive.state.lives === 0) {
                this.gameOver();
            }
        }
    }

    gameOver() {
        this.gameStarted = false;

        // Reset state
        this.reactive.state.lives = 8;
        this.reactive.state.score = 0;
        this.reactive.state.chambers = Array(6).fill(BULLET_STATE.LIVE);
        this.comboFever.combo = 0;
        this.ui.setCombo(0);
        if (this.comboFever.feverActive) {
            this.comboFever.endFever();
        }
        
        // Remove active enemies
        this.enemyManager.enemies.forEach(e => e.el.remove());
        this.enemyManager.enemies = [];
        this.enemyManager.spawnTimer = 0;
        
        // Reset revolver state if needed
        this.revolver.forceCloseCylinder();
        
        // Show start screen
        this.els.startOverlay.style.display = 'flex';
        this.els.startOverlay.style.opacity = '1';
        this.els.startBtn.classList.remove('hidden');
        this.els.countdownDisplay.classList.add('hidden');
    }

    attachGlobalListeners() {
        window.addEventListener('keydown', this._boundKey);
        this.els.combatZone.addEventListener('mousedown', this._boundCombatMouse);
        this.els.combatZone.addEventListener('mousemove', this._boundCombatMove);
        this.els.combatZone.addEventListener('mouseleave', this._boundCombatLeave);
        window.addEventListener('contextmenu', (e) => e.preventDefault());
    }

    loop(timestamp) {
        if (!this.gameStarted) {
            this.lastTime = 0;
            return;
        }
        
        if (this.lastTime === 0) this.lastTime = timestamp;
        const dt = timestamp - this.lastTime;
        this.lastTime = timestamp;

        this.comboFever.update();
        this.enemyManager.update(dt);
        requestAnimationFrame((ts) => this.loop(ts));
    }
}

window.addEventListener('DOMContentLoaded', () => {
    new Game().init();
});
