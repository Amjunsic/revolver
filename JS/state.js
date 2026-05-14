/** Chamber contents — numeric enum avoids string typos at call sites. */
export const BULLET_STATE = Object.freeze({
    LIVE: 0,
    SPENT: 1,
    EMPTY: 2,
});

/**
 * @param {{
 *   onScore?: (score: number) => void;
 *   onChambersVisual?: () => void;
 * }} handlers
 */
export function createReactiveGameState(handlers) {
    let revolverBatchDepth = 0;

    const raw = {
        isOpen: false,
        rotation: 0,
        currentIndex: 0,
        chambers: Array(6).fill(BULLET_STATE.LIVE),
        score: 0,
        isDragging: false,
    };

    function wrapChambers(arr) {
        return new Proxy(arr, {
            set(target, prop, value, receiver) {
                const ok = Reflect.set(target, prop, value, receiver);
                if (
                    ok &&
                    prop !== 'length' &&
                    (typeof prop === 'string' ? !Number.isNaN(Number(prop)) : typeof prop === 'number')
                ) {
                    if (revolverBatchDepth === 0) handlers.onChambersVisual?.();
                }
                return ok;
            },
        });
    }

    raw.chambers = wrapChambers(raw.chambers);

    const proxy = new Proxy(raw, {
        set(target, prop, value, receiver) {
            if (prop === 'chambers' && Array.isArray(value)) {
                value = wrapChambers([...value]);
            }
            const ok = Reflect.set(target, prop, value, receiver);
            if (!ok) return false;

            if (revolverBatchDepth > 0) return true;

            switch (prop) {
                case 'score':
                    handlers.onScore?.(value);
                    break;
                case 'currentIndex':
                case 'chambers':
                    handlers.onChambersVisual?.();
                    break;
                default:
                    break;
            }
            return true;
        },
    });

    return {
        state: proxy,
        beginRevolverBatch() {
            revolverBatchDepth++;
        },
        endRevolverBatch() {
            revolverBatchDepth = Math.max(0, revolverBatchDepth - 1);
        },
    };
}
