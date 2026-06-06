// Face colors and motor mapping for viewer.html
(function initViewerConfig(global) {
    const side = {
        U: 'white',
        D: 'grey',
        F: 'green',
        B: 'salad',
        L: 'purple',
        R: 'red',
        BL: 'yellow',
        BR: 'blue',
        FL: 'light_blue',
        FR: 'desert',
        DL: 'orange',
        DR: 'pink',
    };

    const colorMap = {
        white: '#ffffff',
        grey: '#96938E',
        green: '#3A7728',
        salad: '#BEF702',
        purple: '#930FA5',
        red: '#CC0C00',
        yellow: '#FFD816',
        blue: '#0038A8',
        light_blue: '#5ad0e2',
        desert: '#FCCE87',
        orange: '#F96B07',
        pink: '#ED72AA',
    };

    const template = [
        { code: 'U', motor_id: 1 },
        { code: 'D', motor_id: 12 },
        { code: 'F', motor_id: 2 },
        { code: 'B', motor_id: 11 },
        { code: 'L', motor_id: 6 },
        { code: 'R', motor_id: 3 },
        { code: 'BL', motor_id: 5 },
        { code: 'BR', motor_id: 4 },
        { code: 'FL', motor_id: 8 },
        { code: 'FR', motor_id: 9 },
        { code: 'DL', motor_id: 10 },
        { code: 'DR', motor_id: 7 },
    ];

    let faceConfig = [];

    function rebuildFaceConfig() {
        const nameFor = (code) => (global.viewerI18n ? global.viewerI18n.faceName(code) : code);
        faceConfig = template.map((item) => ({
            code: item.code,
            name: nameFor(item.code),
            color: colorMap[side[item.code]] || '#000000',
            motor_id: item.motor_id,
        }));
        global.viewerConfig.faceConfig = faceConfig;
        return faceConfig;
    }

    const isBrightColor = (hexColor) => {
        const hex = hexColor.replace('#', '');
        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);
        const brightness = (r * 299 + g * 587 + b * 114) / 1000;
        return brightness > 155;
    };

    global.viewerConfig = {
        side,
        colorMap,
        template,
        get faceConfig() { return faceConfig; },
        isBrightColor,
        rebuild: rebuildFaceConfig,
    };

    rebuildFaceConfig();

    global.addEventListener('viewer:langchange', () => rebuildFaceConfig());
})(window);
