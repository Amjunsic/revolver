import { BULLET_STATE } from './state.js';

const POUCH_ROUND_CLASS = 'js-pouch-round';

export class Revolver {
    /**
     * @param {{
     * cylinder: HTMLElement;
     * revolverArea: HTMLElement;
     * slotsAnchor: HTMLElement;
     * pouch: HTMLElement;
     * ammoPanel: HTMLElement;
     * muzzleFlash: HTMLElement;
     * dragProxy: HTMLElement;
     * }} els
     * @param {object} state
     * @param {import('./ui.js').UIManager} ui
     * @param {import('./enemies.js').EnemyManager} enemyManager
     * @param {{ beginRevolverBatch: () => void; endRevolverBatch: () => void }} reactiveShell
     * @param {import('./comboFever.js').ComboFeverSystem} comboFever
     */
    constructor(els, state, ui, enemyManager, reactiveShell, comboFever) {
        this.cylinder = els.cylinder;
        this.revolverArea = els.revolverArea;
        this.slotsAnchor = els.slotsAnchor;
        this.pouch = els.pouch;
        this.ammoPanel = els.ammoPanel;
        this.muzzleFlash = els.muzzleFlash;
        this.dragProxy = els.dragProxy;
        this.state = state;
        this.ui = ui;
        this.enemyManager = enemyManager;
        this.reactiveShell = reactiveShell;
        this.comboFever = comboFever;
        this._ejectGeneration = 0;
        this._ejectTimeoutId = null;

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

        if (this.comboFever.isFeverActive()) {
            this.fireFeverShot(e);
            return;
        }

        const idx = this.state.currentIndex;
        const current = this.state.chambers[idx];

        this.reactiveShell.beginRevolverBatch();
        try {
            if (current === BULLET_STATE.LIVE) {
                this.showMuzzleFlash(e);
                this.state.chambers[idx] = BULLET_STATE.SPENT;
                this.resolveShot(e);
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

    fireFeverShot(e) {
        this.showMuzzleFlash(e);
        this.resolveShot(e);
        this.state.currentIndex = (this.state.currentIndex + 1) % 6;
        this.state.rotation -= 60;
        this.applyRotation();
        setTimeout(() => this.renderCylinder(), 100);
    }

    showMuzzleFlash(e) {
        this.muzzleFlash.style.left = `${e.clientX - 60}px`;
        this.muzzleFlash.style.top = `${e.clientY - 60}px`;
        this.muzzleFlash.style.opacity = '1';
        setTimeout(() => {
            this.muzzleFlash.style.opacity = '0';
        }, 50);
    }

    resolveShot(e) {
        if (this.enemyManager.tryHitAt(e.clientX, e.clientY)) {
            this.state.score += this.comboFever.getKillScore();
            this.comboFever.registerHit((bonus) => {
                this.state.score += bonus;
            });
            this.ui.flashStatus('TARGET NEUTRALIZED', '#4ade80');
        } else {
            this.comboFever.registerMiss();
            this.ui.flashStatus('BANG!', '#818cf8');
        }
    }

    setAmmoPanelVisible(visible) {
        this.ammoPanel.classList.toggle('ammo-panel--reload', visible);
        this.ammoPanel.setAttribute('aria-hidden', visible ? 'false' : 'true');
    }

    forceCloseCylinder() {
        if (!this.state.isOpen) return;
        this.cancelPendingEjectClear();
        this.cancelDrag();
        this.state.isOpen = false;
        this.cylinder.classList.remove('cylinder-open');
        this.setAmmoPanelVisible(false);
        this.renderCylinder();
    }

    toggleCylinder() {
        if (this.comboFever.isFeverActive()) {
            this.ui.flashStatus('FEVER TIME — KEEP FIRING', '#fbbf24');
            return;
        }

        if (!this.state.isOpen) {
            this.state.isOpen = true;
            this.cylinder.classList.add('cylinder-open');
            this.setAmmoPanelVisible(true);
            this.ejectBullets();
            this.ui.flashStatus('CYLINDER OPENED', '#6366f1');
        } else {
            this.cancelPendingEjectClear();
            this.cancelDrag();
            this.state.isOpen = false;
            this.cylinder.classList.remove('cylinder-open');
            this.setAmmoPanelVisible(false);
            this.ui.flashStatus('READY TO FIRE', '#94a3b8');
        }
        this.renderCylinder();
    }

    cancelPendingEjectClear() {
        this._ejectGeneration++;
        if (this._ejectTimeoutId !== null) {
            clearTimeout(this._ejectTimeoutId);
            this._ejectTimeoutId = null;
        }
    }

    ejectBullets() {
        this.cancelPendingEjectClear();
        const generation = this._ejectGeneration;

        const currentSlots = this.slotsAnchor.querySelectorAll('.bullet-slot > div:not(.slot-number)');
        currentSlots.forEach((el) => el.classList.add('bullet-ejecting'));

        this._ejectTimeoutId = setTimeout(() => {
            this._ejectTimeoutId = null;
            if (generation !== this._ejectGeneration) return;
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
        if (!this.state.isOpen) {
            this.dragProxy.style.left = `${e.clientX - 22}px`;
            this.dragProxy.style.top = `${e.clientY - 32}px`;
            this.dragProxy.style.transform = 'scale(1)';
            this.dragProxy.style.opacity = '1';
            return;
        }

        const cylRect = this.cylinder.getBoundingClientRect();
        const cylCenterX = cylRect.left + cylRect.width / 2;
        const cylCenterY = cylRect.top + cylRect.height / 2;

        const dist = Math.hypot(e.clientX - cylCenterX, e.clientY - cylCenterY);
        const snapRadius = 160; // 자석 끌림 및 감지 반응 반경 (픽셀 단위)

        if (dist < snapRadius) {
            // 비선형 가속도를 적용한 자성 끌림력 (가까울수록 자력이 제곱 비율로 증가)
            const force = Math.pow((snapRadius - dist) / snapRadius, 1.5);
            const targetX = e.clientX + (cylCenterX - e.clientX) * force;
            const targetY = e.clientY + (cylCenterY - e.clientY) * force;

            this.dragProxy.style.left = `${targetX - 22}px`;
            this.dragProxy.style.top = `${targetY - 32}px`;
            
            // 약실 안으로 수축되는 시각적 피드백 효과 추가
            this.dragProxy.style.transform = `scale(${1 - force * 0.15})`;
            this.dragProxy.style.opacity = `${1 - force * 0.2}`;
        } else {
            this.dragProxy.style.left = `${e.clientX - 22}px`;
            this.dragProxy.style.top = `${e.clientY - 32}px`;
            this.dragProxy.style.transform = 'scale(1)';
            this.dragProxy.style.opacity = '1';
        }
    }

    cancelDrag() {
        if (!this.state.isDragging) return;
        this.state.isDragging = false;
        this.dragProxy.style.display = 'none';
        this.dragProxy.style.transform = '';
        this.dragProxy.style.opacity = '';
        window.removeEventListener('mousemove', this._boundMoveProxy);
        window.removeEventListener('mouseup', this._boundStopDrag);
    }

    stopDrag(e) {
        this.cancelDrag();

        if (!this.state.isOpen) return;

        if (this.isPointNearCylinder(e.clientX, e.clientY)) {
            this.tryLoadNextEmptyChamber();
        }
    }

    isPointNearCylinder(x, y) {
        const cylRect = this.cylinder.getBoundingClientRect();
        const cylCenterX = cylRect.left + cylRect.width / 2;
        const cylCenterY = cylRect.top + cylRect.height / 2;
        
        const dist = Math.hypot(x - cylCenterX, y - cylCenterY);
        const snapRadius = 160; // moveProxy와 동일한 탐지 반경 적용
        
        return dist <= snapRadius;
    }

    /** First empty chamber from active index forward (wraps), one bullet per drop. */
    findNextEmptyChamberIndex() {
        const start = this.state.currentIndex;
        for (let offset = 0; offset < 6; offset++) {
            const idx = (start + offset) % 6;
            if (this.state.chambers[idx] === BULLET_STATE.EMPTY) return idx;
        }
        return -1;
    }

    tryLoadNextEmptyChamber() {
        const idx = this.findNextEmptyChamberIndex();
        if (idx === -1) {
            this.ui.flashStatus('CYLINDER FULL', '#94a3b8');
            return;
        }

        this.cancelPendingEjectClear();
        this.state.chambers[idx] = BULLET_STATE.LIVE;
        this.ui.flashStatus(`CHAMBER ${idx + 1} LOADED`, '#fbbf24');
    }
}