import { useEffect, useState } from "react";
import revisedSolver from "../Solver/revisedSolver"
import { megaminxBridge } from "../MegaMinx/megaminxBridge";
import { embedT } from "../MegaMinx/embedI18n";
import "./ColorPicker.css";

const ColorPicker = ({getCpVars,getDeca,setMenuId,setCurrentFunction,resetMegaMinx,colorNames,faceColors,hexToColor,embedMode = false}) => {
    // array of face colors in the order they're generated
    const [selected,setSelected] = useState(0);
    const [status,setStatus] = useState("Solve");

    function onMouseDown(e) {
        if (embedMode && !megaminxBridge.embedPaintEnabled) return;
        if (e.target.closest(".color-menu-container, .menu-panel-toggle")) return;

        let {mouse,camera,raycaster,scene} = getCpVars();
        mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
        
        // Set the raycaster to check for intersected objects
        raycaster.setFromCamera( mouse, camera );

        const intersects = raycaster.intersectObjects( scene.children );

        // Filter only pieces that should be interacted with
        let filteredIntersects = intersects.filter(
            e=>e.object.name==="corner"||e.object.name==="edge"
        );

        if(filteredIntersects[0]){
            if (megaminxBridge.three?.controls) {
                megaminxBridge.three.controls.enabled = false;
            }
            filteredIntersects[0].object.material.color.set(faceColors[selected]);
            e.stopPropagation();
            let check = revisedSolver(getDeca(),colorNames,hexToColor)[0];
            check==="error"?setStatus("Invalid"):setStatus("Solve")
        }
    }

    function onMouseUp() {
        if (embedMode && megaminxBridge.three?.controls) {
            megaminxBridge.three.controls.enabled = true;
        }
    }

    useEffect(()=>{
        window.addEventListener("pointerdown",onMouseDown,false);
        window.addEventListener("pointerup",onMouseUp,false);

        return function cleanup () {
            window.removeEventListener("pointerdown",onMouseDown,false)
            window.removeEventListener("pointerup",onMouseUp,false)
        }
    },[selected]);

    let switchToSolver = currentStatus => {
        if(currentStatus==="Solve"){
            setMenuId(2);
            setCurrentFunction("solver")
        }
    }


    return (
        <div className="color-menu-container">
            <div className="cp-info-panel">
                <div className="total-moves">
                    <div>{embedMode ? embedT('colorLabel') : "Current Color:"}</div>
                    <div 
                        className={`cp-info-data ${colorNames[selected]}`}
                        style={{backgroundColor:`${faceColors[selected]}`}}
                    ></div>
                </div>
            </div>
            <div className="color-menu">
                {colorNames.map((color,i)=>
                    <div 
                        className={`color-button ${color.replace(' ','-')}`} 
                        key={color}
                        style={{backgroundColor:`${faceColors[i]}`}}
                        onClick={
                            ()=>{
                                setSelected(i);
                            }
                        }
                    >
                        <div className="holder-text">Color buttons</div>
                        {i===selected?
                            <div className="blackdot"></div>:<></>
                        }
                    </div>
                )}
            </div>
            {!embedMode ? (
            <div className="color-options">
                <div className="option-button color-exit" onClick=
                    {()=>{
                        setMenuId(0);
                        setCurrentFunction('none');
                        resetMegaMinx();
                    }}
                >
                    <strong>Exit</strong>
                </div>
                <div className={`option-button color-check ${status}`} onClick={()=>switchToSolver(status)}>
                    <strong>{status}{status==="Solve"?"r!":""}</strong>
                </div>
            </div>
            ) : null}
            
        </div>
        
    )

}

export default ColorPicker;