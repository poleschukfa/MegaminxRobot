import { megaminxBridge } from './megaminxBridge';

const EMBED_STRINGS = {
    ru: {
        recolor: 'Перекрасить',
        done: 'Готово',
        recolorTitle: 'Перекрасить грани',
        doneTitle: 'Закрыть режим перекраски',
        colorLabel: 'Цвет:',
        alreadySolved: 'уже собрано',
    },
    en: {
        recolor: 'Recolor',
        done: 'Done',
        recolorTitle: 'Recolor faces',
        doneTitle: 'Close recolor mode',
        colorLabel: 'Color:',
        alreadySolved: 'already solved',
    },
};

export function getEmbedLang() {
    if (megaminxBridge.embedLang === 'en' || megaminxBridge.embedLang === 'ru') {
        return megaminxBridge.embedLang;
    }
    try {
        const q = new URLSearchParams(window.location.search).get('lang');
        if (q === 'en' || q === 'ru') return q;
    } catch (_) { /* ignore */ }
    try {
        if (window.parent !== window) {
            const ref = document.referrer;
            if (ref) {
                const pl = new URL(ref).searchParams.get('lang');
                if (pl === 'en' || pl === 'ru') return pl;
            }
        }
    } catch (_) { /* ignore */ }
    return (navigator.language || '').toLowerCase().startsWith('en') ? 'en' : 'ru';
}

export function embedT(key) {
    const lang = getEmbedLang();
    const table = EMBED_STRINGS[lang] || EMBED_STRINGS.ru;
    return table[key] ?? EMBED_STRINGS.ru[key] ?? key;
}

export function embedAlreadySolvedText() {
    return embedT('alreadySolved');
}

export function applyEmbedUiStrings() {
    const ui = megaminxBridge.embedUi;
    const button = ui?.button || document.querySelector('.menu-panel-toggle');
    if (button) {
        const visible = button.getAttribute('aria-expanded') === 'true';
        button.title = visible ? embedT('doneTitle') : embedT('recolorTitle');
        button.textContent = visible ? embedT('done') : embedT('recolor');
    }
    const colorLabel =
        ui?.colorLabel ||
        document.querySelector('.embed-color-picker .total-moves > div:first-child');
    if (colorLabel) colorLabel.textContent = embedT('colorLabel');
}

export function setEmbedLang(lang) {
    if (lang !== 'en' && lang !== 'ru') return;
    megaminxBridge.embedLang = lang;
    applyEmbedUiStrings();
}
