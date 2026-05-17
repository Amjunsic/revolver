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

    /**
     * 마우스 좌표를 기준으로 실린더의 각 약실(슬롯) 위치와의 거리를 계산하여
     * 가장 가까운 약실 인덱스 및 해당 중심 좌표, 거리를 반환합니다.
     */
    getClosestChamber(clientX, clientY) {
        const cylRect = this.cylinder.getBoundingClientRect();
        const cylCenterX = cylRect.left + cylRect.width / 2;
        const cylCenterY = cylRect.top + cylRect.height / 2;
        const radius = 100; // renderCylinder의 배치 반경과 일치

        let closestIndex = -1;
        let minDistance = Infinity;
        let closestCoords = null;

        for (let i = 0; i < 6; i++) {
            // 실린더 회전각(this.state.rotation)과 12시 기점 보정(-90도)을 적용하여 현재 뷰포트 내 슬롯 중심 계산
            const angle = i * 60 - 90 + this.state.rotation;
            const rad = angle * (Math.PI / 180);
            const slotX = cylCenterX + Math.cos(rad) * radius;
            const slotY = cylCenterY + Math.sin(rad) * radius;

            const dist = Math.hypot(clientX - slotX, clientY - slotY);
            if (dist < minDistance) {
                minDistance = dist;
                closestIndex = i;
                closestCoords = { x: slotX, y: slotY };
            }
        }

        return { index: closestIndex, distance: minDistance, coords: closestCoords };
    }

    /** 타겟팅된 특정 슬롯을 시각적으로 강조하는 효과 */
    highlightSlot(index) {
        const slots = this.slotsAnchor.querySelectorAll('.bullet-slot');
        slots.forEach((slot) => {
            const i = parseInt(slot.dataset.index, 10);
            const angle = i * 60;
            if (i === index) {
                // 타겟팅 시 확대 및 밝기 향상
                slot.style.transform = `rotate(${angle}deg) scale(1.18)`;
                slot.style.filter = 'brightness(1.3)';
            } else {
                slot.style.transform = `rotate(${angle}deg) scale(1)`;
                slot.style.filter = '';
            }
        });
    }

    /** 슬롯 강조 효과 초기화 */
    clearSlotHighlights() {
        const slots = this.slotsAnchor.querySelectorAll('.bullet-slot');
        slots.forEach((slot) => {
            const i = parseInt(slot.dataset.index, 10);
            const angle = i * 60;
            slot.style.transform = `rotate(${angle}deg) scale(1)`;
            slot.style.filter = '';
        });
    }

    moveProxy(e) {
        if (!this.state.isOpen) {
            this.dragProxy.style.left = `${e.clientX - 22}px`;
            this.dragProxy.style.top = `${e.clientY - 32}px`;
            this.dragProxy.style.transform = 'scale(1)';
            this.dragProxy.style.opacity = '1';
            return;
        }

        const snapRadius = 80; // 각 개별 약실(슬롯)의 감지 반응 반경 (픽셀 단위)
        const closest = this.getClosestChamber(e.clientX, e.clientY);

        if (closest.index !== -1 && closest.distance < snapRadius) {
            // 타겟 슬롯 중심을 향한 비선형 자력 강도 계산 (가까울수록 자성 증가)
            const force = Math.pow((snapRadius - closest.distance) / snapRadius, 1.5);
            const targetX = e.clientX + (closest.coords.x - e.clientX) * force;
            const targetY = e.clientY + (closest.coords.y - e.clientY) * force;

            this.dragProxy.style.left = `${targetX - 22}px`;
            this.dragProxy.style.top = `${targetY - 32}px`;
            
            // 약실 내부로 쏙 들어가는 느낌을 주기 위한 스케일 및 투명도 피드백
            this.dragProxy.style.transform = `scale(${1 - force * 0.2})`;
            this.dragProxy.style.opacity = `${1 - force * 0.25}`;

            // 대상 슬롯 강조
            this.highlightSlot(closest.index);
        } else {
            // 자성 탐지 영역 밖인 경우 자유 드래그 상태
            this.dragProxy.style.left = `${e.clientX - 22}px`;
            this.dragProxy.style.top = `${e.clientY - 32}px`;
            this.dragProxy.style.transform = 'scale(1)';
            this.dragProxy.style.opacity = '1';

            this.clearSlotHighlights();
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
        
        this.clearSlotHighlights();
    }

    stopDrag(e) {
        this.cancelDrag();

        if (!this.state.isOpen) return;

        const snapRadius = 80;
        const closest = this.getClosestChamber(e.clientX, e.clientY);

        // 드롭 시점에 특정 약실의 자성 범위 내에 위치해 있다면 해당 약실에 삽입 시도
        if (closest.index !== -1 && closest.distance <= snapRadius) {
            this.tryLoadChamber(closest.index);
        }
    }

    /** 6개 슬롯 중 자성 영역에 하나라도 포함되어 있는지 여부 판단 (호환성 유지용) */
    isPointNearCylinder(x, y) {
        const snapRadius = 80;
        const closest = this.getClosestChamber(x, y);
        return closest.index !== -1 && closest.distance <= snapRadius;
    }

    /** 첫 번째로 만나는 비어있는 약실 인덱스 반환 (호환성 유지용) */
    findNextEmptyChamberIndex() {
        const start = this.state.currentIndex;
        for (let offset = 0; offset < 6; offset++) {
            const idx = (start + offset) % 6;
            if (this.state.chambers[idx] === BULLET_STATE.EMPTY) return idx;
        }
        return -1;
    }

    /** 드래그한 특정 슬롯에 직접 장전 */
    tryLoadChamber(idx) {
        if (this.state.chambers[idx] !== BULLET_STATE.EMPTY) {
            this.ui.flashStatus(`CHAMBER ${idx + 1} ALREADY FULL`, '#ef4444');
            return;
        }

        this.cancelPendingEjectClear();
        this.state.chambers[idx] = BULLET_STATE.LIVE;
        this.ui.flashStatus(`CHAMBER ${idx + 1} LOADED`, '#fbbf24');
        this.renderCylinder(); // 즉시 그래픽 갱신
    }

    /** 기존의 순차 장전 메서드 (호환성 유지용) */
    tryLoadNextEmptyChamber() {
        const idx = this.findNextEmptyChamberIndex();
        if (idx === -1) {
            this.ui.flashStatus('CYLINDER FULL', '#94a3b8');
            return;
        }

        this.cancelPendingEjectClear();
        this.state.chambers[idx] = BULLET_STATE.LIVE;
        this.ui.flashStatus(`CHAMBER ${idx + 1} LOADED`, '#fbbf24');
        this.renderCylinder();
    }
}