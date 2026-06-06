import * as THREE from "three";
import {CameraControls, dToR} from "./utils.js";
import Corner from "./CornerDimensions";
import Edge from "./EdgeDimensions";
import swapColors from "./swapColors";
import facesToHide from "./facesToHide";
import colorMatchUps from "./colorMatchUps";
import facePos from "./facePositions";
import calculateTurn from "./calculateTurn";
import "./MegaMinx.css"
import { useEffect, useRef, useState } from "react";
import Menu from "../Menu/Menu";
import ColorPicker from "../ColorPicker/ColorPicker";
import "../Menu/Menu.css";
import rightArrow from "./arrow.png";
import leftArrow from "./leftArrow.png";
import { isAllowedParentOrigin, DEFAULT_VIEW_ROBOT_FACE, ROBOT_FACE_TO_SIM, simPathToRobotPath } from "./robotFaceMap";
import { megaminxBridge, applyRobotCommand, embedDegreesPerMs, isSimulatorIdle, simulatorPendingMoves } from "./megaminxBridge";
import { installEmbedNavigationGuard } from "./embedNavigationGuard";
import { embedT, embedAlreadySolvedText, setEmbedLang, applyEmbedUiStrings } from "./embedI18n";
import { applyPieceColors } from "./applyPieceColors";
import revisedSolver from "../Solver/revisedSolver";
import { SOLVER_FACE_NAMES, VISUAL_FACE_HEX, buildHexToColor } from "./solverPalette";

const MegaMinx = ({reset}) => {
    const b = megaminxBridge;
    const isEmbed = useRef(false);
    if (isEmbed.current === false) {
        try {
            isEmbed.current = new URLSearchParams(window.location.search).get("embed") === "1";
        } catch (_) {
            isEmbed.current = false;
        }
    }
    if (isEmbed.current) {
        // Magnitude comes from frame delta; sign only marks turn direction.
        b.speed = 1;
        b.speedHolder = 1;
    }

    // Default colors for MegaMinx
    // const [faceColors, setFaceColors] = useState([
    //     "#0000ff",     // 1
    //     "#ff80ce",     // 2 pink
    //     "#ffff00",   // 3
    //     "#ff0000",      // 4
    //     "#008000",    // 5
    //     "#c585f7",  // 6 light purple

    //     "#4fc3f7",  // 7 light blue
    //     "#c39b77",  // 8 light brown
    //     "#64dd17",  // 9 light green
    //     "#ffa500",   // 10
    //     "#800080",   // 11
    //     "#ffffff"     // 12
    // ]);

    const [faceColors, setFaceColors] = useState([...VISUAL_FACE_HEX]);
    const faceColorsRef = useRef(faceColors);
    faceColorsRef.current = faceColors;
    const [, setEmbedMenuId] = useState(1);
    const embedMenuRef = useRef(null);
    const embedToggleRef = useRef(null);

    const toggleEmbedMenu = () => {
        const menu = embedMenuRef.current;
        const button = embedToggleRef.current;
        if (!menu || !button) return;
        const visible = !menu.classList.contains("menu-box-container--visible");
        menu.classList.toggle("menu-box-container--visible", visible);
        megaminxBridge.embedPaintEnabled = visible;
        document.body.classList.toggle("embed-paint-active", visible);
        button.setAttribute("aria-expanded", String(visible));
        button.dataset.paintMode = visible ? "on" : "off";
        button.title = visible ? embedT('doneTitle') : embedT('recolorTitle');
        button.textContent = visible ? embedT('done') : embedT('recolor');
    };

    
    /* Имена граней для solver — порядок = face1..face12 (см. Solver/pieces.js). Не менять. */
    const [colorNames] = useState([...SOLVER_FACE_NAMES]);

    // Added csc to Math library
    Math.csc = function(x) { return 1 / Math.sin(x); }

    // UI and megaminx controller variables
    let moveLog = [];
    let moveLogIndex = 0;
    let updateMouse = false; // Signals mouse can be updated in mousemove
    let currentFunc = "none"; // Current state of the menu
    let undoRedo = false;
    let moveSetter;
    let moveType;
    let moveCurrent;
    let modeSetter;
    let manualTurn = "none";

    // WebSocket and postMessage variables
    let ws = null;
    let isWebSocketConnected = false;

    // Used for touch/mouse rotations
    let startPoint = null;
    let newPoint = null;
    let selectedSide = null;
    let selectedPiece = null;

    // Threejs variables (MUST be singletons to avoid leaking WebGL contexts on React re-renders)
    if (!b.three) {
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        const raycaster = new THREE.Raycaster();
        const mouse = new THREE.Vector2();
        const controls = CameraControls(camera, renderer, scene);
        b.three = { scene, camera, renderer, raycaster, mouse, controls };
    }
    const { scene, camera, renderer, raycaster, mouse, controls } = b.three;

    // Set/Get manualTurn
    let getTurn = () => manualTurn;
    let setTurn = () => manualTurn="none";

    // Setter for moveQueue
    let setMoveQueue = (moves,force,setCurrentMove,currentMove,type,mode) => {
        if(force){
            b.moveQueue = moves;
            return;
        }
        moveSetter=setCurrentMove;
        moveType=moveType?moveType:type;
        moveCurrent=currentMove;
        modeSetter=mode;
        b.moveQueue = !b.moveQueue.length?moves:b.moveQueue;
    }

    let getCounter = () => b.counter;

    // getter and setter for speed holder
    let getSpeed = () => b.speedHolder;
    let setSpeed = speed => {
        switch(speed){
            case 0:
                b.speedHolder = .25;
                break;
            case 1:
                b.speedHolder = .5;
                break;
            case 2:
                b.speedHolder = 1;
                break;
            case 3:
                b.speedHolder = 3;
                break;
            case 4:
                b.speedHolder = 6;
                break;
            case 5:
                b.speedHolder = 12;
                break;
            case 6:
                b.speedHolder = 24;
                break;
            case 7:
                b.speedHolder = 72;
                break;
            default:
        }
        b.speedChanged=true
    }

    let reverseMove = move => {
        return move.split('').includes("'")?move.replace("'",""):move+"'"
    }

    //let getMoveLogIndex = () => moveLogIndex;
    let setMoveLogIndex = n => {

        if(n>=0&&moveLogIndex<=moveLog.length-1){
            undoRedo=true;
            b.moveQueue.push(moveLog[moveLogIndex])
            moveLogIndex++;
        } 

        else if(n<0&&moveLogIndex>0){
            undoRedo=true;
            moveLogIndex--;
            b.moveQueue.push(reverseMove(moveLog[moveLogIndex]));
        }

    }

    // getter and setter for currentFunc
    let currentFunction = () => currentFunc;
    let setCurrentFunction = func => currentFunc = func;

    let getCpVars = () => {return {camera,mouse,raycaster,scene};}
    
    // Holds references to all the rendered pieces
    let decaObject = {};
    let rightHints = {};
    let leftHints = {};

    let getDeca = () => decaObject;
    
    // Set background color and size
    renderer.setClearColor(new THREE.Color("black"),0);
    renderer.domElement.className = "canvas";
    renderer.setSize( window.innerWidth, window.innerHeight);

    const defaultCameraDistance = 15;

    const aimCameraAtSimFace = (simFace) => {
        const faceKey = `face${simFace}`;
        const centerMesh = decaObject[faceKey]?.front?.[1];
        if (!centerMesh) return;
        const center = new THREE.Vector3();
        centerMesh.getWorldPosition(center);
        if (center.lengthSq() < 1e-6) return;
        camera.position.copy(center.normalize().multiplyScalar(defaultCameraDistance));
        controls.target.set(0, 0, 0);
        controls.update();
    };
 
    function onMouseDown(e) {
        // В iframe (viewer) — только камера, без ручных поворотов граней
        if (isEmbed.current) return;

        // update mouse position
        mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;

        // reset piece selection data
        startPoint = null;
        selectedSide = null;
        selectedPiece = null;
        
        // Set the raycaster to check for intersected objects
        raycaster.setFromCamera( mouse, camera );

        const intersects = raycaster.intersectObjects( scene.children );

        // Filter only pieces that should be interacted with
        let filteredIntersects = intersects.filter(
            e=>e.object.name==="corner"||e.object.name==="edge"
        );

        // if a piece is intersected disable camera rotation
        if(intersects[0]) {
            controls.enabled = false;
        }

        // Enable mouse movement position updating
        if(
            filteredIntersects[0] && 
            !b.moveQueue.length 
            && ["none","solver","patterns"].includes(currentFunc)
        ){
            updateMouse = true;

            // Values to be used for touch turns
            selectedPiece = filteredIntersects[0].object.piece;

            // Testing for piece 8 first
            if((selectedPiece>0&&selectedPiece<11)){
                startPoint = filteredIntersects[0].uv;
                selectedSide = filteredIntersects[0].object.side;
            }
        }
        // For non interactable pieces
        else if(!filteredIntersects[0]&&intersects[0]){
            updateMouse = true;
            selectedPiece = intersects[0].object.piece;
        }

        // Change the clicked piece color to the selected color
        if(currentFunc==="colorpicker"&&filteredIntersects[0]){
            //filteredIntersects[0].object.material.color.set(currentColor)
        }
    }

    function onMouseUp(e) {
        controls.enabled = true;
        updateMouse=false;
    }

    function onMouseMove(e){
        if (isEmbed.current) return;
        if(currentFunc === "colorpicker") return;
        if(e.pointerType==="touch") controls.enabled = true;
        // If no piece was clicked end function
        if(!updateMouse) {
            return;
        }
        
        // Get new mouse coordinates
        mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;

        // set up raycaster to detect intersected objects
        raycaster.setFromCamera( mouse, camera );

        // any intersected objects go in here
        const intersects = raycaster.intersectObjects( scene.children );

        // Filter only pieces that should be interacted with
        let filteredIntersects = intersects.filter(
            e=>e.object.name==="corner"||e.object.name==="edge"
        );

        if(filteredIntersects[0]){
            newPoint = filteredIntersects[0].uv;
            let turn = calculateTurn(startPoint,newPoint,selectedSide,selectedPiece);
            if(turn) {
                updateMouse=false;
                startPoint=null;
                newPoint=null;
                selectedSide=null;
                selectedPiece=null;
                if(currentFunc === "solver") manualTurn=turn;
                else b.moveQueue.push(turn);
            }
        }
        else if(!filteredIntersects[0]&&intersects[0]){
            if(!startPoint) return;
            let turn = calculateTurn(startPoint,newPoint,selectedSide,selectedPiece,true);
            if(turn) {
                updateMouse=false;
                startPoint=null;
                newPoint=null;
                selectedSide=null;
                selectedPiece=null;
                if(currentFunc === "solver") manualTurn=turn;
                else b.moveQueue.push(turn);
            }
        }
    }

    // ================= WebSocket + postMessage integration =================
    const connectWebSocket = () => {
        // In iframe embed mode we control the simulator via postMessage from viewer.html.
        // Also, on https pages an insecure ws:// connection will throw and can break init.
        const params = new URLSearchParams(window.location.search);
        const isEmbed = params.get("embed") === "1";
        if (isEmbed) return;

        const socketUrl = 'ws://130.49.143.78:8765';
        try {
            ws = new WebSocket(socketUrl);
        } catch (e) {
            console.warn('[Simulator] WebSocket init failed (ignored):', e);
            ws = null;
            return;
        }

        ws.onopen = () => {
            console.log('[Simulator] WebSocket Connected');
            isWebSocketConnected = true;
        };

        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                console.log('[Simulator] Received WebSocket command:', data);
                handleCommand(data);
            } catch (error) {
                console.error('[Simulator] Failed to parse WebSocket message:', error);
            }
        };

        ws.onerror = (error) => {
            console.error('[Simulator] WebSocket Error:', error);
            isWebSocketConnected = false;
        };

        ws.onclose = () => {
            console.log('[Simulator] WebSocket Disconnected');
            isWebSocketConnected = false;
            setTimeout(connectWebSocket, 5000);
        };
    };

    const handleCommand = (data) => applyRobotCommand(data);

    // Handle postMessage from parent window (iframe context)
    const handlePostMessage = (event) => {
        if (!isAllowedParentOrigin(event.origin)) return;
        const data = event.data;
        if (data && data.type === 'megaminx_command') {
            console.log('[Simulator] Received postMessage command:', data);
            handleCommand({ command: data.command, params: data.params });
        } else if (data && data.type === 'megaminx_set_lang') {
            setEmbedLang(data.lang);
        }
    };
    // ======================================================================

    // Event listeners
    window.addEventListener("resize", 
        () => {
            let tanFOV = Math.tan( ( ( Math.PI / 180 ) * camera.fov / 2 ) );
            let windowHeight = window.innerHeight;

            camera.aspect = window.innerWidth / window.innerHeight;
            
            // adjust the FOV
            camera.fov = ( 360 / Math.PI ) * Math.atan( tanFOV * ( window.innerHeight / windowHeight ) );
            
            camera.updateProjectionMatrix();
            camera.lookAt( scene.position );

            renderer.setSize( window.innerWidth, window.innerHeight );
            renderer.render( scene, camera );
        }, false
    );

    useEffect(()=>{

        function removeElementsByClass(className){
            const elements = document.getElementsByClassName(className);
            while(elements.length > 0){
                elements[0].parentNode.removeChild(elements[0]);
            }
        }
        removeElementsByClass("canvas");

        document.body.children[1].appendChild( renderer.domElement );
        window.addEventListener("pointerdown",onMouseDown,false);
        window.addEventListener("pointerup",onMouseUp,false);
        window.addEventListener("pointermove",onMouseMove,false);

        // Prevent disappearing cube on WebGL context loss (common on mobile/weak GPUs).
        const onContextLost = (e) => {
            e.preventDefault();
            console.warn('[Simulator] WebGL context lost');
        };
        const onContextRestored = () => {
            console.warn('[Simulator] WebGL context restored, reloading');
            window.location.reload();
        };
        renderer.domElement.addEventListener('webglcontextlost', onContextLost, false);
        renderer.domElement.addEventListener('webglcontextrestored', onContextRestored, false);

        connectWebSocket();
        window.addEventListener('message', handlePostMessage, false);

        let removeEmbedNavGuard = null;
        let embedUiTimer = null;
        if (isEmbed.current) {
            removeEmbedNavGuard = installEmbedNavigationGuard();
            megaminxBridge.embedUi = { button: null, colorLabel: null };
            const registerEmbedUi = () => {
                megaminxBridge.embedUi.button = embedToggleRef.current;
                megaminxBridge.embedUi.colorLabel = document.querySelector(
                    '.embed-color-picker .total-moves > div:first-child'
                );
                applyEmbedUiStrings();
            };
            registerEmbedUi();
            embedUiTimer = setTimeout(registerEmbedUi, 150);
            window.roborubiksSetLang = (lang) => setEmbedLang(lang);
        }

        window.roborubiksApplyFaceColors = (payload) => {
            if (!payload) return;
            applyPieceColors(decaObject, payload);
            renderer.render(scene, camera);
        };

        window.roborubiksGetSolvePath = () => {
            const hexToColor = buildHexToColor(faceColorsRef.current);
            const moves = revisedSolver(getDeca(), SOLVER_FACE_NAMES, hexToColor);
            if (!moves || moves[0] === "error") return null;
            if (!moves.length) return embedAlreadySolvedText();
            return simPathToRobotPath(moves.join("."));
        };

        window.roborubiksSimulatorIdle = () => isSimulatorIdle();
        window.roborubiksPendingMoves = () => simulatorPendingMoves();

        if (megaminxBridge.pendingColors) {
            window.roborubiksApplyFaceColors(megaminxBridge.pendingColors);
            megaminxBridge.pendingColors = null;
        }

        const notifyParentReady = () => {
            if (window.parent === window) return;
            let targetOrigin = window.location.origin;
            try {
                if (document.referrer) targetOrigin = new URL(document.referrer).origin;
            } catch (_) { /* ignore */ }
            window.parent.postMessage({ type: 'megaminx_ready' }, targetOrigin);
        };
        notifyParentReady();
        const readyTimers = [500, 1500, 3000].map((ms) => setTimeout(notifyParentReady, ms));

        return function cleanup () {
            readyTimers.forEach(clearTimeout);
            if (embedUiTimer) clearTimeout(embedUiTimer);
            if (removeEmbedNavGuard) removeEmbedNavGuard();
            delete window.roborubiksApplyFaceColors;
            delete window.roborubiksGetSolvePath;
            delete window.roborubiksSimulatorIdle;
            delete window.roborubiksPendingMoves;
            delete window.roborubiksSetLang;
            window.removeEventListener("pointerdown",onMouseDown,false);
            window.removeEventListener("pointerup",onMouseUp,false);
            window.removeEventListener("pointermove",onMouseMove,false);
            renderer.domElement.removeEventListener('webglcontextlost', onContextLost, false);
            renderer.domElement.removeEventListener('webglcontextrestored', onContextRestored, false);
            window.removeEventListener('message', handlePostMessage, false);
            if (ws) {
                ws.close();
            }
        }
    }, [])

    useEffect(() => {
        if (isEmbed.current) setCurrentFunction("colorpicker");
    }, []);

    // ================= 3D model generation (unchanged) =================
    function pentagonMesh(n,translate,rotate,color,i)
    {
        let pentagonMesh,pentagonMesh2;
        const lineWidth = .97;
        n=n?n:1;
        color=color?color:"grey";
        const pentagon = new THREE.Shape();
        const pentagon2 = new THREE.Shape();

        // https://mathworld.wolfram.com/RegularPentagon.html
        const c1 = Math.cos((2*Math.PI)/5);
        const c2 = Math.cos(Math.PI/5);
        const s1 = Math.sin((2*Math.PI)/5);
        const s2 = Math.sin((4*Math.PI)/5);
        
        pentagon.moveTo(0, 1*n);
        pentagon.lineTo(s1*n, c1*n);
        pentagon.lineTo(s2*n, -c2*n);
        pentagon.lineTo(-s2*n, -c2*n);
        pentagon.lineTo(-s1*n, c1*n);

        pentagon2.moveTo((0)*lineWidth, (1*n)*lineWidth);
        pentagon2.lineTo((s1*n)*lineWidth, (c1*n)*lineWidth);
        pentagon2.lineTo((s2*n)*lineWidth, (-c2*n)*lineWidth);
        pentagon2.lineTo((-s2*n)*lineWidth, (-c2*n)*lineWidth);
        pentagon2.lineTo((-s1*n)*lineWidth, (c1*n)*lineWidth);
        
        const geometry = new THREE.ShapeGeometry(pentagon);
        const geometry2 = new THREE.ShapeGeometry(pentagon2);
    
        const material = new THREE.MeshBasicMaterial({
            color: "black",
            side: THREE.DoubleSide,
            depthWrite: true,
        });
        const material2 = new THREE.MeshBasicMaterial({
            color: color,
            side: THREE.FrontSide,
            depthWrite: true,
            });
    
        pentagonMesh = new THREE.Mesh(geometry,material);
        pentagonMesh2 = new THREE.Mesh(geometry2,material2);
        pentagonMesh2.name = "center";
        pentagonMesh2.side = colorNames[i];;
        

        let offsetZ =.205;
        let offsetY = -.81;

        pentagonMesh.translateZ(translate?.z||0)

        pentagonMesh.rotateZ(rotate?.z||0)
        pentagonMesh.rotateY(rotate?.y||0)
        
        pentagonMesh.translateY(translate?.y||0)
        pentagonMesh.translateX(translate?.x||0)

        pentagonMesh.rotateX(rotate?.x||0)

        pentagonMesh.translateZ(-translate?.y/2+offsetZ||0)
        pentagonMesh.translateY(translate?.y/2+offsetY||0)

        i<6?
            pentagonMesh2.translateZ(translate?.z+.01||0):
            pentagonMesh2.translateZ(translate?.z-.01||0)

        pentagonMesh2.rotateZ(rotate?.z||0)
        pentagonMesh2.rotateY(rotate?.y||0)
        
        pentagonMesh2.translateY(translate?.y||0)
        pentagonMesh2.translateX(translate?.x||0)

        pentagonMesh2.rotateX(rotate?.x||0)

        pentagonMesh2.translateZ(-translate?.y/2+offsetZ||0)
        pentagonMesh2.translateY(translate?.y/2+offsetY||0)
        
        scene.add(pentagonMesh,pentagonMesh2);       

        // Adds all front pieces faces in decaObject
        decaObject[`face${i+1}`].front.push(pentagonMesh,pentagonMesh2);
    }

    // 
    function squareMesh (n,position,position2,translate,rotate,color,i,piece)
    {
        const square = new THREE.Shape();
        const square2 = new THREE.Shape();

        //console.log(square.lineTo)
        square.moveTo(...position.p1,5);
        square.lineTo(...position.p2,1);
        square.lineTo(...position.p3,3);
        square.lineTo(...position.p4,4);

        square2.moveTo(...position2.p1,5);
        square2.lineTo(...position2.p2,1);
        square2.lineTo(...position2.p3,3);
        square2.lineTo(...position2.p4,4);

        const geometry = new THREE.ShapeGeometry(square);
        const geometry2 = new THREE.ShapeGeometry(square2);

        const material = new THREE.MeshBasicMaterial({
            color: "black",
            side: THREE.DoubleSide,
            depthWrite: true
        });
        const material2 = new THREE.MeshBasicMaterial({
            color: color,
            side: THREE.FrontSide,
            depthWrite: true
        });

        let squareMesh = new THREE.Mesh(geometry,material);
        let squareMesh2 = new THREE.Mesh(geometry2,material2);
        if(piece>0&&piece<6) squareMesh2.name="corner";
        if(piece>5&&piece<11) squareMesh2.name="edge";

        squareMesh2.piece = piece;
        squareMesh2.side = colorNames[i];

        squareMesh2.scale.set(.95,.95)

        squareMesh.translateZ(translate?.z||0)
        i<6?
            squareMesh2.translateZ(translate?.z+.005||0):
            squareMesh2.translateZ(translate?.z-.005||0)

        let offsetZ =.205;
        let offsetY = -.81;
        
        // Black background (outline effect)
        squareMesh.rotateZ(rotate?.z||0)
        squareMesh.rotateY(rotate?.y||0)
        
        squareMesh.translateY(translate?.y||0)
        squareMesh.translateX(translate?.x||0)

        squareMesh.rotateX(rotate?.x||0)

        squareMesh.translateZ(-translate?.y/2+offsetZ||0)
        squareMesh.translateY(translate?.y/2+offsetY||0)

        // Colored inner face
        squareMesh2.rotateZ(rotate?.z||0)
        squareMesh2.rotateY(rotate?.y||0)
        
        squareMesh2.translateY(translate?.y||0)
        squareMesh2.translateX(translate?.x||0)

        squareMesh2.rotateX(rotate?.x||0)

        squareMesh2.translateZ(-translate?.y/2+offsetZ||0)
        squareMesh2.translateY(translate?.y/2+offsetY||0)


        if(piece>10){
            squareMesh.rotateZ(dToR(-36+-(72*(piece-11))))
            squareMesh.rotateX(dToR(-63.2))

            squareMesh2.rotateZ(dToR(-36+-(72*(piece-11))))
            squareMesh2.rotateX(dToR(-63.2))

            squareMesh.translateZ(1.625)
            squareMesh.translateY(-1)

            squareMesh2.translateZ(1.631)
            squareMesh2.translateY(-.895)
        }

        scene.add(squareMesh,squareMesh2);

        // Adds all front pieces faces in decaObject
        piece<11?
            decaObject[`face${i+1}`].front.push(squareMesh,squareMesh2):
            decaObject[`face${i+1}`].sides.push(squareMesh,squareMesh2);

        if(piece>10) {
            squareMesh.visible=false;
            squareMesh2.visible=false;
        }
        
    }

    const loader = new THREE.TextureLoader();
    const right = loader.load(rightArrow);
    const left = loader.load(leftArrow);
    // Prevents bluring
    right.anisotropy = renderer.capabilities.getMaxAnisotropy();
    left.anisotropy = renderer.capabilities.getMaxAnisotropy();

    function hintArrowMesh (rotate,i,piece,direction){
        const geometry = new THREE.PlaneGeometry( 2, 1 );
        const material = new THREE.MeshBasicMaterial( {
            side: THREE.FrontSide,
            map: direction==="right"?right:left,
            transparent: true,
            opacity:.8
        } );
        const plane = new THREE.Mesh( geometry, material );
        
        // Black background (outline effect)
        plane.rotateZ(rotate?.z||0)
        plane.rotateY(rotate?.y||0)
        

        plane.rotateX(rotate?.x||0)

        plane.rotateZ(dToR(-36+-(72*(piece-11))))
        plane.rotateX(dToR(-63.2))

        plane.translateZ(3)
        plane.translateY(-1.3)
        scene.add( plane );
        if(!rightHints[`${i+1}`]) rightHints[`${i+1}`] = [];
        if(!leftHints[`${i+1}'`]) leftHints[`${i+1}'`] = [];
        direction==="right"?rightHints[`${i+1}`][piece-11] = plane:leftHints[`${i+1}'`][piece-11] = plane
        plane.visible=false;
    }
    //hintArrowMesh();

    // array of face colors/hex in the order they're generated
    
    
    // groups all the meshes for a face together
    function decaFace(n,translate,rotate,color,i){
            //if(i>1) return
        // generate object structure on each face initialization

        pentagonMesh(n,translate,rotate,color,i);

        squareMesh(n,Corner(n,"face1","corner1"),Corner(n,"face1","corner1",1),translate,rotate,color,i,1);
        squareMesh(n,Corner(n,"face1","corner2"),Corner(n,"face1","corner2",1),translate,rotate,color,i,2);
        squareMesh(n,Corner(n,"face1","corner3"),Corner(n,"face1","corner3",1),translate,rotate,color,i,3);
        squareMesh(n,Corner(n,"face1","corner4"),Corner(n,"face1","corner4",1),translate,rotate,color,i,4);
        squareMesh(n,Corner(n,"face1","corner5"),Corner(n,"face1","corner5",1),translate,rotate,color,i,5);

        squareMesh(n,Edge(n,"face1","edge1"),Edge(n,"face1","edge1",1),translate,rotate,color,i,6)
        squareMesh(n,Edge(n,"face1","edge2"),Edge(n,"face1","edge2",1),translate,rotate,color,i,7)
        squareMesh(n,Edge(n,"face1","edge3"),Edge(n,"face1","edge3",1),translate,rotate,color,i,8)
        squareMesh(n,Edge(n,"face1","edge4"),Edge(n,"face1","edge4",1),translate,rotate,color,i,9)
        squareMesh(n,Edge(n,"face1","edge5"),Edge(n,"face1","edge5",1),translate,rotate,color,i,10)

        squareMesh(n,Edge(n,"sides","side1"),Edge(n,"sides","side1",2),translate,rotate,color,i,11);
        squareMesh(n,Edge(n,"sides","side1"),Edge(n,"sides","side1",2),translate,rotate,color,i,12);
        squareMesh(n,Edge(n,"sides","side1"),Edge(n,"sides","side1",2),translate,rotate,color,i,13);
        squareMesh(n,Edge(n,"sides","side1"),Edge(n,"sides","side1",2),translate,rotate,color,i,14);
        squareMesh(n,Edge(n,"sides","side1"),Edge(n,"sides","side1",2),translate,rotate,color,i,15);

        hintArrowMesh(rotate,i,11,'right');
        hintArrowMesh(rotate,i,12,'right');
        hintArrowMesh(rotate,i,13,'right');
        hintArrowMesh(rotate,i,14,'right');
        hintArrowMesh(rotate,i,15,'right');

        hintArrowMesh(rotate,i,11,'left');
        hintArrowMesh(rotate,i,12,'left');
        hintArrowMesh(rotate,i,13,'left');
        hintArrowMesh(rotate,i,14,'left');
        hintArrowMesh(rotate,i,15,'left');

        squareMesh(n,Corner(n,"sides","side1a"),Corner(n,"sides","side1a",1),translate,rotate,color,i,16);
        squareMesh(n,Corner(n,"sides","side1a"),Corner(n,"sides","side1a",1),translate,rotate,color,i,17);
        squareMesh(n,Corner(n,"sides","side1a"),Corner(n,"sides","side1a",1),translate,rotate,color,i,18);
        squareMesh(n,Corner(n,"sides","side1a"),Corner(n,"sides","side1a",1),translate,rotate,color,i,19);
        squareMesh(n,Corner(n,"sides","side1a"),Corner(n,"sides","side1a",1),translate,rotate,color,i,20);

        squareMesh(n,Corner(n,"sides","side1b"),Corner(n,"sides","side1b",1),translate,rotate,color,i,21);
        squareMesh(n,Corner(n,"sides","side1b"),Corner(n,"sides","side1b",1),translate,rotate,color,i,22);
        squareMesh(n,Corner(n,"sides","side1b"),Corner(n,"sides","side1b",1),translate,rotate,color,i,23);
        squareMesh(n,Corner(n,"sides","side1b"),Corner(n,"sides","side1b",1),translate,rotate,color,i,24);
        squareMesh(n,Corner(n,"sides","side1b"),Corner(n,"sides","side1b",1),translate,rotate,color,i,25);
    }

    // Generate object of piece references
    facePos.forEach((set,i)=>{decaObject[`face${i+1}`]={front : [],sides : []}});

    // Put the MegaMinx on the screen!
    facePos.forEach((set,i)=>decaFace(1,set.translate,set.rotate,faceColors[i],i));

    const viewFace =
        new URLSearchParams(window.location.search).get("view") ||
        DEFAULT_VIEW_ROBOT_FACE;
    const viewSimFace = ROBOT_FACE_TO_SIM[viewFace] || ROBOT_FACE_TO_SIM[DEFAULT_VIEW_ROBOT_FACE];
    if (viewSimFace) aimCameraAtSimFace(viewSimFace);

    renderer.render(scene, camera);

    // Rotates a given face of the megaminx
    let rotateFace = (face, frameDeltaMs = null) => {
        let tempSpeed = b.speed;
        const embedTimedStep =
            frameDeltaMs != null &&
            isEmbed.current &&
            b.faceToRotate !== "face0";
        if (embedTimedStep) {
            tempSpeed = embedDegreesPerMs() * frameDeltaMs * Math.sign(b.speed || 1);
        }

        // if a move isn't currently being made
        if(b.counter===0&&b.faceToRotate==="face0"){

            // update speed changes
            if(b.speedChanged){
                b.speedChanged = false;
                b.speed = b.speedHolder;
                tempSpeed=b.speed;
            }

            // moveLog handling
            if(b.moveQueue[0]) {
                let move = b.moveQueue.shift();
                b.faceToRotate='face'+move;


                // if a move is being made in the middle of the log, snip tail
                if(!undoRedo) {
                    moveLog = moveLog.slice(0,moveLogIndex);
                    moveLogIndex++;
                    moveLog.push(move);
                }

                else {
                    undoRedo=false;
                }

                if(b.faceToRotate.split('').includes("'")){
                    b.faceToRotate=b.faceToRotate.replace("'","");
                    b.speed = Math.abs(b.speed);
                }else {
                    b.speed = Math.abs(b.speed)*-1;
                }
            }
            else if(currentFunction()==="scramble") {
                setCurrentFunction("none");
                //console.log(moveLog);
            }
            else if(currentFunction()==="solver") {
                if(modeSetter){
                    modeSetter("");
                }
                modeSetter=undefined;
                moveType=undefined;
                moveSetter=undefined;
                moveCurrent=undefined;
            }
            return;
        }

        // Controls what happens at the end of each turn
        if(Math.abs(b.counter) >= 72) {
            if(currentFunc==="solver"&&!moveType){
                if(moveCurrent){
                    moveCurrent.includes("'")?
                    leftHints[`${moveCurrent}`].forEach(arrow=>arrow.visible=true):
                    rightHints[`${moveCurrent}`].forEach(arrow=>arrow.visible=true)
                }
            }
            if(moveCurrent!==undefined) {
                if(moveType==="play") {
                    moveCurrent++;
                    moveSetter(moveCurrent);
                }
                else if(moveType==="back"){
                    moveCurrent--;
                    moveSetter(moveCurrent);
                }
            }
            // Rotate face sides back to original position
            decaObject[face].sides.forEach((piece,i)=>{
                piece.visible = false;

                if(i%2){
                    piece.translateZ(-1.631)
                    piece.translateY(.895)
                } 
                
                else {
                    piece.translateZ(-1.625)
                    piece.translateY(1)
                }

                piece.rotateX(dToR(63.2))

                b.counter<0?
                    piece.rotateZ(dToR(Math.abs(b.counter))):
                    piece.rotateZ(dToR(Math.abs(b.counter)*-1));

                piece.rotateX(dToR(-63.2))

                if(i%2){
                    piece.translateZ(1.631)
                    piece.translateY(-.895)
                } 
                
                else {
                    piece.translateZ(1.625)
                    piece.translateY(-1)
                }
            });

            // Rotate face back to original position
            decaObject[face].front.forEach((piece,i)=>{
                b.counter<0?
                    piece.rotateZ(dToR(Math.abs(b.counter))):
                    piece.rotateZ(dToR(Math.abs(b.counter)*-1));
            });

            // Show face pieces that were hidden during turn
            facesToHide[face].forEach(piece=>{
                decaObject[`face${piece.face}`].front[piece.pos].visible=true;
            });

            // Move colors around
            swapColors(face,decaObject,b.speed);

            b.counter=0;
            b.faceToRotate="face0"
            return;
        }

        if (Math.abs(tempSpeed) + Math.abs(b.counter) > 72) {
            tempSpeed = (72 - Math.abs(b.counter)) * (b.counter / Math.abs(b.counter));
        }

        facesToHide[face].forEach(piece=>{
            decaObject[`face${piece.face}`].front[piece.pos].visible=false;
        });

        decaObject[face].front.forEach((piece,i)=>{
            
            piece.rotateZ(dToR(tempSpeed));
        });

        decaObject[face].sides.forEach((piece,i)=>{
            piece.visible = true;
            
            if(i%2&&i<30) {
                let {side,pos} = colorMatchUps[face][`${i}`]
                piece.material.color.set(
                    decaObject[`face${side}`].front[pos].material.color
                );
            }
            if(i===111){
                piece.material.color.set(
                    "grey",
                );
            }
            if(i%2){
                piece.translateZ(-1.631)
                piece.translateY(.895)
            } else {
                piece.translateZ(-1.625)
                piece.translateY(1)
            }
                piece.rotateX(dToR(63.2))

                piece.rotateZ(dToR(tempSpeed));

                piece.rotateX(dToR(-63.2))

            if(i%2){
                piece.translateZ(1.631)
                piece.translateY(-.895)
            } else {
                piece.translateZ(1.625)
                piece.translateY(-1)
            }
            
        })
        b.counter += embedTimedStep ? tempSpeed : b.speed;
    }

    if (!b.animateStarted) {
        b.animateStarted = true;
        let lastFrameMs = performance.now();
        const animate = (now) => {
            const t = now ?? performance.now();
            const frameDeltaMs = Math.min(t - lastFrameMs, 50);
            lastFrameMs = t;
            rotateFace(
                b.faceToRotate,
                isEmbed.current ? frameDeltaMs : null
            );
            controls.update();
            renderer.render( scene, camera );
            requestAnimationFrame(animate);
        };
        requestAnimationFrame(animate);
    }
    const hexToColor = (() => {
        const temp = {};
        faceColors.forEach((color, i) => {
            temp[`${faceColors[i].replace('#', '').toLowerCase()}`] = colorNames[i];
        });
        return temp;
    })();

    const colorPickerProps = {
        setMenuId: setEmbedMenuId,
        setCurrentFunction,
        resetMegaMinx: reset,
        getDeca,
        getCpVars,
        colorNames,
        faceColors,
        hexToColor,
    };

    return isEmbed.current ? (
        <>
            <button
                type="button"
                ref={embedToggleRef}
                className="menu-panel-toggle"
                aria-expanded="false"
                aria-controls="embedColorMenu"
                title={embedT('recolorTitle')}
                onClick={toggleEmbedMenu}
            >
                {embedT('recolor')}
            </button>
            <div
                id="embedColorMenu"
                ref={embedMenuRef}
                className="menu-box-container embed-color-picker"
            >
                <div className="menu-box">
                    <ColorPicker {...colorPickerProps} embedMode />
                </div>
            </div>
        </>
    ) : (
        <Menu
            setMoveQueue={setMoveQueue}
            resetMegaMinx={reset}
            reset={reset}
            setCurrentFunction={setCurrentFunction}
            currentFunction={currentFunction}
            setSpeed={setSpeed}
            speed={getSpeed}
            setMoveLogIndex={setMoveLogIndex}
            decaObject={decaObject}
            getDeca={getDeca}
            getCpVars={getCpVars}
            getCounter={getCounter}
            rightHints={rightHints}
            leftHints={leftHints}
            getTurn={getTurn}
            setTurn={setTurn}
            hexToColor={hexToColor}
            faceColors={faceColors}
            setFaceColors={setFaceColors}
            colorNames={colorNames}
        />
    );
}

export default MegaMinx;