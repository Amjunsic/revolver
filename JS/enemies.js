export class EnemyManager {
    /**
     * @param {HTMLElement} combatZone
     * @param {() => boolean} isCylinderOpen
     * @param {() => void} onEnemyPassedDeadline
     */
    constructor(combatZone, isCylinderOpen, onEnemyPassedDeadline) {
        this.combatZone = combatZone;
        this.isCylinderOpen = isCylinderOpen;
        this.onEnemyPassedDeadline = onEnemyPassedDeadline;
        this.enemies = [];
        this.spawnTimer = 0;
        this.spawnInterval = 500;
        this.maxEnemies = 8;
        this.spawnY = -80;
        // Calculate total distance to deadline (window.innerHeight * 0.6)
        // Note: window.innerHeight could change, so we calculate per update if needed, but for speed let's do it per enemy movement
    }

    update(dt) {
        if (this.enemies.length < this.maxEnemies) {
            this.spawnTimer += dt;
            if (this.spawnTimer >= this.spawnInterval) {
                this.spawnTimer -= this.spawnInterval;
                this.spawnEnemy();
            }
        } else {
            // Pause spawn timer when max enemies reached
            this.spawnTimer = 0;
        }

        const deadlineY = window.innerHeight * 0.6;
        const totalDistance = deadlineY - this.spawnY;
        const baseSpeed = totalDistance / 8000; // pixels per ms to reach deadline in 8000ms
        const currentSpeed = this.isCylinderOpen() ? baseSpeed * 0.6 : baseSpeed;

        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const enemy = this.enemies[i];
            enemy.y += currentSpeed * dt;

            if (enemy.y >= deadlineY) {
                enemy.el.remove();
                this.enemies.splice(i, 1);
                this.onEnemyPassedDeadline();
            } else {
                enemy.el.style.top = `${enemy.y}px`;
            }
        }
    }

    spawnEnemy() {
        const el = document.createElement('div');
        el.className = 'enemy';
        el.style.left = `${Math.random() * (window.innerWidth - 100) + 50}px`;
        el.style.top = `${this.spawnY}px`;
        this.combatZone.appendChild(el);

        this.enemies.push({
            el: el,
            y: this.spawnY
        });
    }

    /** @returns {boolean} true if an enemy was hit */
    tryHitAt(x, y) {
        for (let i = 0; i < this.enemies.length; i++) {
            const enemy = this.enemies[i];
            const rect = enemy.el.getBoundingClientRect();
            if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
                enemy.el.remove();
                this.enemies.splice(i, 1);
                return true;
            }
        }
        return false;
    }
}
