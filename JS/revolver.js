import { BULLET_STATE } from './state.js';

const POUCH_ROUND_CLASS = 'js-pouch-round';

export class Revolver {
    /**
     * @param {{
     *   cylinder: HTMLElement;
     *   slotsAnchor: HTMLElement;
     *   pouch: HTMLElement;
     *   muzzleFlash: HTMLElement;
     *   dragProxy: HTMLElement;
     * }} els
     * @param {object} state
     * @param {import('./ui.js').UIManager} ui
     * @param {import('./enemies.js').EnemyManager} enemyManager
     * @param {{ beginRevolverBatch: () => void; endRevolverBatch: () => void }} reactiveShell
     */
    constructor(els, state, ui, enemyManager, reactiveShell) {
        this.cylinder = els.cylinder;
        this.slotsAnchor = els.slotsAnchor;
        this.pouch = els.pouch;
        this.muzzleFlash = els.muzzleFlash;
        this.dragProxy = els.dragProxy;
        this.state = state;
        this.ui = ui;
        this.enemyManager = enemyManager;
        this.reactiveShell = reactiveShell;

        this._boundMoveProxy = (e) => this.moveProxy(e);
        this._boundStopDrag = (e) => this.stopDrag(e);
    }

    initPouch() {
        this.pouch.innerHTML = '';
        for (let i = 0; i < 8; i++) {
            const bullet = document.createElement('div');
            bullet.className = `${POUCH_ROUND_CLASS} w-10 h-16 bg-amber-600 rounded-md border-t-4 border-amber-400 cursor-grab active:cursor-grabbing hover:brightness-125 transition-all shadow-lg`;
            this.pouch.appendChild(bullet);
        }
        this.pouch.addEventListener('mousedown', (e) => {
            const round = e.target.closest(`.${POUCH_ROUND_CLASS}`);
            if (!round || !this.pouch.contains(round)) return;
            e.stopPropagation();
            this.startDrag(e);
        });
    }

    applyRotation() {
        this.cylinder.style.transform = `rotate(${this.state.rotation}deg)`;
    }

    renderCylinder() {
        this.slotsAnchor.innerHTML = '';
        for (let i = 0; i < 6; i++) {
            const angle = i * 60;
            const rad = (angle - 90) * (Math.PI / 180);
            const radius = 100;
            const x = Math.cos(rad) * radius + 150 - 30;
            const y = Math.sin(rad) * radius + 150 - 37.5;

            const slot = document.createElement('div');
            const isActive = i === this.state.currentIndex;
            slot.className = `bullet-slot ${isActive ? 'slot-active' : ''}`;
            slot.style.left = `${x}px`;
            slot.style.top = `${y}px`;
            slot.style.transform = `rotate(${angle}deg)`;
            slot.dataset.index = String(i);

            const num = document.createElement('span');
            num.className = 'slot-number';
            num.innerText = String(i + 1);
            slot.appendChild(num);

            const chamber = this.state.chambers[i];
            if (chamber === BULLET_STATE.LIVE) {
                const b = document.createElement('div');
                b.className = 'bullet-visual';
                slot.appendChild(b);
            } else if (chamber === BULLET_STATE.SPENT) {
                const s = document.createElement('div');
                s.className = 'spent-shell';
                slot.appendChild(s);
            }

            this.slotsAnchor.appendChild(slot);
        }
        this.applyRotation();
    }

    fire(e) {
        if (this.state.isOpen) return;

        const idx = this.state.currentIndex;
        const current = this.state.chambers[idx];

        this.reactiveShell.beginRevolverBatch();
        try {
            if (current === BULLET_STATE.LIVE) {
                this.muzzleFlash.style.left = `${e.clientX - 60}px`;
                this.muzzleFlash.style.top = `${e.clientY - 60}px`;
                this.muzzleFlash.style.opacity = '1';
                setTimeout(() => {
                    this.muzzleFlash.style.opacity = '0';
                }, 50);

                this.state.chambers[idx] = BULLET_STATE.SPENT;
                if (this.enemyManager.tryHitAt(e.clientX, e.clientY)) {
                    this.state.score += 100;
                    this.ui.flashStatus('TARGET NEUTRALIZED', '#4ade80');
                } else {
                    this.ui.flashStatus('BANG!', '#818cf8');
                }
            } else {
                this.muzzleFlash.style.opacity = '0';
                this.ui.flashStatus('CLICK', '#94a3b8');
            }

            this.state.currentIndex = (this.state.currentIndex + 1) % 6;
            this.state.rotation -= 60;
        } finally {
            this.reactiveShell.endRevolverBatch();
        }

        this.applyRotation();
        setTimeout(() => this.renderCylinder(), 100);
    }

    toggleCylinder() {
        if (!this.state.isOpen) {
            this.state.isOpen = true;
            this.cylinder.classList.add('cylinder-open');
            this.ejectBullets();
            this.ui.flashStatus('CYLINDER OPENED', '#6366f1');
        } else {
            this.state.isOpen = false;
            this.cylinder.classList.remove('cylinder-open');
            this.ui.flashStatus('READY TO FIRE', '#94a3b8');
        }
        this.renderCylinder();
    }

    ejectBullets() {
        const currentSlots = this.slotsAnchor.querySelectorAll('.bullet-slot > div:not(.slot-number)');
        currentSlots.forEach((el) => el.classList.add('bullet-ejecting'));

        setTimeout(() => {
            this.state.chambers = Array(6).fill(BULLET_STATE.EMPTY);
        }, 600);
    }

    startDrag(e) {
        this.state.isDragging = true;
        this.dragProxy.style.display = 'block';
        this.moveProxy(e);
        window.addEventListener('mousemove', this._boundMoveProxy);
        window.addEventListener('mouseup', this._boundStopDrag);
    }

    moveProxy(e) {
        this.dragProxy.style.left = `${e.clientX - 22}px`;
        this.dragProxy.style.top = `${e.clientY - 32}px`;
    }

    stopDrag(e) {
        this.state.isDragging = false;
        this.dragProxy.style.display = 'none';
        window.removeEventListener('mousemove', this._boundMoveProxy);
        window.removeEventListener('mouseup', this._boundStopDrag);

        if (!this.state.isOpen) return;

        const slots = document.querySelectorAll('.bullet-slot');
        let closestSlot = null;
        let minDistance = 60;

        slots.forEach((slot) => {
            const rect = slot.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;
            const dist = Math.hypot(e.clientX - centerX, e.clientY - centerY);
            if (dist < minDistance) {
                minDistance = dist;
                closestSlot = slot;
            }
        });

        if (closestSlot) {
            const idx = parseInt(closestSlot.dataset.index, 10);
            if (this.state.chambers[idx] === BULLET_STATE.EMPTY) {
                this.state.chambers[idx] = BULLET_STATE.LIVE;
                this.ui.flashStatus(`CHAMBER ${idx + 1} LOADED`, '#fbbf24');
            }
        }
    }
}
