import { createReactiveGameState } from './state.js';
import { UIManager } from './ui.js';
import { EnemyManager } from './enemies.js';
import { Revolver } from './revolver.js';

class Game {
    constructor() {
        this.els = Game.cacheElements();
        this.ui = new UIManager({
            scoreDisplay: this.els.scoreDisplay,
            statusText: this.els.statusText,
        });

        let revolverRef = /** @type {Revolver | null} */ (null);

        this.reactive = createReactiveGameState({
            onScore: (v) => this.ui.setScore(v),
            onChambersVisual: () => revolverRef?.renderCylinder(),
        });

        this.enemyManager = new EnemyManager(this.els.combatZone, () => this.reactive.state.score);

        this.revolver = new Revolver(
            {
                cylinder: this.els.cylinder,
                revolverArea: this.els.revolverArea,
                slotsAnchor: this.els.slotsAnchor,
                pouch: this.els.pouch,
                muzzleFlash: this.els.muzzleFlash,
                dragProxy: this.els.dragProxy,
            },
            this.reactive.state,
            this.ui,
            this.enemyManager,
            this.reactive,
        );
        revolverRef = this.revolver;

        this._boundKey = (e) => {
            if (e.key.toLowerCase() === 'r') this.revolver.toggleCylinder();
        };
        this._boundCombatMouse = (e) => {
            if (!this.reactive.state.isDragging) this.revolver.fire(e);
        };
    }

    static cacheElements() {
        return {
            cylinder: /** @type {HTMLElement} */ (document.getElementById('cylinder')),
            revolverArea: /** @type {HTMLElement} */ (document.getElementById('cylinder-module')),
            slotsAnchor: /** @type {HTMLElement} */ (document.getElementById('slots-anchor')),
            pouch: /** @type {HTMLElement} */ (document.getElementById('pouch')),
            combatZone: /** @type {HTMLElement} */ (document.getElementById('combat-zone')),
            statusText: /** @type {HTMLElement} */ (document.getElementById('status-text')),
            scoreDisplay: /** @type {HTMLElement} */ (document.getElementById('score-display')),
            dragProxy: /** @type {HTMLElement} */ (document.getElementById('drag-proxy')),
            muzzleFlash: /** @type {HTMLElement} */ (document.getElementById('muzzle-flash')),
        };
    }

    init() {
        this.ui.setScore(this.reactive.state.score);
        this.revolver.initPouch();
        this.revolver.renderCylinder();
        this.attachGlobalListeners();
        this.loop();
    }

    attachGlobalListeners() {
        window.addEventListener('keydown', this._boundKey);
        this.els.combatZone.addEventListener('mousedown', this._boundCombatMouse);
        window.addEventListener('contextmenu', (e) => e.preventDefault());
    }

    loop() {
        this.enemyManager.trySpawn();
        requestAnimationFrame(() => this.loop());
    }
}

window.addEventListener('DOMContentLoaded', () => {
    new Game().init();
});
