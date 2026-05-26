/**
 * Bloch Sphere Visualization
 * Displays magnetization vector on a 3D Bloch sphere
 */

class BlochSphereVisualization {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.scene = null;
        this.camera = null;
        this.renderer = null;

        // Bloch sphere components
        this.sphere = null;
        this.magnetization = null;
        this.magnetizationArrow = null;
        this.axes = {};

        // Magnetization state
        this.theta = 0;        // Polar angle (0 = +z)
        this.phi = 0;          // Azimuthal angle
        this.magnitude = 1;    // Magnetization magnitude (0-1)

        // Animation
        this.animationId = null;
        this.isAnimating = false;
        this.targetTheta = 0;
        this.targetPhi = 0;

        this.init();
    }

    init() {
        if (!this.container) {
            console.error('Bloch sphere container not found');
            return;
        }

        // Scene setup
        this.scene = new THREE.Scene();
        this.scene.background = window.QubibyteTheme
            ? window.QubibyteTheme.createThreeBackground()
            : new THREE.Color(0x0f172a);

        // Camera setup
        const aspect = this.container.clientWidth / this.container.clientHeight;
        this.camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 100);
        this.camera.position.set(3, 2, 3);
        this.camera.lookAt(0, 0, 0);

        // Renderer setup
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.container.appendChild(this.renderer.domElement);

        // Lighting
        const ambient = new THREE.AmbientLight(0x404060, 0.5);
        this.scene.add(ambient);

        const light = new THREE.DirectionalLight(0xffffff, 0.8);
        light.position.set(5, 5, 5);
        this.scene.add(light);

        // Create Bloch sphere
        this.createSphere();
        this.createAxes();
        this.createMagnetization();

        // Setup controls
        this.setupControls();

        // Handle resize
        window.addEventListener('resize', () => this.onWindowResize());

        // Start render loop
        this.animate();
    }

    createSphere() {
        // Transparent sphere
        const sphereGeometry = new THREE.SphereGeometry(1, 32, 32);
        const sphereMaterial = new THREE.MeshPhysicalMaterial({
            color: 0x6366f1,
            metalness: 0,
            roughness: 0.5,
            transmission: 0.7,
            thickness: 0.1,
            transparent: true,
            opacity: 0.2,
            side: THREE.DoubleSide
        });
        this.sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
        this.scene.add(this.sphere);

        // Wireframe overlay
        const wireGeometry = new THREE.SphereGeometry(1.001, 16, 16);
        const wireMaterial = new THREE.MeshBasicMaterial({
            color: 0x475569,
            wireframe: true,
            transparent: true,
            opacity: 0.3
        });
        const wireframe = new THREE.Mesh(wireGeometry, wireMaterial);
        this.scene.add(wireframe);

        // Equator circle
        const equatorGeometry = new THREE.TorusGeometry(1, 0.01, 8, 64);
        const equatorMaterial = new THREE.MeshBasicMaterial({ color: 0x8b5cf6 });
        const equator = new THREE.Mesh(equatorGeometry, equatorMaterial);
        equator.rotation.x = Math.PI / 2;
        this.scene.add(equator);
    }

    createAxes() {
        const axisLength = 1.5;
        const axisThickness = 0.02;

        // X axis (red)
        const xGeometry = new THREE.CylinderGeometry(axisThickness, axisThickness, axisLength * 2, 8);
        const xMaterial = new THREE.MeshBasicMaterial({ color: 0xef4444 });
        const xAxis = new THREE.Mesh(xGeometry, xMaterial);
        xAxis.rotation.z = Math.PI / 2;
        this.scene.add(xAxis);
        this.axes.x = xAxis;

        // Y axis (green)
        const yGeometry = new THREE.CylinderGeometry(axisThickness, axisThickness, axisLength * 2, 8);
        const yMaterial = new THREE.MeshBasicMaterial({ color: 0x22c55e });
        const yAxis = new THREE.Mesh(yGeometry, yMaterial);
        yAxis.rotation.x = Math.PI / 2;
        this.scene.add(yAxis);
        this.axes.y = yAxis;

        // Z axis (blue)
        const zGeometry = new THREE.CylinderGeometry(axisThickness, axisThickness, axisLength * 2, 8);
        const zMaterial = new THREE.MeshBasicMaterial({ color: 0x3b82f6 });
        const zAxis = new THREE.Mesh(zGeometry, zMaterial);
        this.scene.add(zAxis);
        this.axes.z = zAxis;

        // Axis labels
        this.addAxisLabel('x', new THREE.Vector3(axisLength + 0.2, 0, 0));
        this.addAxisLabel('y', new THREE.Vector3(0, 0, axisLength + 0.2));
        this.addAxisLabel('z', new THREE.Vector3(0, axisLength + 0.2, 0));

        // State labels
        this.addAxisLabel('|0⟩', new THREE.Vector3(0, axisLength + 0.35, 0), '#3b82f6');
        this.addAxisLabel('|1⟩', new THREE.Vector3(0, -(axisLength + 0.35), 0), '#3b82f6');
        this.addAxisLabel('|+⟩', new THREE.Vector3(axisLength + 0.35, 0, 0), '#ef4444');
        this.addAxisLabel('|-⟩', new THREE.Vector3(-(axisLength + 0.35), 0, 0), '#ef4444');
    }

    addAxisLabel(text, position, color = '#ffffff') {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = 64;
        canvas.height = 64;

        context.fillStyle = color;
        context.font = '24px Arial';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText(text, 32, 32);

        const texture = new THREE.CanvasTexture(canvas);
        const material = new THREE.SpriteMaterial({ map: texture });
        const sprite = new THREE.Sprite(material);
        sprite.scale.set(0.3, 0.3, 1);
        sprite.position.copy(position);
        this.scene.add(sprite);
    }

    createMagnetization() {
        // Magnetization vector (arrow)
        const arrowLength = 1;
        const arrowHeadLength = 0.15;
        const arrowHeadWidth = 0.08;

        // Main cylinder
        const shaftGeometry = new THREE.CylinderGeometry(0.03, 0.03, arrowLength - arrowHeadLength, 8);
        const shaftMaterial = new THREE.MeshPhysicalMaterial({
            color: 0xf59e0b,
            metalness: 0.5,
            roughness: 0.3,
            emissive: 0xf59e0b,
            emissiveIntensity: 0.3
        });
        const shaft = new THREE.Mesh(shaftGeometry, shaftMaterial);
        shaft.position.y = (arrowLength - arrowHeadLength) / 2;

        // Arrow head (cone)
        const headGeometry = new THREE.ConeGeometry(arrowHeadWidth, arrowHeadLength, 8);
        const head = new THREE.Mesh(headGeometry, shaftMaterial);
        head.position.y = arrowLength - arrowHeadLength / 2;

        // Group for the arrow
        this.magnetizationArrow = new THREE.Group();
        this.magnetizationArrow.add(shaft);
        this.magnetizationArrow.add(head);
        this.scene.add(this.magnetizationArrow);

        // Point at origin (sphere)
        const pointGeometry = new THREE.SphereGeometry(0.05, 16, 16);
        const pointMaterial = new THREE.MeshPhysicalMaterial({
            color: 0xf59e0b,
            metalness: 0.5,
            roughness: 0.3,
            emissive: 0xf59e0b,
            emissiveIntensity: 0.5
        });
        const point = new THREE.Mesh(pointGeometry, pointMaterial);
        this.scene.add(point);

        // Initialize at |0⟩ state (z-axis, theta = 0)
        this.updateMagnetizationDisplay();
    }

    updateMagnetizationDisplay() {
        if (!this.magnetizationArrow) return;

        // Convert spherical to Cartesian
        // In Bloch sphere: theta=0 is +z (|0⟩), theta=π is -z (|1⟩)
        const x = this.magnitude * Math.sin(this.theta) * Math.cos(this.phi);
        const y = this.magnitude * Math.cos(this.theta);
        const z = this.magnitude * Math.sin(this.theta) * Math.sin(this.phi);

        // Point the arrow in the direction of the magnetization
        this.magnetizationArrow.lookAt(x, y, z);
        this.magnetizationArrow.rotateX(Math.PI / 2);

        // Update state display
        this.updateStateDisplay();
    }

    updateStateDisplay() {
        // Normalize theta to [0, π] for display
        let displayTheta = this.theta;
        displayTheta = ((displayTheta % (2 * Math.PI)) + (2 * Math.PI)) % (2 * Math.PI);
        if (displayTheta > Math.PI) {
            displayTheta = 2 * Math.PI - displayTheta;
        }

        // Normalize phi to [0, 2π) for display
        let displayPhi = ((this.phi % (2 * Math.PI)) + (2 * Math.PI)) % (2 * Math.PI);

        // Update theta value
        const thetaEl = document.getElementById('thetaValue');
        if (thetaEl) {
            thetaEl.textContent = (displayTheta * 180 / Math.PI).toFixed(1) + '°';
        }

        // Update phi value
        const phiEl = document.getElementById('phiValue');
        if (phiEl) {
            phiEl.textContent = (displayPhi * 180 / Math.PI).toFixed(1) + '°';
        }

        // Update magnitude
        const magEl = document.getElementById('magnitudeValue');
        if (magEl) {
            magEl.textContent = this.magnitude.toFixed(2);
        }

        // Update state label
        const stateEl = document.getElementById('stateLabel');
        if (stateEl) {
            stateEl.textContent = this.getStateLabel();
        }
    }

    getStateLabel() {
        const thetaDeg = this.theta * 180 / Math.PI;
        const phiDeg = this.phi * 180 / Math.PI;

        // Check for common states
        if (thetaDeg < 5) return '|0⟩';
        if (Math.abs(thetaDeg - 180) < 5) return '|1⟩';
        if (Math.abs(thetaDeg - 90) < 10) {
            // In equator - check phi
            const phiMod = ((phiDeg % 360) + 360) % 360;
            if (phiMod < 15 || phiMod > 345) return '|+⟩';
            if (Math.abs(phiMod - 180) < 15) return '|-⟩';
            if (Math.abs(phiMod - 90) < 15) return '|+i⟩';
            if (Math.abs(phiMod - 270) < 15) return '|-i⟩';
        }

        // Generic superposition
        const alpha = Math.cos(this.theta / 2);
        const beta = Math.sin(this.theta / 2);
        if (alpha > 0.9) return '≈|0⟩';
        if (beta > 0.9) return '≈|1⟩';
        return 'ψ';
    }

    applyPulse(angleDeg, phase = 'x') {
        // Apply RF pulse at specified angle and phase
        // Clamp input angle to reasonable range
        angleDeg = Math.max(-360, Math.min(360, angleDeg));
        const angleRad = angleDeg * Math.PI / 180;

        // Calculate target state based on current state and pulse
        let targetTheta = this.theta;
        let targetPhi = this.phi;

        switch (phase) {
            case 'x':
                // Rotation about x-axis
                targetTheta = this.theta + angleRad;
                break;
            case '-x':
                targetTheta = this.theta - angleRad;
                break;
            case 'y':
                // Rotation about y-axis changes phi when theta != 0, π
                if (Math.abs(this.theta) < 0.01 || Math.abs(this.theta - Math.PI) < 0.01) {
                    targetTheta = angleRad;
                    targetPhi = Math.PI / 2;
                } else {
                    targetPhi = this.phi + angleRad;
                }
                break;
            case '-y':
                if (Math.abs(this.theta) < 0.01 || Math.abs(this.theta - Math.PI) < 0.01) {
                    targetTheta = angleRad;
                    targetPhi = -Math.PI / 2;
                } else {
                    targetPhi = this.phi - angleRad;
                }
                break;
        }

        // Normalize theta to [0, π]
        // First, reduce to [0, 2π)
        targetTheta = ((targetTheta % (2 * Math.PI)) + (2 * Math.PI)) % (2 * Math.PI);

        // If theta > π, reflect it back
        if (targetTheta > Math.PI) {
            targetTheta = 2 * Math.PI - targetTheta;
            targetPhi += Math.PI;
        }

        // Normalize phi to [0, 2π)
        targetPhi = ((targetPhi % (2 * Math.PI)) + (2 * Math.PI)) % (2 * Math.PI);

        this.animateTo(targetTheta, targetPhi);
    }

    apply90Pulse() {
        this.applyPulse(90);
    }

    apply180Pulse() {
        this.applyPulse(180);
    }

    reset() {
        // Reset to |0⟩ state
        this.animateTo(0, 0);
        this.magnitude = 1;
        this.updateStateDisplay();
    }

    animateTo(targetTheta, targetPhi) {
        this.targetTheta = targetTheta;
        this.targetPhi = targetPhi;
        this.isAnimating = true;
    }

    setupControls() {
        // Simple orbit controls
        let isMouseDown = false;
        let previousMousePosition = { x: 0, y: 0 };
        let spherical = {
            radius: 5,
            phi: Math.PI / 4,
            theta: Math.PI / 4
        };

        const updateCameraPosition = () => {
            this.camera.position.x = spherical.radius * Math.sin(spherical.phi) * Math.cos(spherical.theta);
            this.camera.position.y = spherical.radius * Math.cos(spherical.phi);
            this.camera.position.z = spherical.radius * Math.sin(spherical.phi) * Math.sin(spherical.theta);
            this.camera.lookAt(0, 0, 0);
        };

        this.container.addEventListener('mousedown', (e) => {
            isMouseDown = true;
            previousMousePosition = { x: e.clientX, y: e.clientY };
        });

        this.container.addEventListener('mouseup', () => {
            isMouseDown = false;
        });

        this.container.addEventListener('mousemove', (e) => {
            if (!isMouseDown) return;

            const deltaX = e.clientX - previousMousePosition.x;
            const deltaY = e.clientY - previousMousePosition.y;

            spherical.theta -= deltaX * 0.01;
            spherical.phi = Math.max(0.1, Math.min(Math.PI - 0.1, spherical.phi + deltaY * 0.01));

            updateCameraPosition();
            previousMousePosition = { x: e.clientX, y: e.clientY };
        });

        this.container.addEventListener('wheel', (e) => {
            e.preventDefault();
            spherical.radius = Math.max(2, Math.min(10, spherical.radius + e.deltaY * 0.01));
            updateCameraPosition();
        });
    }

    animate() {
        this.animationId = requestAnimationFrame(() => this.animate());

        // Smooth animation to target state
        if (this.isAnimating) {
            const speed = 0.1;
            const dTheta = this.targetTheta - this.theta;
            const dPhi = this.targetPhi - this.phi;

            if (Math.abs(dTheta) > 0.01 || Math.abs(dPhi) > 0.01) {
                this.theta += dTheta * speed;
                this.phi += dPhi * speed;
                this.updateMagnetizationDisplay();
            } else {
                this.theta = this.targetTheta;
                this.phi = this.targetPhi;
                this.updateMagnetizationDisplay();
                this.isAnimating = false;
            }
        }

        // Precession animation when not at the poles (theta > 0.1 and theta < π - 0.1)
        // The magnetization precesses around the z-axis whenever it has any xy component
        const notAtNorthPole = this.theta > 0.1;
        const notAtSouthPole = this.theta < Math.PI - 0.1;
        if (notAtNorthPole && notAtSouthPole && !this.isAnimating) {
            this.phi += 0.02;
            // Keep phi in reasonable range
            if (this.phi > 2 * Math.PI) {
                this.phi -= 2 * Math.PI;
            }
            this.updateMagnetizationDisplay();
        }

        this.renderer.render(this.scene, this.camera);
    }

    onWindowResize() {
        if (!this.container) return;

        const width = this.container.clientWidth;
        const height = this.container.clientHeight;

        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
    }

    /**
     * Set magnetization state directly
     * @param {number} theta - Polar angle (0 = |0⟩, π = |1⟩)
     * @param {number} phi - Azimuthal angle
     */
    setState(theta, phi) {
        this.theta = theta;
        this.phi = phi;
        this.updateMagnetizationDisplay();
    }

    /**
     * Simulate T2 relaxation (dephasing in xy plane)
     * @param {number} t2 - T2 time constant
     * @param {number} duration - Simulation duration
     */
    simulateT2Relaxation(t2, duration) {
        const startMagnitude = this.magnitude;
        const startTime = Date.now();

        const relaxationLoop = () => {
            const elapsed = (Date.now() - startTime) / 1000;
            if (elapsed < duration) {
                this.magnitude = startMagnitude * Math.exp(-elapsed / t2);
                requestAnimationFrame(relaxationLoop);
            } else {
                this.magnitude = startMagnitude * Math.exp(-duration / t2);
            }
        };

        relaxationLoop();
    }

    dispose() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }

        if (this.renderer) {
            this.renderer.dispose();
            this.container.removeChild(this.renderer.domElement);
        }
    }
}

// Export for use in other modules
window.BlochSphereVisualization = BlochSphereVisualization;
