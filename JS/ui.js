export class UIManager {
    /** @param {{ scoreDisplay: HTMLElement; statusText: HTMLElement }} els */
    constructor(els) {
        this.scoreDisplay = els.scoreDisplay;
        this.statusText = els.statusText;
    }

    setScore(score) {
        this.scoreDisplay.innerText = `SCORE: ${score}`;
    }

    flashStatus(msg, color) {
        this.statusText.innerText = msg;
        this.statusText.style.color = color;
        setTimeout(() => {
            this.statusText.style.color = '#64748b';
        }, 1500);
    }
}
