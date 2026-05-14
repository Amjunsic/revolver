export class EnemyManager {
    /**
     * @param {HTMLElement} combatZone
     * @param {() => number} getScore
     */
    constructor(combatZone, getScore) {
        this.combatZone = combatZone;
        this.getScore = getScore;
    }

    trySpawn(probability = 0.02) {
        if (Math.random() < probability) this.spawnEnemy();
    }

    spawnEnemy() {
        const enemy = document.createElement('div');
        enemy.className = 'enemy';
        enemy.style.left = `${Math.random() * (window.innerWidth - 100) + 50}px`;
        enemy.style.top = '-80px';
        this.combatZone.appendChild(enemy);

        const speed = 2 + this.getScore() / 3000;
        const interval = setInterval(() => {
            const top = parseFloat(enemy.style.top);
            if (top > window.innerHeight * 0.6) {
                clearInterval(interval);
                enemy.remove();
            } else {
                enemy.style.top = `${top + speed}px`;
            }
        }, 20);
    }

    /** @returns {boolean} true if an enemy was hit */
    tryHitAt(x, y) {
        const enemies = this.combatZone.getElementsByClassName('enemy');
        for (const enemy of enemies) {
            const rect = enemy.getBoundingClientRect();
            if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
                enemy.remove();
                return true;
            }
        }
        return false;
    }
}
