class BlochSphere {
    constructor(qubitIndex) {
      
       this.qubitIndex = qubitIndex;
      
      // Create the scene directly inside the BlochSphere
      this.scene = new THREE.Scene();
  
      // Create scene elements
      this.radius = 1;
      this.segments = 96;
      this.axisLength = 5;
  
      // Create the three circle outlines forming the sphere
      this.circleXY = this.createCircleOutline(this.radius, this.segments, new THREE.Euler(0, 0, 0));
      this.circleYZ = this.createCircleOutline(this.radius, this.segments, new THREE.Euler(Math.PI / 2, 0, 0));
      this.circleXZ = this.createCircleOutline(this.radius, this.segments, new THREE.Euler(0, Math.PI / 2, 0));
  
      // Create translucent sphere
      this.translucentSphere = this.createTranslucentSphere();
  
      // Create axes
      this.xAxis = this.createAxis(0xff0000, [new THREE.Vector3(-this.axisLength, 0, 0), new THREE.Vector3(this.axisLength, 0, 0)]);
      this.yAxis = this.createAxis(0x00ff00, [new THREE.Vector3(0, -this.axisLength, 0), new THREE.Vector3(0, this.axisLength, 0)]);
      this.zAxis = this.createAxis(0x0000ff, [new THREE.Vector3(0, 0, -this.axisLength), new THREE.Vector3(0, 0, this.axisLength)]);
  
      // Create the rotation group
      this.rotationGroup = new THREE.Group();
      this.scene.add(this.rotationGroup);
  
      // Create line and ball
      this.line = this.createLine();
      this.ball = this.createBall();
      this.rotationGroup.add(this.ball);
  
      // Set initial scene rotation
      this.scene.rotation.x = Math.PI / 2;
  
      // Set initial camera position
      this.camera = new THREE.PerspectiveCamera(70, 1, 0.1, 1000);
      this.camera.position.set(1.2, 1.2, -1.2);
      this.camera.lookAt(0, 0, 0);
  
      // Create renderer if not passed
      this.renderer = new THREE.WebGLRenderer();
      this.renderer.setSize(150, 150);
      this.renderer.setClearColor(0xffffff, 1);
  
      // Append the renderer to the document body
      this.blochDiv = document.createElement("div");
      this.blochDiv.id = "blochDiv" + qubitIndex;
      this.blochDiv.appendChild(this.renderer.domElement);
      document.getElementById("bloch-sphere").insertBefore(this.blochDiv, document.getElementById("bloch-sphere").firstChild);
      this.blochDivHeader = document.createElement("p");
      this.blochDivHeader.innerText = "Qubit " + qubitIndex;
      this.blochDivHeader.id = "blochDivHeader" + qubitIndex;
      this.blochDiv.appendChild(this.blochDivHeader);

      this.blochDivState = document.createElement("div");
      this.blochDivState.classList.add("progress");
      this.blochDivState.style.width = "100%";

      this.blochDivState0 = document.createElement("div");
      this.blochDivState0.classList.add("progress-bar", "bg-danger", "progress-bar-striped", "progress-bar-animated");
      this.blochDivState0.id = "blochDivStateZero" + qubitIndex;
      

      this.blochDivState1 = document.createElement("div");
      this.blochDivState1.classList.add("progress-bar", "bg-success", "progress-bar-striped", "progress-bar-animated");
      this.blochDivState1.id = "blochDivStateOne" + qubitIndex;
      this.blochDivState.id = "blochDivState" + qubitIndex;
     

      this.blochDivState.appendChild(this.blochDivState0);
      this.blochDivState.appendChild(this.blochDivState1);

      this.blochDiv.appendChild(this.blochDivState);

      
  
      // Add everything to the scene
      this.scene.add(this.circleXY);
      this.scene.add(this.circleYZ);
      this.scene.add(this.circleXZ);
      this.scene.add(this.translucentSphere);
      this.scene.add(this.xAxis);
      this.scene.add(this.yAxis);
      this.scene.add(this.zAxis);
      this.scene.add(this.rotationGroup);
    }
  
    // Helper function to create circle outlines
    createCircleOutline(radius, segments, rotation) {
      const geometry = new THREE.RingGeometry(radius - 0.05, radius + 0.05, segments);
      const material = new THREE.MeshBasicMaterial({ color: 0x777777, wireframe: true });
      const circle = new THREE.Mesh(geometry, material);
      circle.rotation.set(rotation.x, rotation.y, rotation.z);
      return circle;
    }
  
    // Create the translucent sphere
    createTranslucentSphere() {
      const sphereGeometry = new THREE.SphereGeometry(1, 24, 24);
      const sphereMaterial = new THREE.MeshBasicMaterial({
        color: 0xdddddd,
        transparent: true,
        opacity: 0.3
      });
      return new THREE.Mesh(sphereGeometry, sphereMaterial);
    }
  
    // Create axes
    createAxis(color, points) {
      const axisMaterial = new THREE.LineBasicMaterial({ color });
      const axisGeometry = new THREE.BufferGeometry().setFromPoints(points);
      return new THREE.Line(axisGeometry, axisMaterial);
    }
  
    // Create the line from the center
    createLine() {
      const lineMaterial = new THREE.LineBasicMaterial({
        color: 0x000000,
        linewidth: 2 // Make line thicker
      });
      const lineGeometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0), // start at the center of the sphere
        new THREE.Vector3(0.5, 0, 0)  // initial end point
      ]);
      return new THREE.Line(lineGeometry, lineMaterial);
    }
  
    // Create the small ball at the tip of the line
    createBall() {
      const ballGeometry = new THREE.SphereGeometry(0.1, 16, 16);
      const ballMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
      const ball = new THREE.Mesh(ballGeometry, ballMaterial);
      ball.position.set(1, 0, 0); // Position at the initial tip of the line
      return ball;
    }
  
    // Function to set the position of the ball based on a qubit matrix
    setPosition(qubit) {
      const a = qubit[0][0]; // Real part of alpha
      const b = qubit[0][1]; // Imaginary part of alpha
      const c = qubit[1][0]; // Real part of beta
      const d = qubit[1][1]; // Imaginary part of beta
  
      // Calculate magnitudes of alpha and beta
      const magnitudeAlpha = Math.sqrt(a * a + b * b);
      const magnitudeBeta = Math.sqrt(c * c + d * d);
  
      // Calculate theta from the magnitude of alpha (cosine of the angle from the Z-axis)
      const theta = 2 * Math.acos(magnitudeAlpha);
  
      // Calculate the phase difference (phi) between alpha and beta
      const phi = Math.atan2(b, a) - Math.atan2(d, c);
  
      // Now calculate the coordinates on the Bloch sphere
      const x = Math.sin(theta) * Math.cos(phi);
      const y = Math.sin(theta) * Math.sin(phi);
      const z = -Math.cos(theta);
  
      // Update the line geometry with the new position
      this.line.geometry.setFromPoints([
        new THREE.Vector3(0, 0, 0),  // start at the center of the sphere
        new THREE.Vector3(x, y, z)   // dynamic end point
      ]);
  
      // Notify Three.js that geometry has changed
      this.line.geometry.attributes.position.needsUpdate = true;
  
      // Update ball's position to match the line's end point
      this.ball.position.set(x, y, z);
    }
  
    // Function to remove the Bloch sphere from its scene
    removeAll() {
      this.scene.remove(this.circleXY);
      this.scene.remove(this.circleYZ);
      this.scene.remove(this.circleXZ);
      this.scene.remove(this.translucentSphere);
      this.scene.remove(this.xAxis);
      this.scene.remove(this.yAxis);
      this.scene.remove(this.zAxis);
      this.scene.remove(this.rotationGroup);

      document.getElementById("blochDiv" + this.qubitIndex).remove();
    }
  
    // Render method to display the Bloch sphere
    render() {
      this.renderer.render(this.scene, this.camera);
    }
  }


let blochSpheres = [];

let qubits = 0;
let stateVector = [[1,0]];
let gates = []; // Track placed gates
let highestCol = -1;
let zeroProbToggleValue = 0;
let precisionValue = 2;

const MISC_COLOR = "DarkOrchid";
const X_COLOR = "IndianRed";
const Y_COLOR = "LightGreen";
const Z_COLOR = "LightSkyBlue";
const C_COLOR = "Plum";

// Gate matrices (2x2 for single qubit, 4x4 for two qubits CNOT)
const GATE_MATRIX_DICTIONARY = {
    'I': [[
        [ [1, 0], [0, 0]],
        [ [0, 0], [1, 0]]
    ], "Identity Matrix", MISC_COLOR],
    'X': [[
        [ [0, 0], [1, 0] ],
        [ [1, 0], [0, 0] ]
    ], "Pauli-X Gate", X_COLOR],
    'Y': [[
        [ [0, 0], [0, 1] ],
        [ [0, -1], [0, 0] ]
    ], "Pauli-Y Gate", Y_COLOR],
    'Z': [[
        [ [Math.cos(Math.PI / 2), -Math.sin(Math.PI / 2)], [0, 0] ],
        [ [0, 0], [Math.cos(Math.PI / 2), Math.sin(Math.PI / 2)] ]
    ], "Pauli-Z Gate", Z_COLOR],
    'H': [[
        [ [1 / Math.sqrt(2), 0], [1 / Math.sqrt(2), 0] ],
        [ [1 / Math.sqrt(2), 0], [-1 / Math.sqrt(2), 0] ]
    ], "Hadamard Gate", MISC_COLOR],
    'XH': [[ // √X
        [ [Math.cos(Math.PI * 1/2 / 2), 0],
          [0, -Math.sin(Math.PI * 1/2 / 2)]],
        [ [0, -Math.sin(Math.PI * 1/2 / 2)], 
          [Math.cos(Math.PI * 1/2 / 2), 0] ]
    ], "√X Gate", X_COLOR],
    'XF': [[ // X^(1/4)
        [ [Math.cos(Math.PI * 1/4 / 2), 0],
          [0, -Math.sin(Math.PI * 1/4 / 2)]],
        [ [0, -Math.sin(Math.PI * 1/4 / 2)], 
          [Math.cos(Math.PI * 1/4 / 2), 0] ]
    ], "X^¼ Gate", X_COLOR],
    'YH': [[ // √Y
        [ [Math.cos(Math.PI * 1/2 / 2), 0],
          [Math.sin(Math.PI * 1/2 / 2), 0]],
        [ [-Math.sin(Math.PI * 1/2 / 2), 0], 
          [Math.cos(Math.PI * 1/2 / 2), 0] ]
    ], "√Y Gate", Y_COLOR],
    'YF': [[ // Y^(1/4)
        [ [Math.cos(Math.PI * 1/4 / 2), 0],
          [Math.sin(Math.PI * 1/4 / 2), 0]],
        [ [-Math.sin(Math.PI * 1/4 / 2), 0], 
          [Math.cos(Math.PI * 1/4 / 2), 0] ]
    ], "Y^¼ Gate", Y_COLOR],
    'ZH': [[  // √Z (S gate)
        [ [Math.cos(Math.PI * 1/2 / 2), -Math.sin(Math.PI * 1/2 / 2)], [0, 0] ],
        [ [0, 0], [Math.cos(Math.PI * 1/2 / 2), Math.sin(Math.PI * 1/2 / 2)] ]
    ], "√Z Gate", Z_COLOR],
    'ZF': [[  // Z^(1/4) (T gate)
        [ [Math.cos(Math.PI * 1/4 / 2), -Math.sin(Math.PI * 1/4 / 2)], [0, 0] ],
        [ [0, 0], [Math.cos(Math.PI * 1/4 / 2), Math.sin(Math.PI * 1/4 / 2)] ]
    ], "Z^¼ Gate", Z_COLOR],
    'CX': [[  // Controlled X
        [ [1,0], [0, 0], [0, 0], [0, 0] ],
        [ [0,0], [1, 0], [0, 0], [0, 0] ],
        [ [0,0], [0, 0], [0, 0], [1, 0] ],
        [ [0,0], [0, 0], [1, 0], [0, 0] ]
    ], "Controlled X Gate", C_COLOR],
'CY': [[  // Controlled Y
        [ [1,0], [0, 0], [0, 0], [0, 0] ],
        [ [0,0], [1, 0], [0, 0], [0, 0] ],
        [ [0,0], [0, 0], [0, 0], [0,-1] ],
        [ [0,0], [0, 0], [0, 1], [0, 0] ]
    ], "Controlled Y Gate", C_COLOR],
    'CZ': [[  // Controlled Z
        [ [1,0], [0, 0], [0, 0], [0, 0] ],
        [ [0,0], [1, 0], [0, 0], [0, 0] ],
        [ [0,0], [0, 0], [1, 0], [0, 0] ],
        [ [0,0], [0, 0], [0, 0], [-1, 0] ]
    ], "Controlled Z Gate", C_COLOR],
    'SW': [[  // Swap Gate
        [ [1,0], [0, 0], [0, 0], [0, 0] ],
        [ [0,0], [0, 0], [1, 0], [0, 0] ],
        [ [0,0], [1, 0], [0, 0], [0, 0] ],
        [ [0,0], [0, 0], [0, 0], [1, 0] ]
    ], "Swap Gate", C_COLOR]
};

function resetStuff(){
    qubits = 0;
    stateVector = [[1,0]];
    gates = [];
    blochSpheres.forEach(i => {i.removeAll()});
    blochSpheres = [];
    highestCol = -1;
    addQubit();
    renderCircuit();
    updateProbabilityDistribution();
    renderBlochSpheres(); // Ensure Bloch spheres are rendered after qubit addition
}


function addQubit() {
    if (qubits < 8) {
        qubits++;
        blochSpheres[qubits-1] = new BlochSphere(qubits-1);
        gates.push([]);
        renderCircuit();
        updateProbabilityDistribution();
        renderBlochSpheres(); // Ensure Bloch spheres are rendered after qubit addition
    }
}

function removeQubit() {
    if (qubits > 0) {
        blochSpheres[qubits-1].removeAll();
        blochSpheres.pop();
        qubits--;
        gates.pop();
        renderCircuit();
        updateProbabilityDistribution();
        renderBlochSpheres(); // Update Bloch spheres after qubit removal
    }
}

function getVectorForQubit(theQubit){
    let swapRate = Math.pow(2,theQubit);
    let ret0real = 0;
    let ret0imag = 0;
    let ret1real = 0;
    let ret1imag = 0;
    for (let i = 0; i < Math.pow(2,qubits);){
        for (let j = 0; j < swapRate; j++){
            ret0real += stateVector[i+j][0];
            ret0imag += stateVector[i+j][1];
        }
        i += swapRate;
        for (let j = 0; j < swapRate; j++){
            ret1real += stateVector[i+j][0];
            ret1imag += stateVector[i+j][1];
        }
        i += swapRate;
    }
    return [[ret0real, ret0imag], [ret1real, ret1imag]];
}

function renderCircuit() {
    evaluateCircuit();
    const qubitContainer = document.getElementById("qubits");
    qubitContainer.innerHTML = "";

    for (let i = 0; i < qubits; i++) {
        const qubitDiv = document.createElement("div");
        qubitDiv.id = i;
        qubitDiv.classList.add("qubit-line");
        qubitDiv.innerHTML = `<span>Q${i}:</span>`;
        qubitDiv.style.height="75px";
        
        const probQubit = getProbability(i);
        const visualProb = [...probQubit];
        if (probQubit[0] > .95 && probQubit[0] < 0.9999) visualProb[0] = .95;
        if (probQubit[0] < .05 && probQubit[0] > 0.0001) visualProb[0] = .05;
        document.getElementById("blochDivStateZero" + i).style.width = (visualProb[0] * 100) + "%";
        document.getElementById("blochDivStateOne" + i).style.width = ((1-visualProb[0]) * 100) + "%";
        document.getElementById("blochDivStateZero" + i).innerText = `${(probQubit[0] * 100).toFixed(precisionValue)}% |0⟩`;
        document.getElementById("blochDivStateOne" + i).innerText = `${((1-probQubit[0]) * 100).toFixed(precisionValue)}% |1⟩`;
        
        qubitContainer.appendChild(qubitDiv);
    }

    for (let indexOfQubit = 0; indexOfQubit < gates.length; indexOfQubit++){
        let numInRow;
        for (numInRow = 0; numInRow <= ((highestCol > 7) ? highestCol : 7); numInRow++){
            if (gates[indexOfQubit][numInRow] != null && GATE_MATRIX_DICTIONARY[gates[indexOfQubit][numInRow]]){
                const gateDiv = document.createElement('div');
                gateDiv.style.backgroundColor = GATE_MATRIX_DICTIONARY[gates[indexOfQubit][numInRow]][2];
                gateDiv.style.color = "white";
                gateDiv.setAttribute("col", numInRow);
                let tempnumInRow = numInRow;
                gateDiv.onclick = e => e.target === e.currentTarget && removeGate(indexOfQubit, tempnumInRow);
                gateDiv.classList.add('gateplaced');
                gateDiv.innerText = gates[indexOfQubit][numInRow];
                let addToInner = "";
                if (GATE_MATRIX_DICTIONARY[gates[indexOfQubit][numInRow]][0][2]){
                    addToInner += `<select name="selectOptions" qubitIndex="${indexOfQubit}" column="${numInRow}">`;
                    addToInner += `<option value="-">-</option>`;
                    for (let i = 0; i < qubits; i++){
                        if (!GATE_MATRIX_DICTIONARY[gates[i][numInRow]]){
                            addToInner += "<option ";
                            if (gates[i][numInRow] == indexOfQubit) addToInner += "selected ";
                            addToInner += `value="${i}">${i}</option>`;
                        }
                    }
                    addToInner += '</select>';
                }
                gateDiv.innerHTML += addToInner;
                document.getElementById(indexOfQubit).appendChild(gateDiv);

                gateDiv.querySelector('select')?.addEventListener('change', (e) => {
                    const selectedQubit = parseInt(e.target.value);
                    const qubitIndex = parseInt(e.target.getAttribute("qubitIndex"));
                    const column = parseInt(e.target.getAttribute("column"));

                    for (let i = 0; i < qubits; i++){
                        if (gates[i][column] == qubitIndex) gates[i][column] = null;
                    }

                    if (Number.isInteger(selectedQubit)){
                        gates[selectedQubit][column] = qubitIndex;
                    }
                    renderCircuit();
                    updateProbabilityDistribution();
                    renderBlochSpheres();
                });
            }
            else {
                let temp = numInRow;
                const gateDiv = document.createElement('div');
                gateDiv.style.color = "black";
                gateDiv.classList.add('gateempty');
                gateDiv.innerText = "-";
                gateDiv.style.blankIndex = temp;
                gateDiv.ondragover = event => event.preventDefault();
                gateDiv.ondrop = event => drop(event, indexOfQubit, temp);
                document.getElementById(indexOfQubit).appendChild(gateDiv);
            }
        }

        let temp = numInRow;
        const gateDiv = document.createElement('div');
        gateDiv.style.color = "black";
        gateDiv.classList.add('gateempty');
        gateDiv.innerText = "-";
        gateDiv.style.blankIndex = temp;
        gateDiv.ondragover = event => event.preventDefault();
        gateDiv.ondrop = event => drop(event, indexOfQubit, temp);
        document.getElementById(indexOfQubit).appendChild(gateDiv);

    }
}

function removeGate(indexOfQubit, numInRow){
    gates[indexOfQubit][numInRow] = null;
    renderCircuit();
    updateProbabilityDistribution();
    renderBlochSpheres(); // Update Bloch spheres after gate removal
}

function drag(event, gateType) {
    event.dataTransfer?.setData("text", gateType); // Standard drag
    event.target.dataset.gateType = gateType;
}

document.addEventListener("touchstart", function(event) {
    if (event.target.classList.contains("gate")) {
        event.target.classList.add("dragging");
        event.target.dataset.gateType = event.target.innerText; // Ensure gateType is set
        document.body.style.overflow = "hidden"; // Disable scrolling
    }
});

document.addEventListener("touchmove", function(event) {
    let draggingElement = document.querySelector(".dragging");
    if (draggingElement) {
        let touch = event.touches[0];
        draggingElement.style.position = "absolute";
        draggingElement.style.left = touch.pageX - 30 + "px";
        draggingElement.style.top = touch.pageY - 30 + "px";

        event.preventDefault(); // Prevent scrolling while dragging
    }
}, { passive: false });

document.addEventListener("touchend", function(event) {
    let draggingElement = document.querySelector(".dragging");
    if (draggingElement) {
        let touch = event.changedTouches[0];
        let dropTarget = document.elementFromPoint(touch.clientX, touch.clientY);

        if (dropTarget && dropTarget.classList.contains("gateempty")) {
            let gateType = draggingElement.dataset.gateType;
            drop({ preventDefault: () => {}, gateType: gateType }, parseInt(dropTarget.parentElement.id), parseInt(dropTarget.style.blankIndex));
        }

        draggingElement.classList.remove("dragging");
        draggingElement.style.position = "";
        draggingElement.style.left = "";
        draggingElement.style.top = "";
    }

    document.body.style.overflow = ""; // Re-enable scrolling
});

function drop(event, qubitindex, colindex) {
    event.preventDefault();
    
    const gateType = event.gateType ? event.gateType : event.dataTransfer?.getData("text");
    
    if (gateType) {
        let newcolindex = (colindex > highestCol) ? (highestCol + 1) : colindex;
        if (newcolindex > highestCol) highestCol = newcolindex;
        gates[qubitindex][newcolindex] = gateType;
        renderCircuit();
        updateProbabilityDistribution();
        renderBlochSpheres(); // Re-render Bloch spheres after gate application
    }
}

function multiplyComplex(c1, c2) {
    const real = c1[0] * c2[0] - c1[1] * c2[1];
    const imaginary = c1[0] * c2[1] + c1[1] * c2[0];
    return [real, imaginary];
}

function add2Complex(c1, c2) {
    const real = c1[0] + c2[0];
    const imaginary = c1[1] + c2[1];
    return [real, imaginary];
}

function add4Complex(c1, c2, c3, c4) {
    const real = c1[0] + c2[0] + c3[0] + c4[0];
    const imaginary = c1[1] + c2[1] + c3[1] + c4[1];
    return [real, imaginary];
}

function complexMagnitude(c) {
    return Math.sqrt(c[0] * c[0] + c[1] * c[1]);
}

function complexProbability(c) {
    return (c[0] * c[0] + c[1] * c[1]);
}

function evaluateCircuit() {
    stateVector = [[1,0]];
    for (let k = 0; k < (Math.pow(2,qubits) - 1); k++){
        stateVector.push([0,0]);
    }
    for (let i = 0; i <= highestCol; i++){
        for (let j = 0; j < qubits; j++){
            if (gates[j][i] != null && GATE_MATRIX_DICTIONARY[gates[j][i]]) {
                if (GATE_MATRIX_DICTIONARY[gates[j][i]][0][2]){
                    for (let k = 0; k < qubits; k++){
                        if (gates[k][i] == j){
                            applyGate(GATE_MATRIX_DICTIONARY[gates[j][i]][0], j, k);
                        }
                    }
                } else applyGate(GATE_MATRIX_DICTIONARY[gates[j][i]][0], j);
            }
        }
    }
}

function insertBit(num, pos, bit) {
    let left = (num >> pos) << (pos + 1);  // Shift left part and make space
    let right = num & ((1 << pos) - 1);    // Keep lower bits unchanged
    return left | (bit << pos) | right;    // Insert bit and merge
}

function insertBitPair(num, pos1, pos2, bit1, bit2) {
    // Sort positions to simplify logic
    let positions = [pos1, pos2].sort((a, b) => a - b);
    let [p1, p2] = positions;
    let bits = [pos1 === p1 ? bit1 : bit2, pos1 === p1 ? bit2 : bit1];

    let numBits = num.toString(2).length;
    let maxPos = Math.max(p1, p2);
    let totalBits = Math.max(numBits + 2, maxPos + 1);

    let newNum = 0;
    let origBitIdx = 0;

    for (let i = 0; i < totalBits; i++) {
        if (i === p1) {
            newNum |= (bits[0] << i);
        } else if (i === p2) {
            newNum |= (bits[1] << i);
        } else {
            let srcBit = (num >> origBitIdx) & 1;
            newNum |= (srcBit << i);
            origBitIdx++;
        }
    }

    return newNum;
}


function applyGate(gate, qubit, control=qubit-1) {
    if (!gate[2]){
        totalOtherStates = Math.pow(2,qubits-1);
        for (let i = 0; i < totalOtherStates; i++){
            let tempMiniQubit = [stateVector[insertBit(i,qubit,0)], stateVector[insertBit(i,qubit,1)]];
            let result = [
                add2Complex(multiplyComplex(gate[0][0], tempMiniQubit[0]), multiplyComplex(gate[1][0], tempMiniQubit[1])),
                add2Complex(multiplyComplex(gate[0][1], tempMiniQubit[0]), multiplyComplex(gate[1][1], tempMiniQubit[1]))
            ];

            stateVector[insertBit(i,qubit,0)] = result[0];
            stateVector[insertBit(i,qubit,1)] = result[1];

        }
    } else {
        totalOtherStates = Math.pow(2,qubits-2);

        for (let i = 0; i < totalOtherStates; i++){
            let combinedTwoQubits = [stateVector[insertBitPair(i,control, qubit, 0, 0)],
                                     stateVector[insertBitPair(i,control, qubit, 0, 1)],
                                     stateVector[insertBitPair(i,control, qubit, 1, 0)],
                                     stateVector[insertBitPair(i,control, qubit, 1, 1)]];

            result = [add4Complex(multiplyComplex(gate[0][0], combinedTwoQubits[0]),
                                multiplyComplex(gate[1][0], combinedTwoQubits[1]),
                                multiplyComplex(gate[2][0], combinedTwoQubits[2]),
                                multiplyComplex(gate[3][0], combinedTwoQubits[3])),
                      add4Complex(multiplyComplex(gate[0][1], combinedTwoQubits[0]),
                                multiplyComplex(gate[1][1], combinedTwoQubits[1]),
                                multiplyComplex(gate[2][1], combinedTwoQubits[2]),
                                multiplyComplex(gate[3][1], combinedTwoQubits[3])),
                      add4Complex(multiplyComplex(gate[0][2], combinedTwoQubits[0]),
                                multiplyComplex(gate[1][2], combinedTwoQubits[1]),
                                multiplyComplex(gate[2][2], combinedTwoQubits[2]),
                                multiplyComplex(gate[3][2], combinedTwoQubits[3])),
                      add4Complex(multiplyComplex(gate[0][3], combinedTwoQubits[0]),
                                multiplyComplex(gate[1][3], combinedTwoQubits[1]),
                                multiplyComplex(gate[2][3], combinedTwoQubits[2]),
                                multiplyComplex(gate[3][3], combinedTwoQubits[3]))
                     ];

            stateVector[insertBitPair(i,control, qubit, 0, 0)] = result[0];
            stateVector[insertBitPair(i,control, qubit, 0, 1)] = result[1];
            stateVector[insertBitPair(i,control, qubit, 1, 0)] = result[2];
            stateVector[insertBitPair(i,control, qubit, 1, 1)] = result[3];
        }      
    }
}

function getProbability(theQubit) {

    let swapRate = Math.pow(2,theQubit);
    let ret0 = 0;
    let ret1 = 0;
    for (let i = 0; i < Math.pow(2,qubits);){
        for (let j = 0; j < swapRate; j++){
            ret0 += complexProbability(stateVector[i+j]);
        }
        i += swapRate;
        for (let j = 0; j < swapRate; j++){
            ret1 += complexProbability(stateVector[i+j]);
        }
        i += swapRate;
    }
    return [ret0, ret1];
}

let currentType = "doughnut";
let numChartChanges = 0;
let xValues = [];
let yValues = [];
let backgroundColors = [];
let myChart;
let chartConfig;
let maxProbValue = 0;

function generateColors(numColors) {
    let colors = [];
    
    for (let i = 0; i < numColors; i++) {
        let hue = (i * 137.508) % 360; // Use golden angle (approx. 137.508°) for better spread
        let lightness = 50 + (i % 2) * 10 - (numColors > 512 ? 5 : 0); // Adjust lightness to add variation
        let saturation = 80 + (i % 3) * 10; // Slightly tweak saturation for variety
        
        colors.push(`hsl(${hue}, ${saturation}%, ${lightness}%)`);
    }
    
    return colors;
}

function makeNewChart() {
    let numStates = Math.pow(2, qubits);
    backgroundColors = generateColors(numStates); // Generate unique colors

    chartConfig = {
        type: currentType,
        data: {
            labels: xValues,
            datasets: [{
                backgroundColor: backgroundColors,
                data: yValues
            }]
        },
        options: {
            title: {
                display: true,
                text: "Probability Distribution"
            },
            scales: currentType === "bar" ? { y: { beginAtZero: true, max: (maxProbValue ? maxProbValue : 1) } } : {},
            plugins: {
                legend: {
                    display: currentType === "doughnut" // Hide legend for bar, show for doughnut
                }
            }
        }
    };

    if (numChartChanges++ > 0) {
        myChart.destroy();
    }
    myChart = new Chart("myChart", chartConfig);
}

function changeChart() {
    currentType = currentType === "doughnut" ? "bar" : "doughnut";
    myChart.destroy();
    
    chartConfig.type = currentType;
    chartConfig.options.scales = currentType === "bar" ? { y: { beginAtZero: true, max: (maxProbValue ? maxProbValue : 1) } } : {};
    chartConfig.options.plugins.legend.display = currentType === "doughnut"; // Toggle legend visibility

    myChart = new Chart("myChart", chartConfig);
}


function toggleZeroProb() {
    zeroProbToggleValue ^= 1;
    updateProbabilityDistribution();
}


function updateProbabilityDistribution() {
    const probDiv = document.getElementById("probability");
    probDiv.innerHTML = '';

    xValues = [];
    yValues = [];
    let i = 0;
    maxProbValue = 0;

    stateVector.forEach((complexNum, index) => {
        let prob = complexProbability(complexNum);
        if (zeroProbToggleValue && prob == 0) return;
        if (prob > maxProbValue) maxProbValue = prob;

        xValues[i] = index.toString(2).padStart(qubits, '0'); // Convert index to binary
        yValues[i] = prob;
        i++;
        const probElement = document.createElement('div');
        probElement.innerText = `P(|${index.toString(2).padStart(qubits, '0')}⟩) = ${prob.toFixed(precisionValue)}`;
        probDiv.appendChild(probElement);
    });

    makeNewChart();
}

// Draw 3D Bloch sphere visualization based on qubit state
function drawBlochSphere(canvas, qubit) {
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const theta = 2 * Math.PI * Math.random();
    const phi = Math.acos(2 * Math.random() - 1);
    const x = 75 + 30 * Math.sin(phi) * Math.cos(theta);
    const y = 75 + 30 * Math.sin(phi) * Math.sin(theta);
    const z = 75 + 30 * Math.cos(phi);
    ctx.beginPath();
    ctx.arc(x, y, 10, 0, 2 * Math.PI);
    ctx.fillStyle = "#0000ff";
    ctx.fill();
}

function renderBlochSpheres() {
    // Assuming you want to update the position for qubit 0 (first qubit)
    // If you want to update more qubits, you can loop through them here

    for (let i = 0; i < qubits; i++){
        blochSpheres[i].setPosition(getVectorForQubit(i));
        blochSpheres[i].render();
    }
}


// Initial setup
addQubit();
addQubit();
renderCircuit();
updateProbabilityDistribution();
renderBlochSpheres();















// Add the popup box to the body
const popupBox = document.createElement('div');
popupBox.classList.add('popup-box');
document.body.appendChild(popupBox);

// Function to display the popup
function showPopup(event, gateName) {
    const gateDictIndex = GATE_MATRIX_DICTIONARY[gateName];

    // Format the matrix and truncate each value to 3 decimal places, removing trailing zeros
    const matrixString = gateDictIndex[0].map(row => 
        row.map(cell => {
            // Truncate real and imaginary parts to 3 decimals and remove trailing zeros
            const real = parseFloat(cell[0].toFixed(3)); 
            let imag = parseFloat(cell[1].toFixed(3));

            // If the imaginary part is negative, display as positive with a '-' instead of '+'
            if (imag < 0) {
                imag = Math.abs(imag);  // Make it positive
                return `(${real} - ${imag}i)`; // Use '-' sign
            } else {
                return `(${real} + ${imag}i)`; // Use '+' sign
            }
        }).join(' | ') // Space-separated for each row
    ).join('<br>'); // Line break between rows

    // Display the matrix in the popup
    popupBox.innerHTML = `<strong>${gateDictIndex[1]}</strong><br>${matrixString}`;
    popupBox.style.left = `${event.pageX + 10}px`;
    popupBox.style.top = `${event.pageY + 10}px`;
    popupBox.style.display = 'block';
}




// Function to hide the popup
function hidePopup() {
    popupBox.style.display = 'none';
}

// Attach event listeners to the gate elements
document.querySelectorAll('.gate').forEach(gate => {
    const gateName = gate.innerText;
    
    gate.addEventListener('mouseenter', (event) => {
        showPopup(event, gateName);
    });
    
    gate.addEventListener('mouseleave', hidePopup);
    gate.addEventListener('mousedown', hidePopup);
});


document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll(".gate").forEach(element => {
        const gateType = element.innerText.trim();
        if (GATE_MATRIX_DICTIONARY[gateType]) {
            element.style.backgroundColor = GATE_MATRIX_DICTIONARY[gateType][2];
            element.style.color = "white";
        }
    });
});


document.getElementById("precisionRange").addEventListener("input", function() {
    precisionValue = this.value;
    updateProbabilityDistribution();

    for (let i = 0; i < qubits; i++) {
        const probQubit = getProbability(i);
        const visualProb = [...probQubit];
        if (probQubit[0] > .95 && probQubit[0] < 0.9999) visualProb[0] = .95;
        if (probQubit[0] < .05 && probQubit[0] > 0.0001) visualProb[0] = .05;
        document.getElementById("blochDivStateZero" + i).style.width = (visualProb[0] * 100) + "%";
        document.getElementById("blochDivStateOne" + i).style.width = ((1-visualProb[0]) * 100) + "%";
        document.getElementById("blochDivStateZero" + i).innerText = `${(probQubit[0] * 100).toFixed(precisionValue)}% |0⟩`;
        document.getElementById("blochDivStateOne" + i).innerText = `${((1-probQubit[0]) * 100).toFixed(precisionValue)}% |1⟩`;
    }  
});

const EXAMPLE_STATES = {
    "RosenthalState": [["H",0,0],["YF",0,1],["XF",0,2],["H",0,3],["YF",0,4],["H",1,0],["H",2,0],["H",3,0]],
    "BellState": [["H",0,0], [1,0,1], ["CX",1,1]]
};

function setExample(stateRequested){
    resetStuff();
    
    let largestQubitIndex = 0;
    EXAMPLE_STATES[stateRequested].forEach(([gateType, qubitindex, colindex]) => {
        largestQubitIndex = (qubitindex > largestQubitIndex) ? qubitindex : largestQubitIndex;
    });

    for (let i = 0; i < largestQubitIndex; i++) addQubit();

    EXAMPLE_STATES[stateRequested].forEach(([gateType, qubitindex, colindex]) => {
        if (gateType) {
            let newcolindex = (colindex > highestCol) ? (highestCol + 1) : colindex;
            if (newcolindex > highestCol) highestCol = newcolindex;
            gates[qubitindex][newcolindex] = gateType;
        }
    });
    renderCircuit();
    updateProbabilityDistribution();
    renderBlochSpheres(); // Re-render Bloch spheres after gate application
}