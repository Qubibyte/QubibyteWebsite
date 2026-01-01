class BlochSphere {
  constructor() {
    // Create the scene
    this.scene = new THREE.Scene();

    // Create scene elements
    this.radius = 1;
    this.segments = 128;
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

    // Group for all rotating objects
    this.rotationGroup = new THREE.Group();
    this.scene.add(this.rotationGroup);

    // Keep track of all lines/balls
    this.linesAndBalls = [];

    // Set initial scene rotation
    this.scene.rotation.x = Math.PI / 2;

    // Set initial camera position
    this.camera = new THREE.PerspectiveCamera(70, 1, 0.1, 1000);
    this.camera.position.set(1.2, 1.2, -1.2);
    this.camera.lookAt(0, 0, 0);

    const container = document.getElementById("chartgraphic");
    let dimension = (container.clientHeight > container.clientWidth) ? container.clientWidth : container.clientHeight;
    const scaler = 1.1;

    // Create renderer
    this.renderer = new THREE.WebGLRenderer();
    this.renderer.setSize(dimension / scaler, dimension / scaler);
    this.renderer.setClearColor("aliceblue", 1);
    document.getElementById("blochDiv").appendChild(this.renderer.domElement);

    window.addEventListener("resize", () => {
      dimension = (container.clientHeight > container.clientWidth) ? container.clientWidth : container.clientHeight;
      this.renderer.setSize(dimension / scaler, dimension / scaler);
      this.render();
    });

    // Add static parts to the scene
    this.scene.add(this.circleXY);
    this.scene.add(this.circleYZ);
    this.scene.add(this.circleXZ);
    this.scene.add(this.translucentSphere);
    this.scene.add(this.xAxis);
    this.scene.add(this.yAxis);
    this.scene.add(this.zAxis);
    this.scene.add(this.rotationGroup);

    // Store colors for balls (default empty)
    this.qubitColors = [];
  }

  // Call this to generate and store colors based on number of qubits
  setColors(qubits) {
    this.qubitColors = generateColors(qubits);
  }

  // Create circle outlines
  createCircleOutline(radius, segments, rotation) {
    const geometry = new THREE.RingGeometry(radius - 0.05, radius + 0.05, segments);
    const material = new THREE.MeshBasicMaterial({ color: 0x000, wireframe: true });
    const circle = new THREE.Mesh(geometry, material);
    circle.rotation.set(rotation.x, rotation.y, rotation.z);
    return circle;
  }

  // Create translucent sphere
  createTranslucentSphere() {
    const sphereGeometry = new THREE.SphereGeometry(1, 24, 24);
    const sphereMaterial = new THREE.MeshBasicMaterial({
      color: 0x000,
      transparent: true,
      opacity: 0.05
    });
    return new THREE.Mesh(sphereGeometry, sphereMaterial);
  }

  // Create axis
  createAxis(color, points) {
    const axisMaterial = new THREE.LineBasicMaterial({ color });
    const axisGeometry = new THREE.BufferGeometry().setFromPoints(points);
    return new THREE.Line(axisGeometry, axisMaterial);
  }

  // Create a line from center
  createLine() {
    const lineMaterial = new THREE.LineBasicMaterial({ color: 0x000000 });
    const lineGeometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0, 0)
    ]);
    return new THREE.Line(lineGeometry, lineMaterial);
  }

  // Create ball with custom color
  createBall(color = 0xff0000) {
    const ballGeometry = new THREE.SphereGeometry(0.1, 16, 16);
    const ballMaterial = new THREE.MeshBasicMaterial({ color });
    const ball = new THREE.Mesh(ballGeometry, ballMaterial);
    ball.position.set(0, 0, 0);
    return ball;
  }

  // Set position and create new line+ball
  setPosition([pureormixed, qubit], index = 0) {
    let x, y, z;
    if (pureormixed == "mixed") {
      x = 0;
      y = 0;
      z = (2 * qubit) - 1;
    } else if (pureormixed == "pure") {
      const a = qubit[0].re, b = qubit[0].im;
      const c = qubit[1].re, d = qubit[1].im;

      const magnitudeAlpha = Math.sqrt(a * a + b * b);
      const theta = 2 * Math.acos(magnitudeAlpha);
      const phi = Math.atan2(b, a) - Math.atan2(d, c);

      x = Math.sin(theta) * Math.cos(phi);
      y = Math.sin(theta) * Math.sin(phi);
      z = -Math.cos(theta);
    }

    // Create new line
    const line = this.createLine();
    line.geometry.setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(x, y, z)
    ]);
    line.geometry.attributes.position.needsUpdate = true;

    // Pick color from stored colors array, fallback to red if missing
    const colorStr = this.qubitColors[index] || "red";
    // Convert color string to hex
    const colorHex = new THREE.Color(colorStr);

    // Create new ball with that color
    const ball = this.createBall(colorHex);
    ball.position.set(x, y, z);

    // Add to group and track
    this.rotationGroup.add(line);
    this.rotationGroup.add(ball);
    this.linesAndBalls.push({ line, ball });
  }

  // Remove all lines and balls
  clearLinesAndBalls() {
    for (const obj of this.linesAndBalls) {
      this.rotationGroup.remove(obj.line);
      this.rotationGroup.remove(obj.ball);
    }
    this.linesAndBalls = [];
  }

  // Remove entire Bloch sphere
  removeAll() {
    this.clearLinesAndBalls();
    this.scene.remove(this.circleXY);
    this.scene.remove(this.circleYZ);
    this.scene.remove(this.circleXZ);
    this.scene.remove(this.translucentSphere);
    this.scene.remove(this.xAxis);
    this.scene.remove(this.yAxis);
    this.scene.remove(this.zAxis);
    this.scene.remove(this.rotationGroup);
    document.getElementById("blochDiv").innerHTML = "";
  }

  // Render
  render() {
    this.renderer.render(this.scene, this.camera);
  }
}


class Complex {
  constructor(re, im) {
    this.re = re; // real part (number)
    this.im = im; // imaginary part (number)
  }

  // Addition
  add(other) {
    return new Complex(this.re + other.re, this.im + other.im);
  }
  static add(a, b) {
    return new Complex(a.re + b.re, a.im + b.im);
  }

  // Subtraction
  sub(other) {
    return new Complex(this.re - other.re, this.im - other.im);
  }
  static sub(a, b) {
    return new Complex(a.re - b.re, a.im - b.im);
  }

  // Multiplication
  mul(other) {
    return new Complex(
      this.re * other.re - this.im * other.im,
      this.re * other.im + this.im * other.re
    );
  }
  static mul(a, b) {
    return new Complex(
      a.re * b.re - a.im * b.im,
      a.re * b.im + a.im * b.re
    );
  }

  // Conjugate
  conj() {
    return new Complex(this.re, -this.im);
  }
  static conj(a) {
    return new Complex(a.re, -a.im);
  }

  // Magnitude (absolute value)
  magnitude() {
    return Math.sqrt(this.re ** 2 + this.im ** 2);
  }
  static magnitude(a) {
    return Math.sqrt(a.re ** 2 + a.im ** 2);
  }

  // Probability (magnitude squared)
  probability() {
    return this.re ** 2 + this.im ** 2;
  }
  static probability(a) {
    return a.re ** 2 + a.im ** 2;
  }

  // Equality check (complex number components)
  equals(other, epsilon = 1e-10) {
    return (
      Math.abs(this.re - other.re) < epsilon &&
      Math.abs(this.im - other.im) < epsilon
    );
  }
  static equals(a, b, epsilon = 1e-10) {
    return (
      Math.abs(a.re - b.re) < epsilon &&
      Math.abs(a.im - b.im) < epsilon
    );
  }

  // Equality check for magnitude
  equalsMagnitude(other, epsilon = 1e-10) {
    return Math.abs(this.magnitude() - other.magnitude()) < epsilon;
  }
  static equalsMagnitude(a, b, epsilon = 1e-10) {
    return Math.abs(Complex.magnitude(a) - Complex.magnitude(b)) < epsilon;
  }

  // Equality check for probability
  equalsProbability(other, epsilon = 1e-10) {
    return Math.abs(this.probability() - other.probability()) < epsilon;
  }
  static equalsProbability(a, b, epsilon = 1e-10) {
    return Math.abs(Complex.probability(a) - Complex.probability(b)) < epsilon;
  }

  // String representation
  static _formatNumber(num) {
    // Convert to string with up to 12 decimals, then trim trailing zeros and dot if needed
    return parseFloat(num.toFixed(precisionValue)).toString();
  }

  toString() {
    const reStr = Complex._formatNumber(this.re);
    const imStr = Complex._formatNumber(Math.abs(this.im));
    const sign = this.im >= 0 ? '+' : '-';
    return `${reStr} ${sign} ${imStr}i`;
  }

  static toString(c) {
    const reStr = Complex._formatNumber(c.re);
    const imStr = Complex._formatNumber(Math.abs(c.im));
    const sign = c.im >= 0 ? '+' : '-';
    return `${reStr} ${sign} ${imStr}i`;
  }

  static formatApproxSqrt(x, epsilon = 1e-10) {
      if (Math.abs(x) < epsilon) return "0";

      const sign = x < 0 ? "-" : "";
      const abs = Math.abs(x);

      const squared = abs * abs;
      const inverseSquared = 1 / squared;

      const nearestSq = Math.round(squared);
      if (Math.abs(squared - nearestSq) < epsilon) {
        if (nearestSq === 1) return sign + "1";
        if (nearestSq === 0) return "0"; // extra safe
        return `${sign}√${nearestSq}`;
      }

      const nearestInvSq = Math.round(inverseSquared);
      if (Math.abs(inverseSquared - nearestInvSq) < epsilon) {
        if (nearestInvSq === 1) return sign + "1";
        return `${sign}1/√${nearestInvSq}`;
      }

      return (sign + abs.toFixed(precisionValue));
    }

  static ZERO = new Complex(0, 0);
  static ONE = new Complex(1, 0);
  static NEG_ONE = new Complex(-1, 0);
  static I = new Complex(0, 1);
  static NEG_I = new Complex(0, -1);

}



// Matrix class for 2D array of Complex numbers
class Matrix {
  constructor(rows) {
    this.rows = rows; // array of arrays of Complex
    this.nRows = rows.length;
    this.nCols = rows[0].length;
  }

  static kronecker = function (a, b) {
    const result = [];

    for (let i = 0; i < a.nRows; i++) {
      for (let bi = 0; bi < b.nRows; bi++) {
        const row = [];
        for (let j = 0; j < a.nCols; j++) {
          for (let bj = 0; bj < b.nCols; bj++) {
            row.push(a.rows[i][j].mul(b.rows[bi][bj]));
          }
        }
        result.push(row);
      }
    }

    return new Matrix(result);
  };


  // Multiply this matrix * other (this on the left)
  leftMultiply(other) {
    return Matrix.multiply(this, other);
  }

  // Multiply other * this (this on the right)
  rightMultiply(other) {
    return Matrix.multiply(other, this);
  }

  // Static method to multiply two matrices (left * right)
  static multiply(left, right) {
    if (left.nCols !== right.nRows)
      throw new Error('Matrix dimension mismatch');

    const result = [];
    for (let i = 0; i < left.nRows; i++) {
      const row = [];
      for (let j = 0; j < right.nCols; j++) {
        let sum = new Complex(0, 0);
        for (let k = 0; k < left.nCols; k++) {
          sum = sum.add(left.rows[i][k].mul(right.rows[k][j]));
        }
        row.push(sum);
      }
      result.push(row);
    }
    return new Matrix(result);
  }

  // Instance method
  equals(other, epsilon = 1e-10) {
    if (!(other instanceof Matrix)) return false;
    if (this.nRows !== other.nRows || this.nCols !== other.nCols) return false;

    for (let i = 0; i < this.nRows; i++) {
      for (let j = 0; j < this.nCols; j++) {
        if (!this.rows[i][j].equals(other.rows[i][j], epsilon)) {
          return false;
        }
      }
    }
    return true;
  }

  // Static method
  static equals(m1, m2, epsilon = 1e-10) {
    if (!(m1 instanceof Matrix) || !(m2 instanceof Matrix)) return false;
    if (m1.nRows !== m2.nRows || m1.nCols !== m2.nCols) return false;

    for (let i = 0; i < m1.nRows; i++) {
      for (let j = 0; j < m1.nCols; j++) {
        if (!m1.rows[i][j].equals(m2.rows[i][j], epsilon)) {
          return false;
        }
      }
    }
    return true;
  }


  toString() {
    const stringRows = this.rows.map(row => row.map(c => c.toString()));

    const colWidths = [];
    for (let col = 0; col < this.nCols; col++) {
      let maxLen = 0;
      for (let row = 0; row < this.nRows; row++) {
        maxLen = Math.max(maxLen, stringRows[row][col].length);
      }
      colWidths[col] = maxLen;
    }

    const lines = stringRows.map(row => {
      const paddedCells = row.map((cell, i) => cell.padStart(colWidths[i], ' '));
      return `[ ${paddedCells.join('  ')} ]`;
    });

    return lines.join('\n');
  }

  // Print combined full state vector as before
  static formatRows(matrix, nQubits, hideIf, estimateSqrts) {
    let rows = matrix.rows.map((row, i) => {
      const amplitude = row[0];
      const prob = amplitude.probability();
      const binIndex = i.toString(2).padStart(nQubits, '0');

      let ampStr;
      if (estimateSqrts) {
        const reStr = Complex.formatApproxSqrt(amplitude.re);
        const imStr = Complex.formatApproxSqrt(amplitude.im);

        if (reStr !== "0" && imStr !== "0") {
          ampStr = `${reStr} + ${imStr}i`;
        } else if (reStr !== "0") {
          ampStr = reStr;
        } else if (imStr !== "0") {
          ampStr = `${imStr}i`;
        } else {
          ampStr = "0";
        }
      } else {
        ampStr = amplitude.toString();
      }

      return {
        binIndex: `|${binIndex}⟩`,
        amplitude: ampStr,
        probability: (prob*100).toFixed(precisionValue) + '%<br>',
        probValue: prob
      };
    });

    if (hideIf >= 0) {
      rows = rows.filter(r => r.probValue > hideIf);
    }

    if (rows.length === 0) {
      return "(no states with probability above threshold)";
    }

    const maxBinIndexLen = Math.max(...rows.map(r => r.binIndex.length));
    const maxAmpLen = Math.max(...rows.map(r => r.amplitude.length));
    const maxProbLen = Math.max(...rows.map(r => r.probability.length));

    const lines = rows.map(r => {
      const binPadded = r.binIndex.padEnd(maxBinIndexLen, ' ');
      const ampPadded = r.amplitude.padStart(maxAmpLen, ' ');
      const probPadded = r.probability.padStart(maxProbLen, ' ');
      return `${binPadded}   ${ampPadded}   ${probPadded}`;
    });

    return lines.join('\n');
  }

  // Partial trace helper: Extract single-qubit reduced density matrix by tracing out other qubits
  static partialTraceSingleQubit(fullDensityMatrix, qubitIndex) {
    const totalQubits = Math.log2(fullDensityMatrix.nRows);
    const dim = 1 << totalQubits; // 2^n
    const reducedDim = 2; // single qubit

    const reducedDensityRows = [
      [Complex.ZERO, Complex.ZERO],
      [Complex.ZERO, Complex.ZERO]
    ];

    // row and col of full matrix run from 0..2^n -1
    // Each index interpreted as bitstring
    // We sum over all other qubits except the one at qubitIndex
    // Reduced element (a,b) = sum over other qubits of fullDensityMatrix with qubitIndex bit = a (row) and b (col)

    for (let rowFull = 0; rowFull < dim; rowFull++) {
      for (let colFull = 0; colFull < dim; colFull++) {
        // Get bit at qubitIndex for row and col
        const rowBit = (rowFull >> qubitIndex) & 1;
        const colBit = (colFull >> qubitIndex) & 1;

        if (rowBit >= 0 && colBit >= 0) {
          // Other qubits must match
          let matchOtherQubits = true;
          for (let q = 0; q < totalQubits; q++) {
            if (q === qubitIndex) continue;
            const rowQBit = (rowFull >> q) & 1;
            const colQBit = (colFull >> q) & 1;
            // For partial trace, we sum over terms where these bits are equal:
            // Actually, for partial trace we sum over all other indices when rowQBit == colQBit
            if (rowQBit !== colQBit) {
              matchOtherQubits = false;
              break;
            }
          }
          if (matchOtherQubits) {
            // add element to reduced matrix
            reducedDensityRows[rowBit][colBit] = reducedDensityRows[rowBit][colBit].add(
              fullDensityMatrix.rows[rowFull][colFull]
            );
          }
        }
      }
    }

    // Build and return Matrix 2x2
    return new Matrix(reducedDensityRows);
  }

  printStateVector(hideIf = hideIfCheck, estimateSqrts = estimateSqrtsCheck, showIndividual = showIndividualCheck) {
    if (this.nCols !== 1) {
      throw new Error("printStateVector works only on column vectors (n×1 matrices).");
    }

    const nQubits = Math.log2(this.nRows);
    if (!Number.isInteger(nQubits)) {
      throw new Error("Number of rows must be a power of 2 for qubit states.");
    }

    // Check if pure state: density matrix squared equals density matrix (within epsilon)
    const density = this.densityMatrix();
    const densitySquared = Matrix.multiply(density, density);
    const isPure = density.equals(densitySquared, 1e-8);

    let output = '';

    if (showIndividual) {
      if (!isPure) {
        for (let q = 0; q < nQubits; q++) {
          output += `Q${q} is in a mixed state\n<br>`;
        }
      } else {
        // Print individual qubits states from reduced density matrices
        for (let q = 0; q < nQubits; q++) {
          output += `Q${q}:\n`;

          const reducedDensity = Matrix.partialTraceSingleQubit(density, q);

          // reduced density is 2x2, representing single qubit mixed or pure state
          // For pure state, reduced density is rank 1, so we can get a state vector by
          // eigen decomposition. But let's do a simpler method: find eigenvector with eigenvalue ~1

          // Here, just extract amplitudes if pure single-qubit:
          // Check if reducedDensity is pure (reducedDensity^2 == reducedDensity)
          const reducedSquared = Matrix.multiply(reducedDensity, reducedDensity);
          const reducedIsPure = reducedDensity.equals(reducedSquared, 1e-8);

          if (!reducedIsPure) {
            output += "  (mixed state)\n<br>";
            continue;
          }

          // Reduced pure state vector extraction:
          // The density matrix for pure |ψ⟩ = [a b; b* c], where |a|^2 + |c|^2=1
          // The state vector |ψ⟩ is eigenvector with eigenvalue 1.
          // For single qubit, the density matrix = |ψ⟩⟨ψ|
          // So we can take the first column and compute the amplitude as vector:
          // |ψ⟩ = [sqrt(a), b/sqrt(a)] or similar. Actually:
          // We take eigenvector for eigenvalue 1; easier approach is:
          // since it’s rank 1, the first column is proportional to the vector

          // We'll take first column of reducedDensity
          const a = reducedDensity.rows[0][0];
          const b = reducedDensity.rows[1][0];

          // Normalize vector
          const norm = Math.sqrt(a.probability() + b.probability());
          if (norm < 1e-10) {
            output += "  (zero vector)\n<br>";
            continue;
          }
          const amp0 = new Complex(a.re / norm, a.im / norm);
          const amp1 = new Complex(b.re / norm, b.im / norm);

          // Format as state vector string (same style as combined)
          const prob0 = amp0.probability() * 100;
          const prob1 = amp1.probability() * 100;

          function fmtAmp(c) {
            if (estimateSqrts) {
              const reStr = Complex.formatApproxSqrt(c.re);
              const imStr = Complex.formatApproxSqrt(c.im);
              if (reStr !== "0" && imStr !== "0") return `${reStr} + ${imStr}i`;
              if (reStr !== "0") return reStr;
              if (imStr !== "0") return `${imStr}i`;
              return "0";
            }
            return c.toString();
          }

          output += `  |0⟩: ${fmtAmp(amp0)}   ${prob0.toFixed(precisionValue)}%\n`;
          output += `  |1⟩: ${fmtAmp(amp1)}   ${prob1.toFixed(precisionValue)}%\n<br>`;
        }
      }
      output += '\nCombined state:\n<br>';
    }

    output += Matrix.formatRows(this, nQubits, hideIf, estimateSqrts);

    return output;
  }

  getPureOrMixedAndQubitOrProbability(){
    let output = [];
    if (this.nCols !== 1) {
      throw new Error("findPureOrMixedAndQubitOrProbability works only on column vectors (n×1 matrices).");
    }

    const nQubits = Math.log2(this.nRows);
    if (!Number.isInteger(nQubits)) {
      throw new Error("Number of rows must be a power of 2 for qubit states.");
    }

    // Check if pure state: density matrix squared equals density matrix (within epsilon)
    const density = this.densityMatrix();
    const densitySquared = Matrix.multiply(density, density);
    const isPure = density.equals(densitySquared, 1e-8);

    if (!isPure) {
      for (let q = 0; q < nQubits; q++) {
        output[q] = ["mixed", qubitProbability(q)];
      }
    } else {
      // Print individual qubits states from reduced density matrices
      for (let q = 0; q < nQubits; q++) {
        const reducedDensity = Matrix.partialTraceSingleQubit(density, q);

        // reduced density is 2x2, representing single qubit mixed or pure state
        // For pure state, reduced density is rank 1, so we can get a state vector by
        // eigen decomposition. But let's do a simpler method: find eigenvector with eigenvalue ~1

        // Here, just extract amplitudes if pure single-qubit:
        // Check if reducedDensity is pure (reducedDensity^2 == reducedDensity)
        const reducedSquared = Matrix.multiply(reducedDensity, reducedDensity);
        const reducedIsPure = reducedDensity.equals(reducedSquared, 1e-8);

        if (!reducedIsPure) {
          output[q] = ["mixed", qubitProbability(q)];
          continue;
        }

        // Reduced pure state vector extraction:
        // The density matrix for pure |ψ⟩ = [a b; b* c], where |a|^2 + |c|^2=1
        // The state vector |ψ⟩ is eigenvector with eigenvalue 1.
        // For single qubit, the density matrix = |ψ⟩⟨ψ|
        // So we can take the first column and compute the amplitude as vector:
        // |ψ⟩ = [sqrt(a), b/sqrt(a)] or similar. Actually:
        // We take eigenvector for eigenvalue 1; easier approach is:
        // since it’s rank 1, the first column is proportional to the vector

        // We'll take first column of reducedDensity
        const a = reducedDensity.rows[0][0];
        const b = reducedDensity.rows[1][0];

        // Normalize vector
        const norm = Math.sqrt(a.probability() + b.probability());
        if (norm < 1e-10) {
          output[q] = ["pure", [Complex.ZERO, Complex.ONE]];
          continue;
        }
        const amp0 = new Complex(a.re / norm, a.im / norm);
        const amp1 = new Complex(b.re / norm, b.im / norm);

        // Format as state vector string (same style as combined)
        const prob0 = amp0.probability() * 100;
        const prob1 = amp1.probability() * 100;

        function fmtAmp(c) {
          if (estimateSqrts) {
            const reStr = Complex.formatApproxSqrt(c.re);
            const imStr = Complex.formatApproxSqrt(c.im);
            if (reStr !== "0" && imStr !== "0") return `${reStr} + ${imStr}i`;
            if (reStr !== "0") return reStr;
            if (imStr !== "0") return `${imStr}i`;
            return "0";
          }
          return c.toString();
        }

        output[q] = ["pure", [amp0, amp1]];
      }
    }

    return output;
  }



  // Compute the outer product of a column vector with its conjugate transpose
  densityMatrix() {
    if (this.nCols !== 1)
      throw new Error("Matrix must be a column vector (n×1 Matrix) to compute density matrix");

    const n = this.nRows;
    const result = [];

    for (let i = 0; i < n; i++) {
      const row = [];
      for (let j = 0; j < n; j++) {
        const a = this.rows[i][0];
        const b = this.rows[j][0].conj();
        row.push(a.mul(b));
      }
      result.push(row);
    }

    return new Matrix(result);
  }
  
  static densityMatrix(stateVec) {
    if (stateVec.nCols !== 1)
      throw new Error("Input must be a column vector (n×1 Matrix)");

    const n = stateVec.nRows;
    const result = [];

    for (let i = 0; i < n; i++) {
      const row = [];
      for (let j = 0; j < n; j++) {
        const a = stateVec.rows[i][0];
        const b = stateVec.rows[j][0].conj(); // conjugate for ⟨ψ|
        row.push(a.mul(b)); // a_i * conj(b_j)
      }
      result.push(row);
    }

    return new Matrix(result);
  }

}

class QuantumGate {
  constructor(matrix) {
    if (!(matrix instanceof Matrix)) throw new Error('QuantumGate requires a Matrix');

    const size = matrix.nRows;
    if (size !== matrix.nCols) throw new Error('Gate matrix must be square');
    const logSize = Math.log2(size);
    if (!Number.isInteger(logSize)) throw new Error('Gate matrix must be 2^n × 2^n');

    this.matrix = matrix;
    this.numQubits = logSize;
  }

  // Apply gate to given target qubit(s) within a larger quantum state
  applyTo(stateVec, targetIndices) {
    const nQubits = Math.log2(stateVec.nRows);
    if (!Number.isInteger(nQubits)) throw new Error('State vector must be size 2^n');

    if (!Array.isArray(targetIndices)) targetIndices = [targetIndices];
    if (targetIndices.length !== this.numQubits)
      throw new Error(`Gate size expects ${this.numQubits} targets`);

    const sortedTargets = [...targetIndices].sort((a, b) => a - b);
    const nTargets = sortedTargets.length;

    const totalDim = 1 << nQubits;
    const newState = Array(totalDim).fill(Complex.ZERO);

    for (let i = 0; i < totalDim; i++) {
      const bits = i.toString(2).padStart(nQubits, '0').split('').map(Number);
      const targetBits = sortedTargets.map(idx => bits[nQubits - 1 - idx]);
      const targetIndex = parseInt(targetBits.join(''), 2);

      for (let j = 0; j < (1 << nTargets); j++) {
        const newBits = [...bits];
        const jBits = j.toString(2).padStart(nTargets, '0').split('').map(Number);
        sortedTargets.forEach((q, k) => {
          newBits[nQubits - 1 - q] = jBits[k];
        });
        const newIndex = parseInt(newBits.join(''), 2);
        newState[newIndex] = newState[newIndex].add(
          this.matrix.rows[j][targetIndex].mul(stateVec.rows[i][0])
        );
      }
    }

    return new Matrix(newState.map(c => [c]));
  }

  // Controlled gate: apply to target if all controls = 1
  applyControlledTo(stateVec, controlIndices, targetIndices) {
    const nQubits = Math.log2(stateVec.nRows);
    if (!Number.isInteger(nQubits)) throw new Error('State vector must be size 2^n');

    if (!Array.isArray(controlIndices)) controlIndices = [controlIndices];
    if (!Array.isArray(targetIndices)) targetIndices = [targetIndices];

    const sortedTargets = [...targetIndices].sort((a, b) => a - b);
    const nTargets = sortedTargets.length;
    if (nTargets !== this.numQubits)
      throw new Error(`Gate size expects ${this.numQubits} target qubits`);

    const totalDim = 1 << nQubits;
    const newState = Array(totalDim).fill(Complex.ZERO);

    for (let i = 0; i < totalDim; i++) {
      const bits = i.toString(2).padStart(nQubits, '0').split('').map(Number);

      const controlsActive = controlIndices.every(idx => bits[nQubits - 1 - idx] === 1);

      if (controlsActive) {
        const targetBits = sortedTargets.map(idx => bits[nQubits - 1 - idx]);
        const targetIndex = parseInt(targetBits.join(''), 2);

        for (let j = 0; j < (1 << nTargets); j++) {
          const newBits = [...bits];
          const jBits = j.toString(2).padStart(nTargets, '0').split('').map(Number);
          sortedTargets.forEach((q, k) => {
            newBits[nQubits - 1 - q] = jBits[k];
          });
          const newIndex = parseInt(newBits.join(''), 2);
          newState[newIndex] = newState[newIndex].add(
            this.matrix.rows[j][targetIndex].mul(stateVec.rows[i][0])
          );
        }
      } else {
        // Keep unaffected
        newState[i] = stateVec.rows[i][0];
      }
    }

    return new Matrix(newState.map(c => [c]));
  }

  dagger() {
    const rows = this.matrix.rows;
    const nRows = rows.length;
    const nCols = rows[0].length;

    const result = [];

    for (let j = 0; j < nCols; j++) {
      const newRow = [];
      for (let i = 0; i < nRows; i++) {
        newRow.push(rows[i][j].conj());
      }
      result.push(newRow);
    }

    return new QuantumGate(new Matrix(result));
  }

  isUnitary(epsilon = 1e-10) {
    const product = Matrix.multiply(this.dagger().matrix, this.matrix);
    const identity = Matrix.identity(this.matrix.nRows);
    return Matrix.equals(product, identity, epsilon);
  }

  isHermitian(epsilon = 1e-10) {
    const dagger = this.dagger().matrix;
    return Matrix.equals(this.matrix, dagger, epsilon);
  }

  toString() {
    return this.matrix.toString();
  }
}

// State vector of size 2^n (n = number of qubits), with all states = 0, except state 00...0 = 1
function createStateVector(n) {
  const size = 2 ** n;
  const rows = [];

  rows.push([new Complex(1, 0)]);

  for (let i = 1; i < size; i++) {
    rows.push([new Complex(0, 0)]);
  }
  return new Matrix(rows);
}

// --- Define Gates ---

const isq = x => 1 / Math.sqrt(x);

// Identity gate
const Identity_Matrix = new Matrix([
  [Complex.ONE, Complex.ZERO],
  [Complex.ZERO, Complex.ONE],
]);

const Hadamard_Matrix = new Matrix([
  [new Complex(isq(2), 0), new Complex(isq(2), 0)],
  [new Complex(isq(2), 0), new Complex(-isq(2), 0)],
]);

const X_Matrix = new Matrix([
  [Complex.ZERO, Complex.ONE],
  [Complex.ONE, Complex.ZERO],
]);

const Y_Matrix = new Matrix([
  [Complex.ZERO, Complex.NEG_I],
  [Complex.I, Complex.ZERO],
]);

const Z_Matrix = new Matrix([
  [Complex.ONE, Complex.ZERO],
  [Complex.ZERO, Complex.NEG_ONE],
]);

const sqrtX_Matrix = new Matrix([
  [new Complex(0.5, 0.5), new Complex(0.5, -0.5)],
  [new Complex(0.5, -0.5), new Complex(0.5, 0.5)],
]);

const sqrtY_Matrix = new Matrix([
  [new Complex(isq(2), 0), new Complex(-isq(2), 0)],
  [new Complex(isq(2), 0), new Complex(isq(2), 0)],
]);

const sqrtZ_Matrix = new Matrix([
  [Complex.ONE, Complex.ZERO],
  [Complex.ZERO, Complex.I],
]);

const ControlledX_Matrix = new Matrix([
  [Complex.ONE, Complex.ZERO, Complex.ZERO, Complex.ZERO],
  [Complex.ZERO, Complex.ONE, Complex.ZERO, Complex.ZERO],
  [Complex.ZERO, Complex.ZERO, Complex.ZERO, Complex.ONE],
  [Complex.ZERO, Complex.ZERO, Complex.ONE, Complex.ZERO],
]);

const ControlledY_Matrix = new Matrix([
  [Complex.ONE, Complex.ZERO, Complex.ZERO, Complex.ZERO],
  [Complex.ZERO, Complex.ONE, Complex.ZERO, Complex.ZERO],
  [Complex.ZERO, Complex.ZERO, Complex.ZERO, Complex.NEG_I],
  [Complex.ZERO, Complex.ZERO, Complex.I, Complex.ZERO],
]);

const ControlledZ_Matrix = new Matrix([
  [Complex.ONE, Complex.ZERO, Complex.ZERO, Complex.ZERO],
  [Complex.ZERO, Complex.ONE, Complex.ZERO, Complex.ZERO],
  [Complex.ZERO, Complex.ZERO, Complex.ONE, Complex.ZERO],
  [Complex.ZERO, Complex.ZERO, Complex.ZERO, Complex.NEG_ONE],
]);

const Swap_Matrix = new Matrix([
  [Complex.ONE, Complex.ZERO, Complex.ZERO, Complex.ZERO],
  [Complex.ZERO, Complex.ZERO, Complex.ONE, Complex.ZERO],
  [Complex.ZERO, Complex.ONE, Complex.ZERO, Complex.ZERO],
  [Complex.ZERO, Complex.ZERO, Complex.ZERO, Complex.ONE],
]);

const ControlledHadamard_Matrix = new Matrix([
  [Complex.ONE, Complex.ZERO, Complex.ZERO, Complex.ZERO],
  [Complex.ZERO, Complex.ONE, Complex.ZERO, Complex.ZERO],
  [Complex.ZERO, Complex.ZERO, new Complex(isq(2), 0), new Complex(isq(2), 0)],
  [Complex.ZERO, Complex.ZERO, new Complex(isq(2), 0), new Complex(-isq(2), 0)],
]);

const Toffoli_Matrix = new Matrix([
  [Complex.ONE, Complex.ZERO, Complex.ZERO, Complex.ZERO, Complex.ZERO, Complex.ZERO, Complex.ZERO, Complex.ZERO],
  [Complex.ZERO, Complex.ONE, Complex.ZERO, Complex.ZERO, Complex.ZERO, Complex.ZERO, Complex.ZERO, Complex.ZERO],
  [Complex.ZERO, Complex.ZERO, Complex.ONE, Complex.ZERO, Complex.ZERO, Complex.ZERO, Complex.ZERO, Complex.ZERO],
  [Complex.ZERO, Complex.ZERO, Complex.ZERO, Complex.ONE, Complex.ZERO, Complex.ZERO, Complex.ZERO, Complex.ZERO],
  [Complex.ZERO, Complex.ZERO, Complex.ZERO, Complex.ZERO, Complex.ONE, Complex.ZERO, Complex.ZERO, Complex.ZERO],
  [Complex.ZERO, Complex.ZERO, Complex.ZERO, Complex.ZERO, Complex.ZERO, Complex.ONE, Complex.ZERO, Complex.ZERO],
  [Complex.ZERO, Complex.ZERO, Complex.ZERO, Complex.ZERO, Complex.ZERO, Complex.ZERO, Complex.ZERO, Complex.ONE],
  [Complex.ZERO, Complex.ZERO, Complex.ZERO, Complex.ZERO, Complex.ZERO, Complex.ZERO, Complex.ONE, Complex.ZERO],
]);

const Fredkin_Matrix = new Matrix([
  [Complex.ONE, Complex.ZERO, Complex.ZERO, Complex.ZERO, Complex.ZERO, Complex.ZERO, Complex.ZERO, Complex.ZERO],
  [Complex.ZERO, Complex.ONE, Complex.ZERO, Complex.ZERO, Complex.ZERO, Complex.ZERO, Complex.ZERO, Complex.ZERO],
  [Complex.ZERO, Complex.ZERO, Complex.ONE, Complex.ZERO, Complex.ZERO, Complex.ZERO, Complex.ZERO, Complex.ZERO],
  [Complex.ZERO, Complex.ZERO, Complex.ZERO, Complex.ONE, Complex.ZERO, Complex.ZERO, Complex.ZERO, Complex.ZERO],
  [Complex.ZERO, Complex.ZERO, Complex.ZERO, Complex.ZERO, Complex.ONE, Complex.ZERO, Complex.ZERO, Complex.ZERO],
  [Complex.ZERO, Complex.ZERO, Complex.ZERO, Complex.ZERO, Complex.ZERO, Complex.ZERO, Complex.ONE, Complex.ZERO],
  [Complex.ZERO, Complex.ZERO, Complex.ZERO, Complex.ZERO, Complex.ZERO, Complex.ONE, Complex.ZERO, Complex.ZERO],
  [Complex.ZERO, Complex.ZERO, Complex.ZERO, Complex.ZERO, Complex.ZERO, Complex.ZERO, Complex.ZERO, Complex.ONE],
]);

const S_Matrix = new Matrix([
  [Complex.ONE, Complex.ZERO],
  [Complex.ZERO, Complex.I],
]);

const T_Matrix = new Matrix([
  [Complex.ONE, Complex.ZERO],
  [Complex.ZERO, new Complex(Math.cos(Math.PI / 4), Math.sin(Math.PI / 4))],
]);

const RX_PlaceholderMatrix = new Matrix(
  [[new Complex("cos(Θ/2)", 0), new Complex(0, "-sin(Θ/2)")],
  [new Complex(0, "-sin(Θ/2)"), new Complex("cos(Θ/2)", 0)]
]);

const RY_PlaceholderMatrix = new Matrix(
  [[new Complex("cos(Θ/2)", 0), new Complex("-sin(Θ/2)", 0)],
  [new Complex("sin(Θ/2)", 0), new Complex("cos(Θ/2)", 0)]
]);

const RZ_PlaceholderMatrix = new Matrix(
  [[new Complex("cos(Θ/2)", "- sin(Θ/2)"), new Complex(0, 0)],
  [new Complex(0, 0), new Complex("cos(Θ/2)", "+ sin(Θ/2)")]
]);

const ControlledNX_Matrix = new Matrix([
  [Complex.ONE, Complex.ZERO, new Complex("0…", 0), Complex.ZERO],
  [Complex.ZERO, new Complex("1…", 0), new Complex("0…", 0),  Complex.ZERO],
  [new Complex("0…", 0), new Complex("0…", 0), Complex.ZERO,  Complex.ONE],
  [Complex.ZERO, Complex.ZERO, Complex.ONE, Complex.ZERO],
]);

let gateColors = {
  "XAxis": "#bd2f2f",
  "YAxis": "#3bbd2f",
  "ZAxis": "#2f44bd",
  "Miscellaneous": "#61288a",
}

let gates = {
  //gatename: [matrix, acronym, category, parametricism, description, controls, targets, full name]
  "I": [new QuantumGate(Identity_Matrix), "I", "Miscellaneous", "Nonparametric", "Leaves a qubit unchanged", 0, 1, "Identity"],
  "H": [new QuantumGate(Hadamard_Matrix), "H", "Miscellaneous", "Nonparametric", "Rotates a qubit from 0 ↔ +, 1 ↔ -, …", 0, 1, "Hadamard"],
  "X": [new QuantumGate(X_Matrix), "X", "XAxis", "Nonparametric", "Rotates a qubit 180° along the X-Plane", 0, 1, "Pauli-X"],
  "Y": [new QuantumGate(Y_Matrix), "Y", "YAxis", "Nonparametric", "Rotates a qubit 180° along the Y-Plane", 0, 1, "Pauli-Y"],
  "Z": [new QuantumGate(Z_Matrix), "Z", "ZAxis", "Nonparametric", "Rotates a qubit 180° along the Z-Plane", 0, 1, "Pauli-Z"],
  "SQRTX": [new QuantumGate(sqrtX_Matrix), "√X", "XAxis", "Nonparametric", "Rotates a qubit 90° along the X-Plane", 0, 1, "X^1/2"],
  "SQRTY": [new QuantumGate(sqrtY_Matrix), "√Y", "YAxis", "Nonparametric", "Rotates a qubit 90° along the Y-Plane", 0, 1, "Y^1/2"],
  "SQRTZ": [new QuantumGate(sqrtZ_Matrix), "√Z", "ZAxis", "Nonparametric", "Rotates a qubit 90° along the Z-Plane", 0, 1, "Z^1/2"],
  "RX": [new QuantumGate(RX_PlaceholderMatrix), "RX", "XAxis", "Parametric", "Rotates a qubit Θ° along the X-Plane", 0, 1, "RX"],
  "RY": [new QuantumGate(RY_PlaceholderMatrix), "RY", "YAxis", "Parametric", "Rotates a qubit Θ° along the Y-Plane", 0, 1, "RY"],
  "RZ": [new QuantumGate(RZ_PlaceholderMatrix), "RZ", "ZAxis", "Parametric", "Rotates a qubit Θ° along the Z-Plane", 0, 1, "RZ"],
  "CX": [new QuantumGate(ControlledX_Matrix), "CX", "XAxis", "Nonparametric", "If a control qubit is 1, rotates a target qubit 180° along the X-Plane", 1, 1, "Controlled X"],
  "CY": [new QuantumGate(ControlledY_Matrix), "CY", "YAxis", "Nonparametric", "If a control qubit is 1, rotates a target qubit 180° along the Y-Plane", 1, 1, "Controlled Y"],
  "CZ": [new QuantumGate(ControlledZ_Matrix), "CZ", "ZAxis", "Nonparametric", "If a control qubit is 1, rotates a target qubit 180° along the Z-Plane", 1, 1, "Controlled Z"],
  "SW": [new QuantumGate(Swap_Matrix), "SW", "Miscellaneous", "Nonparametric", "Swaps the states of two qubits", 0, 2, "Swap"],
  "CH": [new QuantumGate(ControlledHadamard_Matrix), "CH", "Miscellaneous", "Nonparametric", "If a control qubit is 1, rotates a target qubit from 0 ↔ +, 1 ↔ -, …", 1, 1, "Controlled Hadamard"],
  "TF": [new QuantumGate(Toffoli_Matrix), "TF", "Miscellaneous", "Nonparametric", "If two control qubits are both 1, rotates a target qubit 180° along the X-Plane", 2, 1, "Toffoli"],
  "FR": [new QuantumGate(Fredkin_Matrix), "FR", "Miscellaneous", "Nonparametric", "If a control qubit is 1, swaps the states of two qubits", 1, 2, "Fredkin"],
  "CNX": [new QuantumGate(ControlledNX_Matrix), "CⁿX", "XAxis", "Scalable", "If n control qubits are all 1, rotates a target qubit 180° along the X-Plane", "n", 1, "Controlled-N X"]
};

let parametricGateCache = {}

function gatecache(gatename, theta=Math.PI){
  const key = `${gatename} ${theta}`;
  if (key in parametricGateCache) return parametricGateCache[key];
  else {
    if (theta < 0 || theta >= (2 * Math.PI)) theta %= (2 * Math.PI);
    const cos = Math.cos(theta / 2);
    const sin = Math.sin(theta / 2);
    let gatevalue;
    if (gatename == "RX"){
      gatevalue = new QuantumGate(
        new Matrix([
          [new Complex(cos, 0), new Complex(0, -sin)],
          [new Complex(0, -sin), new Complex(cos, 0)],
        ])
      );
    } else if (gatename == "RY"){
      gatevalue = new QuantumGate(
        new Matrix([
          [new Complex(cos, 0), new Complex(-sin, 0)],
          [new Complex(sin, 0), new Complex(cos, 0)],
        ])
      );
    } else if (gatename == "RZ"){
      gatevalue = new QuantumGate(
        new Matrix([
          [new Complex(cos, -sin), new Complex(0, 0)],
          [new Complex(0, 0), new Complex(cos, sin)],
        ])
      );
    }
    parametricGateCache[key] = gatevalue;
    return gatevalue; 
  }
}

function cleargatecache(){parametricGateCache = {};}


function getGate(gatename="I", theta=Math.PI){
  
  if (gates.hasOwnProperty(gatename)){
    if (gates[gatename][3] == "Parametric") return gatecache(gatename, theta);
    else return gates[gatename][0];
  } else throw new Error("Gate not available");
}




// $$$ VARIABLE SECTION $$$
let qubits = 7;
let stateVector = createStateVector(qubits);
let placedGates = []; // Track placed gates
let highestTime = -1;
let precisionValue = 2;
let hideIfCheck = 0.05;
let estimateSqrtsCheck = true;
let showIndividualCheck = true;
let probabilityValues = [[],[],[]];
let maxProbValue = 0;
let myChart = new Chart("myChart");
let currentType = "bloch";
let gridRows = 0;
let gridCols = 0;
let bSphere;
let gatetracker; // gatetracker[timeindex][qubitindex]

new Tablesort(document.getElementById('thetable'), { descending: true });

function newRenderBlochSphere(){
  if (bSphere != null) bSphere.removeAll();
  bSphere = new BlochSphere();
  bSphere.clearLinesAndBalls();
  bSphere.setColors(qubits);
  let zzz = stateVector.getPureOrMixedAndQubitOrProbability();
  for (let i = 0; i < qubits; i++){
    bSphere.setPosition(zzz[i], i);
  }
  bSphere.render();
}

function placeGate(timeIndex=-1, qubitIndex=-1, gatename="Identity", theta=Math.PI){
  if (qubitIndex == -1) return;
  if (timeIndex == -1) timeIndex = (highestTime + 1); 

  if (!Array.isArray(qubitIndex)) qubitIndex = [qubitIndex];

  if (!placedGates[timeIndex]) placedGates[timeIndex] = [];
  
  placedGates[timeIndex].push([qubitIndex, gatename, theta]);

  if (timeIndex > highestTime) highestTime = timeIndex;
}

function evaluateCircuit(){
  stateVector = createStateVector(qubits);

  for (let i = 0; i <= highestTime; i++){
    for (let entry of placedGates[i]){
      stateVector = getGate(entry[1], entry[2]).applyTo(stateVector, entry[0]);
    }
  }
}

// Helper to format complex numbers
function formatComplex(val) {
  if (typeof val === "number") return val.toString();
  
  let re = (typeof val.re == "string") ? val.re : Complex.formatApproxSqrt(val.re);
  let im = (typeof val.im == "string") ? val.im : Complex.formatApproxSqrt(val.im);

  const rePart = val.re !== 0 ? re.toString() : '';
  let imPart = '';

  if (val.im !== 0 && typeof val.im !== "string") {
    if (Math.abs(val.im) === 1) {
      imPart = (val.im === 1 ? '+i' : '-i');
    } else {
      imPart = (val.im > 0 ? `+${im}i` : `-${im.replace(/^-/, '')}i`);
    }
  } else if (typeof val.im == "string") imPart = im + "i";

  if (rePart && imPart) return `${rePart} ${imPart}`;
  if (rePart) return rePart;
  if (imPart) return imPart;
  return '0';
}


function setupStuff() {
  const container = document.getElementById("gates");

  // Create a span for each color category
  for (const colorName in gateColors) {
    const span = document.createElement("span");
    span.id = colorName;

    // Arrange gates in rows of 6, compact layout
    span.style.display = "grid";
    span.style.gridTemplateColumns = "repeat(6, auto)";
    span.style.gap = "4px";               // tight spacing between gates
    span.style.marginBottom = "6px";      // compact spacing between spans
    span.style.justifyContent = "start";  // left-aligned

    container.appendChild(span);
  }

  // Add each gate to the appropriate span
  for (const key in gates) {
    const [_, acronym, colorCategory] = gates[key];
    const div = document.createElement("div");
    div.className = "gate";
    div.id = key + "-gate";

    // Gate appearance
    div.style.backgroundColor = gateColors[colorCategory];
    div.style.color = "white";
    div.style.padding = "4px 6px";        // compact padding
    div.style.margin = "0";               // remove outside margin
    div.style.fontSize = "28px";          // compact font
    div.style.textAlign = "center";
    div.style.borderRadius = "4px";       // optional style
    div.style.cursor = "grab";
    div.textContent = acronym;

    const targetSpan = document.getElementById(colorCategory);
    if (targetSpan) {
      targetSpan.appendChild(div);
    }
  }

  // Add the popup box to the body
  const popupBox = document.createElement('div');
  popupBox.classList.add('popup-box');
  document.body.appendChild(popupBox);

  // Function to display the popup
  function showPopup(event, gateName) {
    for (let row = 0; row < gridRows; row++) {
        for (let col = 0; col < gridCols; col++) {
          const selector = `[data-row="${row}"][data-col="${col}"]`;
          const cell = document.querySelector(`#circuitframe ${selector}`);
          const potentialGate = cell?.querySelector(':scope > .gateplaced');
          if (potentialGate) {
            writeColorToGrid(row, col, "#f4f7ceff");
          } else {
            writeColorToGrid(row, col, "#cef7ceff");
          }
        }
      }


    const matrix = gates[gateName][0].matrix.rows;
    //console.log(matrix);

    // Format the entire matrix first
    const formattedMatrix = matrix.map(row => row.map(val => formatComplex(val)));

    // Determine the max width of *any* element (shared by all columns)
    let maxWidth = 0;
    for (const row of formattedMatrix) {
      for (const val of row) {
        maxWidth = Math.max(maxWidth, val.length);
      }
    }

    // Pad each value to center it in the column
    const paddedRows = formattedMatrix.map(row =>
      row.map(val => {
        const totalPadding = maxWidth - val.length;
        const padLeft = Math.floor(totalPadding / 2);
        const padRight = totalPadding - padLeft;
        return ' '.repeat(padLeft) + val + ' '.repeat(padRight);
      }).join(' ')
    );



    const matrixString =
    `<pre style="line-height:1; font-size:15px; overflow-y: hidden;"><br>` +
    paddedRows.map((row, i) => {
        const left = i === 0 ? '⎡' : i === paddedRows.length - 1 ? '⎣' : '⎢';
        const right = i === 0 ? '⎤' : i === paddedRows.length - 1 ? '⎦' : '⎥';
        return `${left} ${row} ${right}`;
    }).join('\n') +
    `</pre>`;

    document.getElementById("gateinfo").innerHTML = `<strong><u>${gates[gateName][7]} Gate (${gates[gateName][1]})</u></strong><br><p style="font-size:12px;">${gates[gateName][4]}</p><br>${matrixString}`;
  }





  // Function to hide the popup
  function hidePopup() {
      document.getElementById("gateinfo").innerHTML="<b>When you click a gate, its information will appear here.</b>";
      for (let row = 0; row < gridRows; row++) {
        for (let col = 0; col < gridCols; col++) {
          writeColorToGrid(row, col, "");
        }
      }
  }

  // Attach event listeners to the gate elements
  // Track currently active popup
  let activePopupGate = null;

  // Attach event listeners to the gate elements
  document.querySelectorAll('.gate').forEach(gate => {
      const gateName = gate.id.replace(/-gate$/, "");

      gate.addEventListener('click', (event) => {
          event.stopPropagation(); // Prevent document click from firing
          showPopup(event, gateName);
          activePopupGate = gate;
      });
  });

  // Hide popup when clicking outside of a gate
  document.addEventListener('click', (event) => {
      // If the click was not on the currently active gate, hide popup
      if (activePopupGate && !activePopupGate.contains(event.target)) {
          let target;
          if (event.target.classList.contains('cellline')) target = event.target.parentElement;
          else target = event.target;
          if (target.classList.contains('gridcell') && !target.querySelector('.gateplaced')){
            const gateName = activePopupGate.id.replace(/-gate$/, "");
            placeGate(target.dataset.col, target.dataset.row, gateName);
            afterExecution();
          }
          //window.alert(`Clicked element: <${activePopupGate.tagName.toLowerCase()} id="${activePopupGate.id}" class="${activePopupGate.className}">`);
          hidePopup();
          activePopupGate = null;
      }
  });

}




function createDualSlider(config) {
  const {
    containerId, minThumbId, maxThumbId, trackId,
    minValue, maxValue, step, initialMin, initialMax, vertical
  } = config;

  const container = document.getElementById(containerId);
  const minThumb = document.getElementById(minThumbId);
  const maxThumb = document.getElementById(maxThumbId);
  const track = document.getElementById(trackId);

  let minVal = initialMin;
  let maxVal = initialMax;

  function updateThumbs() {
    if (minVal > maxVal) [minVal, maxVal] = [maxVal, minVal];
    console.log(`${minVal} - ${maxVal}`);

    if (vertical) {
      const h = container.clientHeight;
      const minP = minVal / maxValue;
      const maxP = maxVal / maxValue;

      // lower = top, higher = bottom
      minThumb.style.top = minP * h - 8 + "px";
      maxThumb.style.top = maxP * h - 8 + "px";

      track.style.top = minP * h + "px";
      track.style.height = (maxP - minP) * h + "px";
    } else {
      const w = container.clientWidth;
      const minP = minVal / maxValue;
      const maxP = maxVal / maxValue;

      minThumb.style.left = minP * w - 8 + "px";
      maxThumb.style.left = maxP * w - 8 + "px";

      track.style.left = minP * w + "px";
      track.style.width = (maxP - minP) * w + "px";
    }
  }

  function dragThumb(thumb, isMin) {
    function startDrag(startX, startY, startVal) {
      function moveHandler(clientX, clientY) {
        let newVal;
        if (vertical) {
          const dy = clientY - startY;
          const h = container.clientHeight;
          let deltaVal = dy / h * maxValue;
          newVal = startVal + deltaVal;
        } else {
          const dx = clientX - startX;
          const w = container.clientWidth;
          let deltaVal = dx / w * maxValue;
          newVal = startVal + deltaVal;
        }

        newVal = Math.max(minValue, Math.min(maxValue, newVal));
        newVal = Math.round(newVal / step) * step;

        if (isMin) minVal = newVal; else maxVal = newVal;
        updateThumbs();
      }

      function onMouseMove(e) {
        moveHandler(e.clientX, e.clientY);
      }
      function onTouchMove(e) {
        e.preventDefault();
        const t = e.touches[0];
        moveHandler(t.clientX, t.clientY);
      }

      function stopDrag() {
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", stopDrag);
        document.addEventListener("touchmove", onTouchMove, { passive: false });
        document.removeEventListener("touchend", stopDrag);

        // Only adjust grid once drag is finished
        if (vertical) {
          adjustGrid(maxVal + 1, gridCols);
        } else {
          adjustGrid(gridRows, maxVal + 1);
        }
      }

      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", stopDrag);
      document.addEventListener("touchmove", onTouchMove, { passive: false });
      document.addEventListener("touchend", stopDrag);
    }

    thumb.addEventListener("mousedown", e => {
      e.preventDefault();
      const startX = e.clientX;
      const startY = e.clientY;
      const startVal = isMin ? minVal : maxVal;
      startDrag(startX, startY, startVal);
    });

    thumb.addEventListener("touchstart", e => {
      e.preventDefault();
      const t = e.touches[0];
      const startX = t.clientX;
      const startY = t.clientY;
      const startVal = isMin ? minVal : maxVal;
      startDrag(startX, startY, startVal);
    });
  }


  dragThumb(minThumb, true);
  dragThumb(maxThumb, false);

  updateThumbs();
}



function loadGrid(m, n) {
  gridRows = m;
  gridCols = n;

  const frame = document.getElementById('circuitframe');
  frame.innerHTML = '';
  frame.style.position = 'relative';

  const sliderColFraction = 0.055;
  const labelQubitColFraction = 0.055;
  const labelProbColFraction = 0.100;
  const sliderRowFraction = 0.015;
  const labelTimeFraction = 0.075;

  frame.style.display = 'grid';
  frame.style.gridTemplateColumns = 
    `${sliderColFraction * 100}% ${labelQubitColFraction * 100}% repeat(${n}, ${(1 - sliderColFraction - labelQubitColFraction - labelProbColFraction) * 100 / n}%) ${labelProbColFraction * 100}%`;

  frame.style.gridTemplateRows = 
    `${sliderRowFraction * 100}% ${labelTimeFraction * 100}% repeat(${m}, ${(1 - sliderRowFraction - labelTimeFraction) * 100 / m}%)`;

  // Top-left corner
  const cornerEmpty = document.createElement('div');
  cornerEmpty.style.gridColumn = '1';
  cornerEmpty.style.gridRow = '1';
  frame.appendChild(cornerEmpty);

  const cornerLabel = document.createElement('div');
  cornerLabel.style.gridColumn = '2';
  cornerLabel.style.gridRow = '2';
  frame.appendChild(cornerLabel);

  // Column labels
  for (let col = 0; col < n; col++) {
    const timeLabel = document.createElement('div');
    timeLabel.textContent = col;
    timeLabel.style.fontWeight = "bold";
    timeLabel.style.gridColumn = (col + 3).toString();
    timeLabel.style.gridRow = '2';
    timeLabel.style.display = 'flex';
    timeLabel.style.alignItems = 'center';
    timeLabel.style.justifyContent = 'center';
    timeLabel.style.fontSize = '1.2em';
    timeLabel.style.userSelect = 'none';
    frame.appendChild(timeLabel);
  }

  const probLabel = document.createElement('div');
  probLabel.style.gridColumn = (n + 3).toString();
  probLabel.style.gridRow = '2';
  frame.appendChild(probLabel);

  let genColors = changeColorsProperty(generateColors(qubits), "lightness", 90);

  // Row labels
  for (let row = 0; row < m; row++) {
    const qubitLabel = document.createElement('div');
    qubitLabel.textContent = row;
    qubitLabel.style.backgroundColor = genColors[row];
    qubitLabel.style.fontWeight = "bold";
    qubitLabel.style.gridColumn = '2';
    qubitLabel.style.gridRow = (row + 3).toString();
    qubitLabel.style.display = 'flex';
    qubitLabel.style.alignItems = 'center';
    qubitLabel.style.justifyContent = 'flex-end';
    qubitLabel.style.paddingRight = '10%';
    qubitLabel.style.fontSize = '1.2em';
    qubitLabel.style.userSelect = 'none';
    frame.appendChild(qubitLabel);
  }

  // Grid cells
  for (let row = 0; row < m; row++) {
    for (let col = 0; col < n; col++) {
      const cell = document.createElement('div');
      cell.dataset.row = row;
      cell.dataset.col = col;
      cell.className = 'gridcell';
      cell.style.gridColumn = (col + 3).toString();
      cell.style.gridRow = (row + 3).toString();
      cell.style.position = 'relative';

      const line = document.createElement('div');
      line.className = "cellline";
      line.style.position = 'absolute';
      line.style.top = '50%';
      line.style.width = '100%';
      line.style.height = '3%';
      line.style.backgroundColor = 'blue';
      line.style.transform = 'translateY(-50%)';
      cell.appendChild(line);

      frame.appendChild(cell);
    }

    const probCell = document.createElement('div');
    probCell.textContent = 'x';
    probCell.classList.add("circuitprobability");
    probCell.style.gridColumn = (n + 3).toString();
    probCell.style.gridRow = (row + 3).toString();
    console.log("AAAA");
    probCell.id = `prob-qubit-${row}`;
    frame.appendChild(probCell);
  }
}

function createQubitSlider(qubits) {
  const wrapper = document.createElement('div');
  wrapper.id = "qubitSlider";
  wrapper.className = "slider-container";
  document.getElementById("widget-circuit").appendChild(wrapper);

  wrapper.innerHTML = `
    <div class="slider"></div>
    <div class="range-track" id="qubitRangeTrack"></div>
    <div class="thumb" id="qubitMinThumb"></div>
    <div class="thumb" id="qubitMaxThumb"></div>
  `;

  createDualSlider({
    containerId: "qubitSlider",
    minThumbId: "qubitMinThumb",
    maxThumbId: "qubitMaxThumb",
    trackId: "qubitRangeTrack",
    minValue: 0,
    maxValue: qubits + 2,
    step: 1,
    initialMin: 0,
    initialMax: qubits + 2,
    vertical: true
  });
}

function createTimeSlider(highestTime) {
  const wrapper = document.createElement('div');
  wrapper.id = "timeSlider";
  wrapper.className = "slider-container";
  document.getElementById("widget-circuit").appendChild(wrapper);

  wrapper.innerHTML = `
    <div class="slider"></div>
    <div class="range-track" id="timeRangeTrack"></div>
    <div class="thumb" id="timeMinThumb"></div>
    <div class="thumb" id="timeMaxThumb"></div>
  `;

  createDualSlider({
    containerId: "timeSlider",
    minThumbId: "timeMinThumb",
    maxThumbId: "timeMaxThumb",
    trackId: "timeRangeTrack",
    minValue: 0,
    maxValue: highestTime + 2,
    step: 1,
    initialMin: 0,
    initialMax: highestTime + 2,
    vertical: false
  });
}






function clearCircuit(){
  console.log("CLEAR");
  stateVector = createStateVector(qubits);
  placedGates = [];
  highestTime = -1;
  maxProbValue = 0;
  updateProbabilityDistribution();
}


function writeColorToGrid(row, col, color) {
    const selector = `[data-row="${row}"][data-col="${col}"]`;
    const cell = document.querySelector(`#circuitframe ${selector}`);
    if (cell) {
        cell.style.backgroundColor = color;
    } else {
        console.warn(`Cell at (${row}, ${col}) not found.`);
    }
}

function writeLineToGrid(row, col) {
    const selector = `[data-row="${row}"][data-col="${col}"]`;
    const cell = document.querySelector(`#circuitframe ${selector}`);
    if (!cell) return console.warn(`Cell (${row}, ${col}) not found.`);

    const line = document.createElement('div');
    line.style.position = 'absolute';
    line.style.top = '50%';
    line.style.width = '100%';
    line.style.height = '3%';
    line.style.backgroundColor = 'blue';
    line.style.transform = 'translateY(-50%)';
    cell.appendChild(line);
}

function fitGateToCell(row, col) {
    const cell = document.querySelector(`[data-row="${row}"][data-col="${col}"]`);
    const gate = cell?.querySelector('.gateplaced');
    if (!cell || !gate) return;

    const rect = cell.getBoundingClientRect();
    const divisor = gate.classList.contains('controlgate') ? 2.5 : 1.2;
    const size = Math.min(rect.width, rect.height) / divisor;

    gate.style.width = `${size}px`;
    gate.style.height = `${size}px`;
    gate.style.fontSize = `${size * 0.5}px`;
}

// Optional: make it auto-resize on window resize
window.addEventListener('resize', () => {
    document.querySelectorAll('.gridcell').forEach(cell => {
        const row = cell.dataset.row;
        const col = cell.dataset.col;
        fitGateToCell(row, col);
    });
});


function unloadGrid() {
    document.getElementById("circuitframe").innerHTML = "";
}

function unrenderCircuit() {
    const frame = document.getElementById("circuitframe");
    frame.querySelectorAll(".gateplaced").forEach(el => el.remove());
}


function renderCircuit() {
    for (let timeslot = 0; timeslot <= highestTime; timeslot++) {
        for (let entry of placedGates[timeslot]) {
            const gateinfo = gates[entry[1]];
            const numControls = gateinfo[5];

            // Place control gates (if any)
            if (numControls > 0) {
                for (let i = 0; i < numControls; i++) {
                    const controlRow = entry[0][i];
                    const selector = `[data-row="${controlRow}"][data-col="${timeslot}"]`;
                    const cell = document.querySelector(`#circuitframe ${selector}`);
                    if (!cell) continue;

                    const controlDiv = document.createElement('div');
                    controlDiv.style.backgroundColor = "black";
                    controlDiv.style.color = "white";
                    controlDiv.setAttribute("timeslot", timeslot);
                    controlDiv.classList.add('gateplaced', 'controlgate');
                    controlDiv.innerText = entry[0][numControls];

                    cell.appendChild(controlDiv);
                    fitGateToCell(controlRow, timeslot);
                }
            }

            // Place target gate
            const targetRow = entry[0][numControls];
            const selector = `[data-row="${targetRow}"][data-col="${timeslot}"]`;
            const cell = document.querySelector(`#circuitframe ${selector}`);
            if (!cell) continue;

            const gateDiv = document.createElement('div');
            gateDiv.style.backgroundColor = gateColors[gateinfo[2]];
            gateDiv.style.color = "white";
            gateDiv.setAttribute("timeslot", timeslot);
            gateDiv.classList.add('gateplaced');
            gateDiv.innerText = gateinfo[1];

            cell.appendChild(gateDiv);
            fitGateToCell(targetRow, timeslot);
        }
    }
}

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

function changeColorsProperty(colors, property, newValue) {
  // Helper: parse "hsl(h, s%, l%)" and return {h, s, l}
  function parseHSL(hsl) {
    const match = hsl.match(/hsl\(\s*([\d.]+),\s*([\d.]+)%,\s*([\d.]+)%\s*\)/i);
    if (!match) return null;
    return {
      h: parseFloat(match[1]),
      s: parseFloat(match[2]),
      l: parseFloat(match[3]),
    };
  }

  // Helper: format {h,s,l} back to HSL string
  function formatHSL({h, s, l}) {
    return `hsl(${h}, ${s}%, ${l}%)`;
  }

  return colors.map(colorStr => {
    const hsl = parseHSL(colorStr);
    if (!hsl) return colorStr; // if parsing fails, return original

    // Replace the requested property
    if (property === "hue") hsl.h = newValue;
    else if (property === "saturation") hsl.s = newValue;
    else if (property === "lightness") hsl.l = newValue;

    return formatHSL(hsl);
  });
}


function generateBoringColors(numColors) {
    const colors = [];
    if (numColors <= 1) {
        // Special case: just return black
        return ["rgb(0,0,0)"];
    }

    const step = 255 / (numColors - 1); // Equal spacing from 0 to 255

    for (let i = 0; i < numColors; i++) {
        const value = Math.round(step * i);
        colors.push(`rgb(${value},${value},${value})`);
    }

    return colors;
}


function makeNewChart(thistype="bar") {
    if (currentType == "bar" || currentType == "doughnut") thistype = currentType;

    backgroundColors = generateBoringColors(stateVector.nRows); // Generate unique colors

    chartConfig = {
        type: thistype,
        data: {
            labels: probabilityValues[0],
            datasets: [{
                backgroundColor: backgroundColors,
                data: probabilityValues[1]
            }]
        },
        options: {
            title: {
                display: true,
                text: "Probability Distribution"
            },
            scales: thistype === "bar" ? { y: { beginAtZero: true, max: (maxProbValue ? maxProbValue : 1) } } : {},
            plugins: {
                /*
                legend: {
                    display: thistype === "doughnut" // Hide legend for bar, show for doughnut
                }*/
               legend: {
                    display: false
                }
            },
            responsive: true,           // responsive to container size
            maintainAspectRatio: false  // let CSS aspect-ratio control shape
        }
    };

    myChart.destroy();
    myChart = new Chart("myChart", chartConfig);
}

function qubitProbability(k) {
    const probs = probabilityValues[1];
    let sum = 0;
    const mask = 1 << k;

    for (let j = 0; j < probs.length; j++) {
        if ((j & mask) !== 0) {
            sum += probs[j];
        }
    }
    return sum; // probability qubit k is 1
}

let types = ["bloch", "bar", "doughnut"];

function changeChart(keep="nokeep") {
    let currentIndex = types.indexOf(currentType);
    currentType = types[(currentIndex + 1) % types.length]; // next type, wrap around
    
    if (currentType == "bloch"){
      document.getElementById("blochDiv").style.display = "flex";
      document.getElementById("myChart").style.display = "none";

    } else {
      myChart.destroy();
      chartConfig.type = currentType;
      chartConfig.options.scales = currentType === "bar" ? { y: { beginAtZero: true, max: (maxProbValue ? maxProbValue : 1) } } : {};

      myChart = new Chart("myChart", chartConfig);

      document.getElementById("blochDiv").style.display = "none";
      document.getElementById("myChart").style.display = "inline";
    }
    
}

function updateProbabilityDistribution() {
  console.log("Prob");
  const tbody = document.querySelector('#thetable tbody');
  // Clear existing rows
  tbody.innerHTML = '';

  probabilityValues = [[], [], []];
  maxProbValue = 0;

  for (let i = 0; i < stateVector.nRows; i++) {
    const entry = stateVector.rows[i][0];
    //probabilityValues[2][i] = entry.toString();
    probabilityValues[2][i] = formatComplex(entry);
    probabilityValues[0][i] = i.toString(2).padStart(qubits, '0');
    probabilityValues[1][i] = entry.probability();
    if (probabilityValues[1][i] > maxProbValue) maxProbValue = probabilityValues[1][i];

    // Create new row and cells
    const tr = document.createElement('tr');

    // Create and append three td's (State, Amplitude, Probability)
    const tdState = document.createElement('td');
    tdState.textContent = probabilityValues[0][i];
    tr.appendChild(tdState);

    const tdProbability = document.createElement('td');
    tdProbability.textContent = probabilityValues[1][i].toFixed(precisionValue);
    tr.appendChild(tdProbability);

    const tdAmplitude = document.createElement('td');
    tdAmplitude.textContent = probabilityValues[2][i];
    tr.appendChild(tdAmplitude);

    // Append the row to tbody
    tbody.appendChild(tr);
  }

  makeNewChart();

  console.log("abab");
  console.log(qubits + " " + gridRows);

  for (let i = 0; i < ((qubits > gridRows) ? gridRows : qubits); i++) {
    const p = qubitProbability(i);
    console.log("BBBB");
    const el = document.getElementById(`prob-qubit-${i}`);

    const percentage = p * 100;
    el.textContent = percentage.toFixed(0) + '%';

    let r, g, b;

    if (percentage <= 49.9999999999) {
      // Dark reds: from very dark red (80,0,0) to medium dark red (140,0,0)
      const t = percentage / 50;
      r = Math.round(130 + 40 * t);
      g = 0;
      b = 0;
    } else {
      // Dark greens: from very dark green (0,60,0) to medium dark green (0,140,0)
      const t = (percentage - 50) / 50;
      r = 0;
      g = Math.round(130 + 40 * t);
      b = 0;
    }

    el.style.color = `rgb(${r},${g},${b})`;
  }

  for (let i = qubits; i < gridRows; i++){
    const el = document.getElementById(`prob-qubit-${i}`);
    el.textContent = "x";
    el.style.color = "black";
  }
}


document.getElementById("precisionRange").addEventListener("input", function() {
    precisionValue = this.value;
    updateProbabilityDistribution();
});


function executeCode() {
  let timeindex = 0;
  gatetracker = [];
  
  clearCircuit();
  const codeContent = document.getElementById("code").value;
  const lines = codeContent.split("\n"); // split into array by newlines

  lines.forEach((line, lineNumber) => {
    const tokens = line.split(" ");
    let arg2 = tokens[1];
    if (arg2.startsWith("[") && arg2.endsWith("]")) {
      try {
        arg2 = JSON.parse(arg2); // Parse JSON array
        let needtoincrement = false
        for (let i = 0; i < arg2.length; i++) {
          if (gatetracker[timeindex] && gatetracker[timeindex][arg2[i]]) needtoincrement = true;
        }
        if (needtoincrement) timeindex++;
        for (let i = 0; i < gates[tokens[0].toUpperCase()][5]; i++){
          if (!gatetracker[timeindex]) gatetracker[timeindex] = [];
          gatetracker[timeindex][arg2[i]] = "CONTROL-" + arg2[gates[tokens[0].toUpperCase()][5]];
        }

        for (let i = gates[tokens[0].toUpperCase()][5]; i < arg2.length; i++){
          if (!gatetracker[timeindex]) gatetracker[timeindex] = [];
          gatetracker[timeindex][arg2[i]] = tokens[0].toUpperCase();
        }
        
      } catch {
        console.error(`Invalid array format on line ${lineNumber + 1}: ${arg2}`);
        arg2 = [];
      }
    } else {
      if (gatetracker[timeindex] && gatetracker[timeindex][arg2]) timeindex++;
      if (!gatetracker[timeindex]) gatetracker[timeindex] = [];
      gatetracker[timeindex][arg2] = tokens[0].toUpperCase();
    }
    placeGate(timeindex, arg2, tokens[0].toUpperCase(), tokens[2]? Math.PI * parseFloat(tokens[2]) : Math.PI);
  });

  afterExecution();
}

function afterExecution(){
  unrenderCircuit();
  evaluateCircuit();
  renderCircuit();
  updateProbabilityDistribution();
  newRenderBlochSphere();
  console.log(stateVector.printStateVector());
  document.getElementById("myChart").style.display = (currentType == "bar" || currentType == "doughnut") ? "inline" : "none";
}

function adjustGrid(newRows, newCols){
  if (newRows < 1) newRows = 1;
  if (newCols < 1) newCols = 1;
  if (newRows > (qubits+5)) newRows = (qubits+5);
  if (newCols > (highestTime+5)) newCols = highestTime + 5;
  loadGrid(newRows, newCols);
  renderCircuit();
  updateProbabilityDistribution();
}


// --- Play Area: Default ---
setupStuff()

document.getElementById("code").value =
`RX 0 0.5
RY 1 0.25
RY 2 0.125
RX 3 0.0625
H 2
CX [3,2]`;

executeCode();
adjustGrid(qubits+3, highestTime+3);
createQubitSlider(qubits);
createTimeSlider(highestTime);
//



/*
function buildGroverCircuit(qubits, targetBitString) { 
  let t = 0; // timeslot counter
  let output = "";

  function addAllH() {
    for (let q = 0; q < qubits; q++) output += "H " + q + "\n"; //placeGate(t, q, "Hadamard");
    t++;
  }

  function addAllX() {
    for (let q = 0; q < qubits; q++) output += "X " + q + "\n"; // placeGate(t, q, "Pauli-X");
    t++;
  }

  // Proper multi-controlled X using ancillas
  function addMultiControlledX(controls, target) {
    if (controls.length === 1) {
      // Simple CNOT
      output += "CX [" + controls[0] + "," + target + "]\n"; //placeGate(t, [controls[0], target], "Controlled X");
      t++;
      return;
    }

    // Use ancillas for AND chain
    let ancillaStart = qubits; // assuming grid has extra ancilla rows
    let ancillas = [];

    // Compute partial ANDs
    let prev = controls[0];
    for (let i = 1; i < controls.length; i++) {
      let anc = ancillaStart + ancillas.length;
      ancillas.push(anc);
      output += "CX [" + prev + "," + anc + "]\n"; //placeGate(t, [prev, anc], "Controlled X");
      t++;
      output += "CX [" + controls[i] + "," + anc + "]\n"; //placeGate(t, [controls[i], anc], "Controlled X");
      t++;
      prev = anc;
    }

    // Controlled X from final ancilla to target
    output += "CX [" + prev + "," + target + "]\n"; // placeGate(t, [prev, target], "Controlled X");
    t++;

    // Uncompute ancillas in reverse
    for (let i = ancillas.length - 1; i >= 0; i--) {
      output += "CX [" + controls[i+1] + "," + ancillas[i] + "]\n"; // placeGate(t, [controls[i + 1], ancillas[i]], "Controlled X");
      t++;
      output += "CX [" + controls[i] + "," + ancillas[i] + "]\n"; //placeGate(t, [controls[i], ancillas[i]], "Controlled X");
      t++;
    }
  }

  // Multi-controlled Z implemented via MCX
  function addMultiControlledZ(controls, target) {
    output += "H " + target + "\n"; //placeGate(t, target, "Hadamard");
    t++;
    addMultiControlledX(controls, target);
    output += "H " + target + "\n"; //placeGate(t, target, "Hadamard");
    t++;
  }

  function addOracle() {
    // Flip 0 bits to 1 with X
    for (let q = 0; q < qubits; q++) {
      if (targetBitString[q] === '0') output += "X " + q + "\n"; //placeGate(t, q, "Pauli-X");
    }
    t++;

    // MCZ on all qubits
    const controls = [...Array(qubits - 1).keys()];
    const target = qubits - 1;
    addMultiControlledZ(controls, target);

    // Flip back the X's
    for (let q = 0; q < qubits; q++) {
      if (targetBitString[q] === '0') output += "X " + q + "\n"; //placeGate(t, q, "Pauli-X");
    }
    t++;
  }

  function addDiffusion() {
    addAllH();
    addAllX();

    const controls = [...Array(qubits - 1).keys()];
    const target = qubits - 1;
    addMultiControlledZ(controls, target);

    addAllX();
    addAllH();
  }

  // --- Build the circuit ---
  addAllH(); // Initial superposition

  function optimalIterations(nQubits) {
    const N = 1 << nQubits;
    return Math.floor((Math.PI / 4) * Math.sqrt(N));
  }

  const iterations = optimalIterations(qubits);
  for (let i = 0; i < iterations; i++) {
    addOracle();
    addDiffusion();
  }

  return output;
}*/

function buildGroverCircuit(qubits, targetBitString) {
  let output = "";

  function addAllH() {
    for (let q = 0; q < qubits; q++) {
      output += `H ${q}\n`;
    }
  }

  function addAllX() {
    for (let q = 0; q < qubits; q++) {
      output += `X ${q}\n`;
    }
  }

  // Multi-controlled X without ancillas, recursive decomposition
  function addMCX(controls, target) {
    const n = controls.length;

    if (n === 0) {
      output += `X ${target}\n`;
      return;
    }
    if (n === 1) {
      output += `CX [${controls[0]},${target}]\n`;
      return;
    }
    if (n === 2) {
      output += `TF [${controls[0]},${controls[1]},${target}]\n`;
      return;
    }

    // Gray-code approach: flip one control at a time, apply Toffoli, then unflip
    // Example: controls = [0,1,2,3], target=4

    // Forward pass: build up "conjunction" into higher controls
    for (let i = 0; i < n - 2; i++) {
      output += `TF [${controls[i]},${controls[i + 1]},${controls[i + 2]}]\n`;
    }

    // Final Toffoli with the last two controls and the target
    output += `TF [${controls[n - 2]},${controls[n - 1]},${target}]\n`;

    // Backward pass: uncompute the conjunctions
    for (let i = n - 3; i >= 0; i--) {
      output += `TF [${controls[i]},${controls[i + 1]},${controls[i + 2]}]\n`;
    }
  }


  // Multi-controlled Z via H + MCX + H
  function addMCZ(controls, target) {
    output += `H ${target}\n`;
    addMCX([...controls], target);
    output += `H ${target}\n`;
  }

  // Oracle for target bitstring
  function addOracle() {
    for (let q = 0; q < qubits; q++) {
      if (targetBitString[q] === '0') output += `X ${q}\n`;
    }
    const controls = [...Array(qubits - 1).keys()];
    const target = qubits - 1;
    addMCZ(controls, target);
    for (let q = 0; q < qubits; q++) {
      if (targetBitString[q] === '0') output += `X ${q}\n`;
    }
  }

  // Diffusion operator
  function addDiffusion() {
    addAllH();
    addAllX();
    const controls = [...Array(qubits - 1).keys()];
    const target = qubits - 1;
    addMCZ(controls, target);
    addAllX();
    addAllH();
  }

  // Build the full circuit
  addAllH(); // initial superposition

  const N = 1 << qubits;
  const iterations = Math.floor((Math.PI / 4) * Math.sqrt(N));
  for (let i = 0; i < iterations; i++) {
    addOracle();
    addDiffusion();
  }

  return output;
}

let output = buildGroverCircuit(4, "1010");
console.log(output);

/*

// GROVER'S ALGORITHM
clearCircuit();
qubits = 7;
const targetBitString = "1100111";

if (targetBitString.length !== qubits) {
  throw new Error(`Target bitstring length (${targetBitString.length}) must equal qubits (${qubits})`);
}

const markedIndex = parseInt(targetBitString, 2);

// --- 1) Initialize uniform superposition ---
for (let q = 0; q < qubits; q++) {
  placeGate(0, q, "H");
}

evaluateCircuit();
console.log("After initial Hadamards:");
console.log(stateVector.printStateVector());
document.getElementById("widget-data").innerHTML = stateVector.printStateVector();

// --- 2) Oracle flips phase of marked state ---
function oracle(state, markedIndex) {
  const size = state.nRows;

  // --- Convert X flips to placeGate ---
  for (let q = 0; q < qubits; q++) {
    if (targetBitString[q] === '0') {
      placeGate(0, q, "X"); // was previously manipulating state directly
    }
  }

  // --- Keep phase flip as-is (matrix-based) ---
  const newRows = state.rows.map((row, i) => {
    if (i === markedIndex) {
      return [row[0].mul(new Complex(-1, 0))]; // flip phase
    }
    return [row[0]];
  });

  // --- Convert X flips back after oracle ---
  for (let q = 0; q < qubits; q++) {
    if (targetBitString[q] === '0') {
      placeGate(0, q, "X");
    }
  }

  return new Matrix(newRows);
}

// --- 3) Precompute diffusion gate ---
function diffusionOperator(nQubits) {
  const size = 1 << nQubits;
  const twoOverN = 2 / size;
  const rows = [];

  for (let i = 0; i < size; i++) {
    const row = [];
    for (let j = 0; j < size; j++) {
      if (i === j) {
        row.push(new Complex(twoOverN - 1, 0));
      } else {
        row.push(new Complex(twoOverN, 0));
      }
    }
    rows.push(row);
  }
  return new QuantumGate(new Matrix(rows));
}

// --- 4) Compute optimal Grover iteration count ---
function optimalIterations(nQubits) {
  const N = 1 << nQubits;
  return Math.floor((Math.PI / 4) * Math.sqrt(N));
}

const diffusion = diffusionOperator(qubits);
const iterations = optimalIterations(qubits);

console.log(`Running Grover's algorithm with ${iterations} iterations for marked state |${targetBitString}⟩`);

// --- 5) Perform Grover iterations ---
for (let iter = 0; iter < iterations; iter++) {
  stateVector = oracle(stateVector, markedIndex);
  stateVector = diffusion.applyTo(stateVector, [...Array(qubits).keys()]);
}

console.log(stateVector.printStateVector());
document.getElementById("widget-data").innerHTML = stateVector.printStateVector();


*/



/*
// GROVER'S ALGORITHM
clearCircuit();
// Input your target bitstring here (length must match qubits)const qubits = 4;

const targetBitString = "1100";
//const targetBitString = Array.from({length: qubits}, (_, i) => (Math.sin(Date.now() + i) * 10000 % 1) < 0.5 ? '0' : '1').join('');
// Validate input length
if (targetBitString.length !== qubits) {
  throw new Error(`Target bitstring length (${targetBitString.length}) must equal qubits (${qubits})`);
}

const markedIndex = parseInt(targetBitString, 2);

// Oracle flips phase of marked state
function oracle(state, markedIndex) {
  const size = state.nRows;
  const newRows = state.rows.map((row, i) => {
    if (i === markedIndex) {
      return [row[0].mul(new Complex(-1, 0))]; // flip phase
    }
    return [row[0]];
  });
  return new Matrix(newRows);
}

// Diffusion operator: 2|s⟩⟨s| - I where |s⟩ is uniform superposition
function diffusionOperator(nQubits) {
  const size = 1 << nQubits;    // = 2^nQubits
  const twoOverN = 2 / size;    // = 2 / 2^nQubits = 1 / 2^(nQubits - 1)
  const rows = [];

  for (let i = 0; i < size; i++) {
    const row = [];
    for (let j = 0; j < size; j++) {
      if (i === j) {
        row.push(new Complex(twoOverN - 1, 0));
      } else {
        row.push(new Complex(twoOverN, 0));
      }
    }
    rows.push(row);
  }
  return new QuantumGate(new Matrix(rows));
}

// Compute optimal Grover iteration count for one marked item:
// floor(pi/4 * sqrt(N)) where N = 2^n
function optimalIterations(nQubits) {
  const N = 1 << nQubits;
  return Math.floor((Math.PI / 4) * Math.sqrt(N));
}

// 1) Initialize uniform superposition: apply H to all qubits
for (let q = 0; q < qubits; q++) {
  placeGate(0,q,"H");
}

evaluateCircuit();

// 2) Precompute diffusion gate
const diffusion = diffusionOperator(qubits);

// 3) Perform Grover iterations
const iterations = optimalIterations(qubits);
console.log(`Running Grover's algorithm with ${iterations} iterations for marked state |${targetBitString}⟩`);

for (let iter = 0; iter < iterations; iter++) {
  stateVector = oracle(stateVector, markedIndex);
  stateVector = diffusion.applyTo(stateVector, [...Array(qubits).keys()]);
}

console.log(stateVector.printStateVector());
document.getElementById("widget-data").innerHTML = stateVector.printStateVector();
*/