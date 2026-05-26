/**
 * 3D NMR Spectrometer Visualization
 * Interactive Three.js scene with:
 * - Permanent bar magnets (N/S poles) in landscape orientation
 * - B0 field along X-axis (horizontal, from N to S)
 * - RF solenoid coil wound around Y-axis (sample tube), producing B1 along Y when current flows
 * - Proper magnetic field lines (closed loops, no monopoles)
 * - Sample tube
 */

class SpectrometerVisualization {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        if (!this.container) {
            console.error('Container not found:', containerId);
            return;
        }

        // Parameters
        this.params = {
            magnetGap: 50,       // mm (gap between magnet faces)
            magnetLength: 30,    // mm (length of each bar magnet)
            magnetWidth: 50,     // mm (width/height of magnet cross-section)
            coilDiameter: 15,    // mm
            coilTurns: 10,
            coilLength: 30,      // mm (along Y axis)
            sampleDiameter: 5,   // mm
            sampleHeight: 25     // mm
        };

        this.isAnimating = false;
        this.animationPhase = 0;
        this.experimentRunning = false;

        this.init();
        this.animate();
    }

    init() {
        const width = this.container.clientWidth || 400;
        const height = this.container.clientHeight || 300;

        // Scene setup
        this.scene = new THREE.Scene();
        this.scene.background = window.QubibyteTheme
            ? window.QubibyteTheme.createThreeBackground()
            : new THREE.Color(0x0a0f1a);

        // Camera
        this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
        this.camera.position.set(100, 80, 100);
        this.camera.lookAt(0, 0, 0);

        // Renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(width, height);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.container.appendChild(this.renderer.domElement);

        // Lighting
        this.setupLighting();

        // Create components
        this.createBarMagnets();
        this.createB0FieldLines();
        this.createSolenoidCoil();
        this.createSample();
        this.createAxisLabels();

        // Controls
        this.setupControls();

        // Handle resize
        window.addEventListener('resize', () => this.onWindowResize());

        this.renderer.render(this.scene, this.camera);
    }

    setupLighting() {
        const ambient = new THREE.AmbientLight(0x404060, 0.6);
        this.scene.add(ambient);

        const mainLight = new THREE.DirectionalLight(0xffffff, 0.8);
        mainLight.position.set(50, 100, 50);
        this.scene.add(mainLight);

        const fillLight = new THREE.DirectionalLight(0x6080ff, 0.3);
        fillLight.position.set(-50, 50, -50);
        this.scene.add(fillLight);
    }

    createBarMagnets() {
        const gap = this.params.magnetGap;
        const length = this.params.magnetLength;
        const width = this.params.magnetWidth;

        // Bar magnet geometry (rectangular prism)
        const magnetGeometry = new THREE.BoxGeometry(length, width, width);

        // Left magnet (N pole facing right, toward gap)
        // Red on the right face (N pole), gray on left
        const leftMagnetGroup = new THREE.Group();

        // Main body
        const leftBodyMaterial = new THREE.MeshPhongMaterial({
            color: 0x555566,
            specular: 0x222222,
            shininess: 30
        });
        const leftBody = new THREE.Mesh(magnetGeometry, leftBodyMaterial);
        leftMagnetGroup.add(leftBody);

        // N pole face (right side of left magnet, facing the gap)
        const poleFaceGeometry = new THREE.BoxGeometry(1, width * 0.95, width * 0.95);
        const nPoleMaterial = new THREE.MeshPhongMaterial({
            color: 0xff3366,
            emissive: 0x331122,
            specular: 0x444444,
            shininess: 60
        });
        const nPoleFace = new THREE.Mesh(poleFaceGeometry, nPoleMaterial);
        nPoleFace.position.x = length / 2;
        leftMagnetGroup.add(nPoleFace);

        // S pole face (left side of left magnet, away from gap)
        const sPoleMaterial = new THREE.MeshPhongMaterial({
            color: 0x3366ff,
            emissive: 0x112233,
            specular: 0x444444,
            shininess: 60
        });
        const sPoleFaceLeft = new THREE.Mesh(poleFaceGeometry, sPoleMaterial);
        sPoleFaceLeft.position.x = -length / 2;
        leftMagnetGroup.add(sPoleFaceLeft);

        // N label - positioned at world coordinates (left magnet's right face)
        // Left magnet is at x = -gap/2 - length/2, N pole face is at local x = length/2
        // So world x = -gap/2 - length/2 + length/2 = -gap/2
        this.addPoleLabel('N', new THREE.Vector3(-gap / 2 + 5, 0, width / 2 + 8), '#ff6688');

        leftMagnetGroup.position.set(-gap / 2 - length / 2, 0, 0);
        this.scene.add(leftMagnetGroup);

        // Right magnet (S pole facing left, toward gap)
        const rightMagnetGroup = new THREE.Group();

        const rightBody = new THREE.Mesh(magnetGeometry, leftBodyMaterial.clone());
        rightMagnetGroup.add(rightBody);

        // S pole face (left side of right magnet, facing gap)
        const sPoleFaceRight = new THREE.Mesh(poleFaceGeometry, sPoleMaterial.clone());
        sPoleFaceRight.position.x = -length / 2;
        rightMagnetGroup.add(sPoleFaceRight);

        // N pole face (right side of right magnet, away from gap)
        const nPoleFaceRight = new THREE.Mesh(poleFaceGeometry, nPoleMaterial.clone());
        nPoleFaceRight.position.x = length / 2;
        rightMagnetGroup.add(nPoleFaceRight);

        // S label - positioned at world coordinates (right magnet's left face)
        // Right magnet is at x = gap/2 + length/2, S pole face is at local x = -length/2
        // So world x = gap/2 + length/2 - length/2 = gap/2
        this.addPoleLabel('S', new THREE.Vector3(gap / 2 - 5, 0, width / 2 + 8), '#6688ff');

        rightMagnetGroup.position.set(gap / 2 + length / 2, 0, 0);
        this.scene.add(rightMagnetGroup);

        this.magnets = { left: leftMagnetGroup, right: rightMagnetGroup };
    }

    addPoleLabel(text, position, color) {
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');

        ctx.fillStyle = color;
        ctx.font = 'bold 48px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, 32, 32);

        const texture = new THREE.CanvasTexture(canvas);
        const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
        const sprite = new THREE.Sprite(material);
        sprite.position.copy(position);
        sprite.scale.set(12, 12, 1);
        this.scene.add(sprite);
    }

    createB0FieldLines() {
        // Proper magnetic field lines:
        // - Exit from N pole of left magnet
        // - Travel through gap (straight-ish in the middle)
        // - Enter S pole of right magnet
        // - Travel through right magnet body
        // - Exit N pole of right magnet (far side)
        // - Curve around externally
        // - Enter S pole of left magnet (far side)
        // - Travel through left magnet body back to N pole

        this.fieldLines = new THREE.Group();

        const gap = this.params.magnetGap;
        const magnetLength = this.params.magnetLength;
        const magnetWidth = this.params.magnetWidth;

        const numLines = 8;

        for (let i = 0; i < numLines; i++) {
            const angle = (i / numLines) * Math.PI * 2;
            const radius = magnetWidth * 0.3;
            const offsetY = Math.cos(angle) * radius * 0.8;
            const offsetZ = Math.sin(angle) * radius * 0.8;

            // Create a complete field line loop
            const points = [];

            // Start at N pole of left magnet
            const nPoleLeftX = -gap / 2;

            // Through the gap (B0 region) - straight lines
            points.push(new THREE.Vector3(nPoleLeftX, offsetY, offsetZ));
            points.push(new THREE.Vector3(-gap / 4, offsetY * 0.9, offsetZ * 0.9));
            points.push(new THREE.Vector3(0, offsetY * 0.85, offsetZ * 0.85));
            points.push(new THREE.Vector3(gap / 4, offsetY * 0.9, offsetZ * 0.9));
            points.push(new THREE.Vector3(gap / 2, offsetY, offsetZ));  // S pole of right magnet

            // Now curve around the outside (external field)
            // Go out from right magnet's N pole (far right side)
            const farRightX = gap / 2 + magnetLength;
            const externalRadius = gap / 2 + magnetLength + 25;

            // Curve around: right side -> top/bottom -> left side
            const numCurvePoints = 12;
            for (let j = 0; j <= numCurvePoints; j++) {
                const t = j / numCurvePoints;
                const curveAngle = Math.PI * t; // 0 to PI (half circle around)

                // The curve goes from right (+x) around to left (-x)
                const curveX = Math.cos(curveAngle) * (gap / 2 + magnetLength / 2 + 15);
                const curveY = offsetY + Math.sin(curveAngle) * (magnetWidth / 2 + 20 + Math.abs(offsetY) * 0.5);
                const curveZ = offsetZ * (1 + Math.sin(curveAngle) * 0.3);

                points.push(new THREE.Vector3(curveX, curveY, curveZ));
            }

            // Close the loop back to starting point
            points.push(new THREE.Vector3(nPoleLeftX, offsetY, offsetZ));

            const curve = new THREE.CatmullRomCurve3(points, true);
            const lineGeometry = new THREE.TubeGeometry(curve, 50, 0.4, 6, true);
            const lineMaterial = new THREE.MeshPhongMaterial({
                color: 0x44ff88,
                transparent: true,
                opacity: 0.5,
                emissive: 0x114422
            });

            const line = new THREE.Mesh(lineGeometry, lineMaterial);
            this.fieldLines.add(line);
        }

        // Add a few lines going the other way (bottom half)
        for (let i = 0; i < numLines; i++) {
            const angle = (i / numLines) * Math.PI * 2;
            const radius = magnetWidth * 0.3;
            const offsetY = Math.cos(angle) * radius * 0.8;
            const offsetZ = Math.sin(angle) * radius * 0.8;

            const points = [];
            const nPoleLeftX = -gap / 2;

            points.push(new THREE.Vector3(nPoleLeftX, offsetY, offsetZ));
            points.push(new THREE.Vector3(0, offsetY * 0.85, offsetZ * 0.85));
            points.push(new THREE.Vector3(gap / 2, offsetY, offsetZ));

            // Bottom curve
            const numCurvePoints = 12;
            for (let j = 0; j <= numCurvePoints; j++) {
                const t = j / numCurvePoints;
                const curveAngle = -Math.PI * t;

                const curveX = Math.cos(curveAngle) * (gap / 2 + magnetLength / 2 + 15);
                const curveY = offsetY + Math.sin(curveAngle) * (magnetWidth / 2 + 20 + Math.abs(offsetY) * 0.5);
                const curveZ = offsetZ * (1 - Math.sin(curveAngle) * 0.3);

                points.push(new THREE.Vector3(curveX, curveY, curveZ));
            }

            points.push(new THREE.Vector3(nPoleLeftX, offsetY, offsetZ));

            const curve = new THREE.CatmullRomCurve3(points, true);
            const lineGeometry = new THREE.TubeGeometry(curve, 50, 0.35, 6, true);
            const lineMaterial = new THREE.MeshPhongMaterial({
                color: 0x44ff88,
                transparent: true,
                opacity: 0.4,
                emissive: 0x114422
            });

            const line = new THREE.Mesh(lineGeometry, lineMaterial);
            this.fieldLines.add(line);
        }

        this.scene.add(this.fieldLines);

        // B0 direction arrow (through the gap)
        this.b0Arrow = this.createDirectionArrow(
            new THREE.Vector3(-gap / 2 - 10, magnetWidth / 2 + 15, 0),
            new THREE.Vector3(1, 0, 0),
            gap + 20,
            0x44ff88,
            'B₀'
        );
    }

    createDirectionArrow(origin, direction, length, color, label) {
        const arrowGroup = new THREE.Group();

        // Shaft
        const shaftGeometry = new THREE.CylinderGeometry(1, 1, length - 10, 8);
        const shaftMaterial = new THREE.MeshPhongMaterial({
            color,
            emissive: new THREE.Color(color).multiplyScalar(0.3)
        });
        const shaft = new THREE.Mesh(shaftGeometry, shaftMaterial);
        shaft.rotation.z = -Math.PI / 2;
        shaft.position.x = (length - 10) / 2;
        arrowGroup.add(shaft);

        // Head
        const headGeometry = new THREE.ConeGeometry(3, 10, 8);
        const head = new THREE.Mesh(headGeometry, shaftMaterial);
        head.rotation.z = -Math.PI / 2;
        head.position.x = length - 5;
        arrowGroup.add(head);

        // Label
        if (label) {
            const canvas = document.createElement('canvas');
            canvas.width = 128;
            canvas.height = 64;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 32px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(label, 64, 32);

            const texture = new THREE.CanvasTexture(canvas);
            const spriteMaterial = new THREE.SpriteMaterial({ map: texture, transparent: true });
            const sprite = new THREE.Sprite(spriteMaterial);
            sprite.position.set(length / 2, 12, 0);
            sprite.scale.set(16, 8, 1);
            arrowGroup.add(sprite);
        }

        arrowGroup.position.copy(origin);
        this.scene.add(arrowGroup);

        return arrowGroup;
    }

    createSolenoidCoil() {
        // Solenoid coil wound around the Y-axis (vertical, around sample tube)
        // When current flows, B1 is along the axis of the solenoid
        // We want B1 perpendicular to B0, so if B0 is along X, coil axis should be along Y or Z
        // Let's make the coil axis along Z (horizontal, perpendicular to B0)
        // Actually, for a saddle coil or Helmholtz pair, B1 is perpendicular to the coil plane

        // In a typical NMR probe:
        // - Sample tube is vertical (Y axis)
        // - RF coil is wound around the sample tube
        // - For a solenoid, B1 would be along the coil axis (Y)
        // - But we need B1 perpendicular to B0 (which is along X)
        // - So if coil axis is Y, B1 is along Y, which is perpendicular to B0 (X) ✓

        // Let's make a proper solenoid with axis along Z (so B1 is along Z, perp to B0 along X)

        const coilDiameter = this.params.coilDiameter;
        const numTurns = this.params.coilTurns;
        const coilLength = this.params.coilLength;
        const wireRadius = 0.8;

        this.coil = new THREE.Group();

        // Create helical solenoid - axis along Z
        const helixPoints = [];
        const totalAngle = numTurns * Math.PI * 2;
        const numSegments = numTurns * 32;

        for (let i = 0; i <= numSegments; i++) {
            const t = i / numSegments;
            const angle = t * totalAngle;

            // Coil wound around Z axis
            // X and Y trace a circle, Z advances linearly
            const x = Math.cos(angle) * coilDiameter / 2;
            const y = Math.sin(angle) * coilDiameter / 2;
            const z = (t - 0.5) * coilLength;

            helixPoints.push(new THREE.Vector3(x, y, z));
        }

        const helixCurve = new THREE.CatmullRomCurve3(helixPoints);
        const coilGeometry = new THREE.TubeGeometry(helixCurve, numSegments * 2, wireRadius, 8, false);

        // Copper material
        const coilMaterial = new THREE.MeshPhongMaterial({
            color: 0xdd8844,
            specular: 0xffaa66,
            shininess: 100,
            emissive: 0x221100
        });

        const coilMesh = new THREE.Mesh(coilGeometry, coilMaterial);
        this.coil.add(coilMesh);

        // Lead wires
        const leadGeometry = new THREE.CylinderGeometry(wireRadius, wireRadius, 20, 8);
        const leadMaterial = coilMaterial.clone();

        const lead1 = new THREE.Mesh(leadGeometry, leadMaterial);
        lead1.position.set(coilDiameter / 2, -10, -coilLength / 2);
        this.coil.add(lead1);

        const lead2 = new THREE.Mesh(leadGeometry, leadMaterial);
        lead2.position.set(coilDiameter / 2, -10, coilLength / 2);
        this.coil.add(lead2);

        // B1 arrow - along Z axis (the axis of the solenoid)
        this.b1Arrow = this.createB1Arrow();
        this.coil.add(this.b1Arrow);

        this.scene.add(this.coil);
    }

    createB1Arrow() {
        const arrowGroup = new THREE.Group();
        const length = 25;

        const shaftGeometry = new THREE.CylinderGeometry(0.8, 0.8, length - 6, 8);
        const shaftMaterial = new THREE.MeshPhongMaterial({
            color: 0xff8844,
            emissive: 0x442211
        });
        const shaft = new THREE.Mesh(shaftGeometry, shaftMaterial);
        shaft.rotation.x = Math.PI / 2;
        shaft.position.z = (length - 6) / 2 + this.params.coilLength / 2 + 3;
        arrowGroup.add(shaft);

        const headGeometry = new THREE.ConeGeometry(2, 6, 8);
        const head = new THREE.Mesh(headGeometry, shaftMaterial);
        head.rotation.x = Math.PI / 2;
        head.position.z = length + this.params.coilLength / 2;
        arrowGroup.add(head);

        // Label
        const canvas = document.createElement('canvas');
        canvas.width = 128;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ff8844';
        ctx.font = 'bold 32px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('B₁', 64, 32);

        const texture = new THREE.CanvasTexture(canvas);
        const spriteMaterial = new THREE.SpriteMaterial({ map: texture, transparent: true });
        const sprite = new THREE.Sprite(spriteMaterial);
        sprite.position.set(0, 8, length + this.params.coilLength / 2);
        sprite.scale.set(14, 7, 1);
        arrowGroup.add(sprite);

        return arrowGroup;
    }

    createSample() {
        const tubeRadius = this.params.sampleDiameter / 2;
        const tubeHeight = this.params.sampleHeight;
        const glassThickness = 0.5;

        this.sample = new THREE.Group();

        // Glass tube
        const glassGeometry = new THREE.CylinderGeometry(
            tubeRadius + glassThickness,
            tubeRadius + glassThickness,
            tubeHeight,
            32, 1, true
        );
        const glassMaterial = new THREE.MeshPhongMaterial({
            color: 0xaaccff,
            transparent: true,
            opacity: 0.3,
            shininess: 100,
            side: THREE.DoubleSide
        });
        const glassTube = new THREE.Mesh(glassGeometry, glassMaterial);
        this.sample.add(glassTube);

        // Liquid sample
        const liquidGeometry = new THREE.CylinderGeometry(tubeRadius, tubeRadius, tubeHeight * 0.75, 32);
        const liquidMaterial = new THREE.MeshPhongMaterial({
            color: 0x4488ff,
            transparent: true,
            opacity: 0.7,
            emissive: 0x112244
        });
        this.sampleLiquid = new THREE.Mesh(liquidGeometry, liquidMaterial);
        this.sample.add(this.sampleLiquid);

        // Bottom cap
        const capGeometry = new THREE.CircleGeometry(tubeRadius + glassThickness, 32);
        const capMaterial = new THREE.MeshPhongMaterial({
            color: 0xaaccff,
            transparent: true,
            opacity: 0.5,
            side: THREE.DoubleSide
        });
        const bottomCap = new THREE.Mesh(capGeometry, capMaterial);
        bottomCap.rotation.x = -Math.PI / 2;
        bottomCap.position.y = -tubeHeight / 2;
        this.sample.add(bottomCap);

        // Rotate sample tube to be horizontal along Z (inside the coil)
        this.sample.rotation.x = Math.PI / 2;

        this.scene.add(this.sample);
    }



    createAxisLabels() {
        const createLabel = (text, position, color = '#ffffff') => {
            const canvas = document.createElement('canvas');
            canvas.width = 128;
            canvas.height = 64;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = color;
            ctx.font = 'bold 24px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(text, 64, 32);

            const texture = new THREE.CanvasTexture(canvas);
            const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
            const sprite = new THREE.Sprite(material);
            sprite.position.copy(position);
            sprite.scale.set(12, 6, 1);
            this.scene.add(sprite);
        };

        createLabel('X (B₀)', new THREE.Vector3(70, -this.params.magnetWidth / 2 + 5, 0), '#44ff88');
        createLabel('Y', new THREE.Vector3(0, this.params.magnetWidth / 2 + 20, 0), '#ffffff');
        createLabel('Z (B₁)', new THREE.Vector3(0, -this.params.magnetWidth / 2 + 5, 55), '#ff8844');
    }

    setupControls() {
        let isDragging = false;
        let previousMousePosition = { x: 0, y: 0 };

        this.orbitAngle = { theta: 0, phi: Math.PI / 12 };
        this.orbitRadius = 180;

        const updateCamera = () => {
            this.camera.position.x = this.orbitRadius * Math.sin(this.orbitAngle.theta) * Math.cos(this.orbitAngle.phi);
            this.camera.position.y = this.orbitRadius * Math.sin(this.orbitAngle.phi);
            this.camera.position.z = this.orbitRadius * Math.cos(this.orbitAngle.theta) * Math.cos(this.orbitAngle.phi);
            this.camera.lookAt(0, 0, 0);
        };

        this.renderer.domElement.addEventListener('mousedown', (e) => {
            isDragging = true;
            previousMousePosition = { x: e.clientX, y: e.clientY };
        });

        this.renderer.domElement.addEventListener('mousemove', (e) => {
            if (!isDragging) return;

            const deltaX = e.clientX - previousMousePosition.x;
            const deltaY = e.clientY - previousMousePosition.y;

            this.orbitAngle.theta -= deltaX * 0.01;
            this.orbitAngle.phi = Math.max(-Math.PI / 2.5, Math.min(Math.PI / 2.5, this.orbitAngle.phi + deltaY * 0.01));

            updateCamera();
            previousMousePosition = { x: e.clientX, y: e.clientY };
        });

        this.renderer.domElement.addEventListener('mouseup', () => isDragging = false);
        this.renderer.domElement.addEventListener('mouseleave', () => isDragging = false);

        this.renderer.domElement.addEventListener('wheel', (e) => {
            e.preventDefault();
            this.orbitRadius = Math.max(80, Math.min(250, this.orbitRadius + e.deltaY * 0.1));
            updateCamera();
        });

        // Touch support
        let touchStartDistance = 0;

        this.renderer.domElement.addEventListener('touchstart', (e) => {
            if (e.touches.length === 1) {
                isDragging = true;
                previousMousePosition = { x: e.touches[0].clientX, y: e.touches[0].clientY };
            } else if (e.touches.length === 2) {
                const dx = e.touches[0].clientX - e.touches[1].clientX;
                const dy = e.touches[0].clientY - e.touches[1].clientY;
                touchStartDistance = Math.sqrt(dx * dx + dy * dy);
            }
        });

        this.renderer.domElement.addEventListener('touchmove', (e) => {
            e.preventDefault();
            if (e.touches.length === 1 && isDragging) {
                const deltaX = e.touches[0].clientX - previousMousePosition.x;
                const deltaY = e.touches[0].clientY - previousMousePosition.y;

                this.orbitAngle.theta -= deltaX * 0.01;
                this.orbitAngle.phi = Math.max(-Math.PI / 2.5, Math.min(Math.PI / 2.5, this.orbitAngle.phi + deltaY * 0.01));

                updateCamera();
                previousMousePosition = { x: e.touches[0].clientX, y: e.touches[0].clientY };
            } else if (e.touches.length === 2) {
                const dx = e.touches[0].clientX - e.touches[1].clientX;
                const dy = e.touches[0].clientY - e.touches[1].clientY;
                const distance = Math.sqrt(dx * dx + dy * dy);
                const scale = touchStartDistance / distance;
                this.orbitRadius = Math.max(80, Math.min(250, this.orbitRadius * scale));
                touchStartDistance = distance;
                updateCamera();
            }
        });

        this.renderer.domElement.addEventListener('touchend', () => isDragging = false);

        updateCamera();
    }

    animate() {
        requestAnimationFrame(() => this.animate());

        this.animationPhase += 0.02;

        // Animate field lines
        if (this.fieldLines) {
            this.fieldLines.children.forEach((line, i) => {
                const phase = this.animationPhase + i * 0.2;
                line.material.opacity = 0.3 + 0.25 * Math.sin(phase);
            });
        }

        // Animate during experiment
        if (this.experimentRunning) {
            // B1 arrow oscillation
            if (this.b1Arrow) {
                const scale = 1 + 0.3 * Math.sin(this.animationPhase * 8);
                this.b1Arrow.scale.set(1, 1, scale);
            }

            // Sample glow
            if (this.sampleLiquid) {
                const glow = 0.3 + 0.3 * Math.sin(this.animationPhase * 4);
                this.sampleLiquid.material.emissive.setRGB(glow * 0.3, glow * 0.5, glow);
            }
        } else {
            if (this.b1Arrow) {
                this.b1Arrow.scale.set(1, 1, 1);
            }
            if (this.sampleLiquid) {
                this.sampleLiquid.material.emissive.setRGB(0.07, 0.1, 0.15);
            }
        }

        this.renderer.render(this.scene, this.camera);
    }

    startExperimentAnimation() {
        this.experimentRunning = true;
    }

    stopExperimentAnimation() {
        this.experimentRunning = false;
    }

    updateParameters(params) {
        const needsMagnetRebuild = params.magnetGap !== undefined && params.magnetGap !== this.params.magnetGap;
        const needsCoilRebuild = params.coilDiameter !== undefined && params.coilDiameter !== this.params.coilDiameter;
        const needsSampleRebuild = params.sampleDiameter !== undefined && params.sampleDiameter !== this.params.sampleDiameter;

        Object.assign(this.params, params);

        if (needsMagnetRebuild) {
            this.rebuildMagnets();
        }

        if (needsCoilRebuild) {
            this.rebuildCoil();
        }

        if (needsSampleRebuild) {
            this.rebuildSample();
        }
    }

    rebuildMagnets() {
        // Remove old magnets and field lines
        if (this.magnets) {
            this.scene.remove(this.magnets.left);
            this.scene.remove(this.magnets.right);
        }
        if (this.fieldLines) {
            this.scene.remove(this.fieldLines);
        }
        if (this.b0Arrow) {
            this.scene.remove(this.b0Arrow);
        }

        // Remove old pole labels (sprites)
        const spritesToRemove = [];
        this.scene.traverse((child) => {
            if (child.isSprite && child.material.map) {
                spritesToRemove.push(child);
            }
        });
        spritesToRemove.forEach(sprite => this.scene.remove(sprite));

        // Recreate
        this.createBarMagnets();
        this.createB0FieldLines();
        this.createAxisLabels();
    }

    rebuildCoil() {
        if (this.coil) {
            this.scene.remove(this.coil);
        }
        this.createSolenoidCoil();
    }

    rebuildSample() {
        if (this.sample) {
            this.scene.remove(this.sample);
        }
        this.createSample();
    }

    onWindowResize() {
        const width = this.container.clientWidth;
        const height = this.container.clientHeight;

        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
    }

    dispose() {
        if (this.renderer) {
            this.renderer.dispose();
        }
    }
}

// Export
window.SpectrometerVisualization = SpectrometerVisualization;
