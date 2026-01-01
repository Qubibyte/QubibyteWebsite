// Qubit State Visualization with 3D Bloch Spheres

class QubitVisualizer {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.settings = { precision: 2, hideNegligibles: true, sortBy: 'probability', sortOrder: 'desc' };
        this.selectedQubit = 0;
        this.blochScene = null;
        this.blochCamera = null;
        this.blochRenderer = null;
        this.stateArrow = null;
        this.animationId = null;
        this.isDragging = false;
        this.previousMousePosition = { x: 0, y: 0 };
        this.sphereGroup = null;
        
        if (!this.container) {
            console.warn(`QubitVisualizer: Container ${containerId} not found`);
        }
    }

    setSettings(settings) {
        this.settings = { ...this.settings, ...settings };
    }

    updateVisualization(quantumState, settings = null) {
        if (settings) this.setSettings(settings);
        if (!quantumState || !this.container) return;
        
        this.quantumState = quantumState;
        this.container.innerHTML = '';
        
        // Tabs container with scrollable tabs and arrow buttons
        const tabsWrapper = document.createElement('div');
        tabsWrapper.className = 'viz-tabs-scrollable-wrapper';
        
        // Left arrow button
        const leftArrow = document.createElement('button');
        leftArrow.className = 'viz-tabs-arrow viz-tabs-arrow-left';
        leftArrow.innerHTML = '‹';
        leftArrow.style.display = 'none'; // Hidden by default
        leftArrow.addEventListener('click', () => this.scrollTabs(tabsContainer, -100));
        tabsWrapper.appendChild(leftArrow);
        
        // Scrollable tabs container
        const tabsContainer = document.createElement('div');
        tabsContainer.className = 'viz-tabs-scrollable';
        
        for (let i = 0; i < quantumState.numQubits; i++) {
            const tab = document.createElement('button');
            tab.className = `viz-tab-btn ${i === this.selectedQubit ? 'active' : ''}`;
            tab.textContent = `Q${i}`;
            tab.style.flex = '0 0 auto'; // Don't flex, use auto width
            tab.addEventListener('click', () => this.selectQubit(i));
            tabsContainer.appendChild(tab);
        }
        
        tabsWrapper.appendChild(tabsContainer);
        
        // Right arrow button
        const rightArrow = document.createElement('button');
        rightArrow.className = 'viz-tabs-arrow viz-tabs-arrow-right';
        rightArrow.innerHTML = '›';
        rightArrow.addEventListener('click', () => this.scrollTabs(tabsContainer, 100));
        tabsWrapper.appendChild(rightArrow);
        
        // Store references for scroll management
        this.tabsContainer = tabsContainer;
        this.leftArrow = leftArrow;
        this.rightArrow = rightArrow;
        
        // Check if scrolling is needed and update arrow visibility
        setTimeout(() => this.updateTabArrows(), 0);
        
        // Update arrows on resize
        const resizeObserver = new ResizeObserver(() => this.updateTabArrows());
        resizeObserver.observe(tabsContainer);
        
        // Update arrows on scroll
        tabsContainer.addEventListener('scroll', () => this.updateTabArrows());
        
        this.container.appendChild(tabsWrapper);
        
        // Panel container (exactly like viz-panel structure)
        const panel = document.createElement('div');
        panel.className = 'viz-panel active';
        panel.id = 'qubitTabContent';
        
        this.container.appendChild(panel);
        
        // Ensure selected qubit is valid
        if (this.selectedQubit >= quantumState.numQubits) {
            this.selectedQubit = 0;
        }
        
        // Render the selected qubit
        this.renderQubitContent(this.selectedQubit, quantumState);
    }

    selectQubit(index) {
        this.selectedQubit = index;
        
        // Update tab active states
        const tabs = this.container.querySelectorAll('.viz-tab-btn');
        tabs.forEach((tab, i) => {
            tab.classList.toggle('active', i === index);
        });
        
        // Scroll selected tab into view
        if (tabs[index] && this.tabsContainer) {
            tabs[index].scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        }
        
        // Re-render content
        if (this.quantumState) {
            this.renderQubitContent(index, this.quantumState);
        }
    }
    
    scrollTabs(container, delta) {
        if (!container) return;
        container.scrollBy({ left: delta, behavior: 'smooth' });
    }
    
    updateTabArrows() {
        if (!this.tabsContainer || !this.leftArrow || !this.rightArrow) return;
        
        const container = this.tabsContainer;
        const scrollLeft = container.scrollLeft;
        const scrollWidth = container.scrollWidth;
        const clientWidth = container.clientWidth;
        
        // Show left arrow if scrolled right
        this.leftArrow.style.display = scrollLeft > 0 ? 'flex' : 'none';
        
        // Show right arrow if can scroll right
        this.rightArrow.style.display = scrollLeft < (scrollWidth - clientWidth - 1) ? 'flex' : 'none';
    }

    renderQubitContent(qubitIndex, quantumState) {
        const contentArea = document.getElementById('qubitTabContent');
        if (!contentArea) return;
        
        // Clean up previous Three.js instance
        this.cleanup3D();
        
        contentArea.innerHTML = '';
        
        const precision = this.settings.precision;
        
        // 3D Bloch Sphere Container (first - most important)
        const blochContainer = document.createElement('div');
        blochContainer.className = 'bloch-sphere-3d-container';
        blochContainer.id = 'blochSphere3D';
        blochContainer.style.cssText = 'flex: 2; min-height: 250px; width: 100%; position: relative;';
        
        // Maximize button - positioned relative to bloch container
        const maximizeBtn = document.createElement('button');
        maximizeBtn.className = 'btn btn-small';
        maximizeBtn.style.cssText = 'position: absolute; top: 0.5rem; right: 0.5rem; z-index: 10; padding: 0.25rem 0.5rem; font-size: 0.75rem;';
        maximizeBtn.innerHTML = '⛶';
        maximizeBtn.title = 'Maximize';
        maximizeBtn.addEventListener('click', () => this.showMaximizedBloch(qubitIndex, quantumState));
        blochContainer.appendChild(maximizeBtn);
        
        contentArea.appendChild(blochContainer);
        
        // Probabilities and state summary (below sphere)
        const bottomSection = document.createElement('div');
        bottomSection.style.cssText = 'margin-top: 0.5rem; padding: 0 1rem 1rem 1rem;';
        
        // Probabilities
        const prob0 = quantumState.getProbability(qubitIndex, 0) || 0;
        const prob1 = quantumState.getProbability(qubitIndex, 1) || 0;
        
        const probContainer = document.createElement('div');
        probContainer.className = 'state-probabilities';
        probContainer.style.cssText = 'margin-bottom: 0.5rem;';
        
        const prob0Bar = this.createProbabilityBar('|0⟩', prob0);
        const prob1Bar = this.createProbabilityBar('|1⟩', prob1);
        
        probContainer.appendChild(prob0Bar);
        probContainer.appendChild(prob1Bar);
        bottomSection.appendChild(probContainer);
        
        // State summary
        const stateSummary = document.createElement('div');
        stateSummary.className = 'state-summary';
        stateSummary.style.cssText = 'font-size: 0.75rem; margin: 0; padding: 0.5rem;';
        if (prob0 > 0.99) {
            stateSummary.textContent = 'State: |0⟩ (Classical)';
        } else if (prob1 > 0.99) {
            stateSummary.textContent = 'State: |1⟩ (Classical)';
        } else if (Math.abs(prob0 - prob1) < 0.01) {
            stateSummary.textContent = 'State: Superposition (Equal)';
        } else {
            stateSummary.textContent = `State: Superposition (${(prob0*100).toFixed(precision)}% |0⟩, ${(prob1*100).toFixed(precision)}% |1⟩)`;
        }
        bottomSection.appendChild(stateSummary);
        
        // Bloch sphere labels
        const labelsDiv = document.createElement('div');
        labelsDiv.className = 'bloch-labels';
        labelsDiv.style.cssText = 'font-size: 0.65rem; margin-top: 0.25rem;';
        labelsDiv.innerHTML = `
            <span class="bloch-label-info">Drag to rotate • Scroll to zoom</span>
        `;
        bottomSection.appendChild(labelsDiv);
        
        contentArea.appendChild(bottomSection);
        
        // Initialize 3D Bloch sphere
        const coords = quantumState.getBlochCoordinates(qubitIndex);
        this.init3DBlochSphere(blochContainer, coords);
    }
    
    showMaximizedBloch(qubitIndex, quantumState) {
        // Create modal for maximized bloch sphere
        const modal = document.createElement('div');
        modal.className = 'bloch-maximize-modal';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.8);
            z-index: 10000;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 2rem;
        `;
        
        const content = document.createElement('div');
        content.style.cssText = `
            background: var(--surface);
            border: 1px solid var(--border-color);
            border-radius: 0.75rem;
            padding: 2rem;
            max-width: 90vw;
            max-height: 90vh;
            overflow: auto;
            position: relative;
            display: flex;
            flex-direction: column;
        `;
        
        const closeBtn = document.createElement('button');
        closeBtn.className = 'btn btn-small';
        closeBtn.style.cssText = 'position: absolute; top: 1rem; right: 1rem; z-index: 10;';
        closeBtn.textContent = '✕';
        closeBtn.addEventListener('click', () => {
            // Clean up Three.js before removing
            if (this.maximizedBlochRenderer) {
                this.maximizedBlochRenderer.dispose();
            }
            modal.remove();
        });
        
        const blochContainer = document.createElement('div');
        blochContainer.className = 'bloch-sphere-3d-container';
        blochContainer.id = 'blochSphere3DMaximized';
        blochContainer.style.cssText = 'width: 600px; height: 600px; min-width: 400px; min-height: 400px;';
        
        content.appendChild(closeBtn);
        content.appendChild(blochContainer);
        modal.appendChild(content);
        document.body.appendChild(modal);
        
        // Initialize 3D Bloch sphere in modal
        const coords = quantumState.getBlochCoordinates(qubitIndex);
        this.init3DBlochSphereMaximized(blochContainer, coords);
        
        // Close on escape key
        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                if (this.maximizedBlochRenderer) {
                    this.maximizedBlochRenderer.dispose();
                }
                modal.remove();
                document.removeEventListener('keydown', handleEscape);
            }
        };
        document.addEventListener('keydown', handleEscape);
    }
    
    init3DBlochSphereMaximized(container, coords) {
        const width = container.clientWidth || 600;
        const height = container.clientHeight || 600;
        
        // Scene
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x0f172a);
        
        // Camera
        const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
        camera.position.set(2.7, 2.0, 2.7);
        camera.lookAt(0, 0, 0);
        
        // Renderer
        this.maximizedBlochRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        this.maximizedBlochRenderer.setSize(width, height);
        this.maximizedBlochRenderer.setPixelRatio(window.devicePixelRatio);
        container.appendChild(this.maximizedBlochRenderer.domElement);
        
        // Create sphere group
        const sphereGroup = new THREE.Group();
        scene.add(sphereGroup);
        
        // Create transparent sphere
        const sphereGeometry = new THREE.SphereGeometry(1, 32, 32);
        const sphereMaterial = new THREE.MeshBasicMaterial({
            color: 0x6366f1,
            transparent: true,
            opacity: 0.15,
            wireframe: false
        });
        const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
        sphereGroup.add(sphere);
        
        // Wireframe sphere
        const wireframeMaterial = new THREE.MeshBasicMaterial({
            color: 0x6366f1,
            wireframe: true,
            transparent: true,
            opacity: 0.3
        });
        const wireframeSphere = new THREE.Mesh(sphereGeometry, wireframeMaterial);
        sphereGroup.add(wireframeSphere);
        
        // Store references for cleanup and reuse existing methods
        this.maximizedBlochScene = scene;
        this.maximizedBlochCamera = camera;
        const originalSphereGroup = this.sphereGroup;
        const originalBlochScene = this.blochScene;
        
        // Temporarily set sphereGroup and scene to use existing methods
        this.sphereGroup = sphereGroup;
        this.blochScene = scene;
        
        // Add axes, equator, meridians, state arrow using existing methods
        this.createAxes();
        this.createEquator();
        this.createMeridians();
        this.createStateArrow(coords);
        this.createAxisLabels();
        
        // Restore original references
        this.sphereGroup = originalSphereGroup;
        this.blochScene = originalBlochScene;
        
        // Lighting
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        scene.add(ambientLight);
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.4);
        directionalLight.position.set(5, 5, 5);
        scene.add(directionalLight);
        
        // Animation loop
        const animate = () => {
            requestAnimationFrame(animate);
            this.maximizedBlochRenderer.render(scene, camera);
        };
        animate();
        
        // Mouse controls
        let isDragging = false;
        let previousMousePosition = { x: 0, y: 0 };
        
        container.addEventListener('mousedown', (e) => {
            isDragging = true;
            previousMousePosition = { x: e.clientX, y: e.clientY };
        });
        
        container.addEventListener('mousemove', (e) => {
            if (isDragging) {
                const deltaX = e.clientX - previousMousePosition.x;
                const deltaY = e.clientY - previousMousePosition.y;
                sphereGroup.rotation.y += deltaX * 0.01;
                sphereGroup.rotation.x += deltaY * 0.01;
                previousMousePosition = { x: e.clientX, y: e.clientY };
            }
        });
        
        container.addEventListener('mouseup', () => {
            isDragging = false;
        });
        
        container.addEventListener('wheel', (e) => {
            e.preventDefault();
            const delta = e.deltaY * 0.01;
            camera.position.multiplyScalar(1 + delta);
        });
    }

    init3DBlochSphere(container, coords) {
        // Make bloch sphere bigger - use more of the available space
        const width = container.clientWidth || 300;
        const height = container.clientHeight || Math.max(250, Math.min(width, 300));
        
        // Scene
        this.blochScene = new THREE.Scene();
        this.blochScene.background = new THREE.Color(0x0f172a);
        
        // Camera - positioned to look into the |+⟩ and |i⟩ corner
        // With |+⟩ on the left and |i⟩ on the right when |0⟩ is at top
        this.blochCamera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
        this.blochCamera.position.set(2.7, 2.0, 2.7);
        this.blochCamera.lookAt(0, 0, 0);
        
        // Renderer
        this.blochRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        this.blochRenderer.setSize(width, height);
        this.blochRenderer.setPixelRatio(window.devicePixelRatio);
        container.appendChild(this.blochRenderer.domElement);
        
        // Create a group to hold the sphere and decorations for rotation
        this.sphereGroup = new THREE.Group();
        this.blochScene.add(this.sphereGroup);
        
        // Create transparent sphere
        const sphereGeometry = new THREE.SphereGeometry(1, 32, 32);
        const sphereMaterial = new THREE.MeshBasicMaterial({
            color: 0x6366f1,
            transparent: true,
            opacity: 0.15,
            wireframe: false
        });
        const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
        this.sphereGroup.add(sphere);
        
        // Wireframe sphere
        const wireframeMaterial = new THREE.MeshBasicMaterial({
            color: 0x6366f1,
            wireframe: true,
            transparent: true,
            opacity: 0.3
        });
        const wireframeSphere = new THREE.Mesh(sphereGeometry, wireframeMaterial);
        this.sphereGroup.add(wireframeSphere);
        
        // Axes
        this.createAxes();
        
        // Equator circle
        this.createEquator();
        
        // Prime meridian circles
        this.createMeridians();
        
        // State vector arrow
        this.createStateArrow(coords);
        
        // Axis labels (as sprites)
        this.createAxisLabels();
        
        // Lighting
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.blochScene.add(ambientLight);
        
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.4);
        directionalLight.position.set(5, 5, 5);
        this.blochScene.add(directionalLight);
        
        // Mouse interaction
        this.setupMouseControls(container);
        
        // Animation loop
        this.animate();
    }

    createAxes() {
        const axisLength = 1.3;
        // Color coding: Red for X-basis (|+⟩/|−⟩), Green for Y-basis (|i⟩/|−i⟩), Blue for Z-basis (|0⟩/|1⟩)
        const axisColors = {
            xBasis: 0xef4444, // Red - |+⟩/|−⟩ axis (Bloch X → Three.js Z)
            yBasis: 0x22c55e, // Green - |i⟩/|−i⟩ axis (Bloch Y → Three.js X)
            zBasis: 0x3b82f6  // Blue - |0⟩/|1⟩ axis (Bloch Z → Three.js Y)
        };
        
        // |i⟩/|−i⟩ axis (Bloch Y → Three.js X)
        const yBasisGeometry = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(-axisLength, 0, 0),
            new THREE.Vector3(axisLength, 0, 0)
        ]);
        const yBasisMaterial = new THREE.LineBasicMaterial({ color: axisColors.yBasis, linewidth: 2 });
        const yBasisAxis = new THREE.Line(yBasisGeometry, yBasisMaterial);
        this.sphereGroup.add(yBasisAxis);
        
        // |0⟩/|1⟩ axis (Bloch Z → Three.js Y)
        const zBasisGeometry = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(0, -axisLength, 0),
            new THREE.Vector3(0, axisLength, 0)
        ]);
        const zBasisMaterial = new THREE.LineBasicMaterial({ color: axisColors.zBasis, linewidth: 2 });
        const zBasisAxis = new THREE.Line(zBasisGeometry, zBasisMaterial);
        this.sphereGroup.add(zBasisAxis);
        
        // |+⟩/|−⟩ axis (Bloch X → Three.js Z)
        const xBasisGeometry = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(0, 0, -axisLength),
            new THREE.Vector3(0, 0, axisLength)
        ]);
        const xBasisMaterial = new THREE.LineBasicMaterial({ color: axisColors.xBasis, linewidth: 2 });
        const xBasisAxis = new THREE.Line(xBasisGeometry, xBasisMaterial);
        this.sphereGroup.add(xBasisAxis);
    }

    createEquator() {
        const points = [];
        for (let i = 0; i <= 64; i++) {
            const angle = (i / 64) * Math.PI * 2;
            points.push(new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle)));
        }
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const material = new THREE.LineBasicMaterial({ color: 0x64748b, transparent: true, opacity: 0.5 });
        const equator = new THREE.Line(geometry, material);
        this.sphereGroup.add(equator);
    }

    createMeridians() {
        // XY plane meridian
        const points1 = [];
        for (let i = 0; i <= 64; i++) {
            const angle = (i / 64) * Math.PI * 2;
            points1.push(new THREE.Vector3(Math.cos(angle), Math.sin(angle), 0));
        }
        const geometry1 = new THREE.BufferGeometry().setFromPoints(points1);
        const material = new THREE.LineBasicMaterial({ color: 0x64748b, transparent: true, opacity: 0.3 });
        const meridian1 = new THREE.Line(geometry1, material);
        this.sphereGroup.add(meridian1);
        
        // XZ plane meridian
        const points2 = [];
        for (let i = 0; i <= 64; i++) {
            const angle = (i / 64) * Math.PI * 2;
            points2.push(new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle)));
        }
        const geometry2 = new THREE.BufferGeometry().setFromPoints(points2);
        const meridian2 = new THREE.Line(geometry2, material);
        this.sphereGroup.add(meridian2);
    }

    createStateArrow(coords) {
        // State arrow as a cylinder + cone
        // Mapping: Bloch X → Three.js Z, Bloch Y → Three.js X, Bloch Z → Three.js Y
        const arrowGroup = new THREE.Group();
        
        // Convert Bloch coordinates to Three.js coordinates
        const threeX = coords.y;  // Bloch Y → Three.js X (|i⟩/|−i⟩ direction)
        const threeY = coords.z;  // Bloch Z → Three.js Y (up, |0⟩/|1⟩ direction)
        const threeZ = coords.x;  // Bloch X → Three.js Z (|+⟩/|−⟩ direction)
        
        const length = Math.sqrt(threeX*threeX + threeY*threeY + threeZ*threeZ);
        const dir = new THREE.Vector3(threeX, threeY, threeZ).normalize();
        
        // Arrow shaft (cylinder - WebGL ignores line width so we use geometry)
        if (length > 0.01) {
            const shaftLength = length * 0.85; // Leave room for cone
            const shaftGeometry = new THREE.CylinderGeometry(0.025, 0.025, shaftLength, 8);
            const shaftMaterial = new THREE.MeshBasicMaterial({ color: 0xf59e0b });
            const shaft = new THREE.Mesh(shaftGeometry, shaftMaterial);
            
            // Position at midpoint of shaft
            shaft.position.set(
                dir.x * shaftLength / 2,
                dir.y * shaftLength / 2,
                dir.z * shaftLength / 2
            );
            
            // Rotate cylinder to point in direction
            const up = new THREE.Vector3(0, 1, 0);
            const quaternion = new THREE.Quaternion();
            quaternion.setFromUnitVectors(up, dir);
            shaft.setRotationFromQuaternion(quaternion);
            
            arrowGroup.add(shaft);
        }
        
        // Arrow head (cone)
        const coneGeometry = new THREE.ConeGeometry(0.08, 0.2, 12);
        const coneMaterial = new THREE.MeshBasicMaterial({ color: 0xf59e0b });
        const cone = new THREE.Mesh(coneGeometry, coneMaterial);
        
        // Position cone at the tip
        cone.position.set(threeX, threeY, threeZ);
        
        // Orient cone to point outward
        if (length > 0.01) {
            const up = new THREE.Vector3(0, 1, 0);
            const quaternion = new THREE.Quaternion();
            quaternion.setFromUnitVectors(up, dir);
            cone.setRotationFromQuaternion(quaternion);
        }
        
        arrowGroup.add(cone);
        
        // State point (larger sphere at the tip)
        const pointGeometry = new THREE.SphereGeometry(0.06, 16, 16);
        const pointMaterial = new THREE.MeshBasicMaterial({ color: 0xfbbf24 });
        const point = new THREE.Mesh(pointGeometry, pointMaterial);
        point.position.set(threeX, threeY, threeZ);
        arrowGroup.add(point);
        
        // Glow effect
        const glowGeometry = new THREE.SphereGeometry(0.1, 16, 16);
        const glowMaterial = new THREE.MeshBasicMaterial({ 
            color: 0xfbbf24, 
            transparent: true, 
            opacity: 0.4 
        });
        const glow = new THREE.Mesh(glowGeometry, glowMaterial);
        glow.position.set(threeX, threeY, threeZ);
        arrowGroup.add(glow);
        
        this.stateArrow = arrowGroup;
        this.sphereGroup.add(arrowGroup);
    }

    createAxisLabels() {
        // Standard Bloch sphere labels:
        // |0⟩ = north pole (Bloch +Z), |1⟩ = south pole (Bloch -Z)
        // |+⟩ = +X eigenstate, |−⟩ = -X eigenstate  
        // |i⟩ = +Y eigenstate, |−i⟩ = -Y eigenstate
        // Mapping: Bloch X → Three.js Z, Bloch Y → Three.js X, Bloch Z → Three.js Y
        // This puts |+⟩ on the left and |i⟩ on the right when viewed from camera at (+X, +Y, +Z)
        const labels = [
            { text: '|0⟩', pos: [0, 1.5, 0], color: '#3b82f6' },
            { text: '|1⟩', pos: [0, -1.5, 0], color: '#3b82f6' },
            { text: '|+⟩', pos: [0, 0, 1.5], color: '#ef4444' },   // Bloch +X → Three.js +Z
            { text: '|−⟩', pos: [0, 0, -1.5], color: '#ef4444' },  // Bloch -X → Three.js -Z
            { text: '|i⟩', pos: [1.5, 0, 0], color: '#22c55e' },   // Bloch +Y → Three.js +X
            { text: '|−i⟩', pos: [-1.5, 0, 0], color: '#22c55e' }  // Bloch -Y → Three.js -X
        ];
        
        labels.forEach(label => {
            const sprite = this.createTextSprite(label.text, label.color);
            sprite.position.set(label.pos[0], label.pos[1], label.pos[2]);
            this.sphereGroup.add(sprite);
        });
    }

    createTextSprite(text, color) {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = 256;
        canvas.height = 128;
        
        context.font = 'Bold 72px Arial';
        context.fillStyle = color;
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText(text, 128, 64);
        
        const texture = new THREE.CanvasTexture(canvas);
        const spriteMaterial = new THREE.SpriteMaterial({ 
            map: texture,
            transparent: true
        });
        const sprite = new THREE.Sprite(spriteMaterial);
        sprite.scale.set(0.7, 0.35, 1);
        
        return sprite;
    }

    setupMouseControls(container) {
        const canvas = this.blochRenderer.domElement;
        
        canvas.addEventListener('mousedown', (e) => {
            this.isDragging = true;
            this.previousMousePosition = { x: e.clientX, y: e.clientY };
        });
        
        canvas.addEventListener('mousemove', (e) => {
            if (!this.isDragging) return;
            
            const deltaX = e.clientX - this.previousMousePosition.x;
            const deltaY = e.clientY - this.previousMousePosition.y;
            
            // Rotate the sphere group
            this.sphereGroup.rotation.y += deltaX * 0.01;
            this.sphereGroup.rotation.x += deltaY * 0.01;
            
            this.previousMousePosition = { x: e.clientX, y: e.clientY };
        });
        
        canvas.addEventListener('mouseup', () => {
            this.isDragging = false;
        });
        
        canvas.addEventListener('mouseleave', () => {
            this.isDragging = false;
        });
        
        // Zoom with scroll wheel
        canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            const zoomSpeed = 0.1;
            const direction = e.deltaY > 0 ? 1 : -1;
            
            this.blochCamera.position.multiplyScalar(1 + direction * zoomSpeed);
            
            // Clamp zoom
            const distance = this.blochCamera.position.length();
            if (distance < 2) {
                this.blochCamera.position.normalize().multiplyScalar(2);
            } else if (distance > 10) {
                this.blochCamera.position.normalize().multiplyScalar(10);
            }
        });
        
        // Touch support
        canvas.addEventListener('touchstart', (e) => {
            if (e.touches.length === 1) {
                this.isDragging = true;
                this.previousMousePosition = { x: e.touches[0].clientX, y: e.touches[0].clientY };
            }
        });
        
        canvas.addEventListener('touchmove', (e) => {
            if (!this.isDragging || e.touches.length !== 1) return;
            e.preventDefault();
            
            const deltaX = e.touches[0].clientX - this.previousMousePosition.x;
            const deltaY = e.touches[0].clientY - this.previousMousePosition.y;
            
            this.sphereGroup.rotation.y += deltaX * 0.01;
            this.sphereGroup.rotation.x += deltaY * 0.01;
            
            this.previousMousePosition = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        });
        
        canvas.addEventListener('touchend', () => {
            this.isDragging = false;
        });
    }

    animate() {
        this.animationId = requestAnimationFrame(() => this.animate());
        
        if (this.blochRenderer && this.blochScene && this.blochCamera) {
            this.blochRenderer.render(this.blochScene, this.blochCamera);
        }
    }

    cleanup3D() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
        
        if (this.blochRenderer) {
            this.blochRenderer.dispose();
            this.blochRenderer = null;
        }
        
        this.blochScene = null;
        this.blochCamera = null;
        this.sphereGroup = null;
        this.stateArrow = null;
    }

    createProbabilityBar(label, probability) {
        const precision = this.settings.precision;
        const prob = probability || 0;
        const barContainer = document.createElement('div');
        barContainer.className = 'probability-bar';
        
        const labelEl = document.createElement('div');
        labelEl.className = 'probability-label';
        labelEl.textContent = label;
        
        const valueContainer = document.createElement('div');
        valueContainer.className = 'probability-value';
        
        const fill = document.createElement('div');
        fill.className = 'probability-fill';
        fill.style.width = `${prob * 100}%`;
        
        valueContainer.appendChild(fill);
        
        const text = document.createElement('div');
        text.className = 'probability-text';
        text.textContent = `${(prob * 100).toFixed(precision)}%`;
        
        barContainer.appendChild(labelEl);
        barContainer.appendChild(valueContainer);
        barContainer.appendChild(text);
        
        return barContainer;
    }

    updateStateVector(quantumState, settings = null) {
        if (settings) this.setSettings(settings);
        const stateVectorEl = document.getElementById('stateVector');
        if (!stateVectorEl || !quantumState) return;
        
        const precision = this.settings.precision;
        const hideNegligibles = this.settings.hideNegligibles;
        const threshold = hideNegligibles ? Math.pow(10, -(precision + 2)) : 1e-10;
        
        const stateStr = this.formatStateVector(quantumState, precision, threshold);
        stateVectorEl.innerHTML = stateStr;
        stateVectorEl.classList.add('updating');
        setTimeout(() => {
            stateVectorEl.classList.remove('updating');
        }, 500);
    }

    formatStateVector(quantumState, precision, threshold) {
        const sortBy = this.settings.sortBy || 'probability';
        const sortOrder = this.settings.sortOrder || 'desc';
        
        // Collect all states with their data
        const states = [];
        const numStates = Math.pow(2, quantumState.numQubits);
        
        for (let i = 0; i < numStates; i++) {
            const amplitude = quantumState.amplitudes[i];
            if (!amplitude) continue;
            
            const re = amplitude.re || 0;
            const im = amplitude.im || 0;
            const prob = re * re + im * im;
            
            if (prob < threshold) continue;
            
            states.push({ index: i, re, im, prob });
        }
        
        // Sort based on settings
        if (sortBy === 'label') {
            states.sort((a, b) => {
                const cmp = a.index - b.index;
                return sortOrder === 'asc' ? cmp : -cmp;
            });
        } else {
            states.sort((a, b) => {
                const cmp = a.prob - b.prob;
                return sortOrder === 'asc' ? cmp : -cmp;
            });
        }
        
        // Build the formatted terms
        const terms = states.map(({ index, re, im }) => {
            const binary = index.toString(2).padStart(quantumState.numQubits, '0');
            
            let coeffStr;
            if (Math.abs(im) < 1e-10) {
                coeffStr = `<span class="sv-coeff">${re.toFixed(precision)}</span>`;
            } else if (Math.abs(re) < 1e-10) {
                coeffStr = `<span class="sv-coeff">${im.toFixed(precision)}<span class="sv-imag">i</span></span>`;
            } else {
                const sign = im >= 0 ? '+' : '−';
                coeffStr = `<span class="sv-coeff">(${re.toFixed(precision)}${sign}${Math.abs(im).toFixed(precision)}<span class="sv-imag">i</span>)</span>`;
            }
            
            const ketStr = `<span class="sv-ket">|${binary}⟩</span>`;
            return `${coeffStr}${ketStr}`;
        });
        
        if (terms.length === 0) return '<span class="sv-ket">|0⟩</span>';
        
        return terms.join(' <span class="sv-plus">+</span> ').replace(/\+ <span class="sv-plus">\+<\/span> -/g, ' <span class="sv-plus">−</span> ');
    }

    updateMeasurementResults(quantumState, settings = null) {
        if (settings) this.setSettings(settings);
        const resultsEl = document.getElementById('measurementResults');
        if (!resultsEl || !quantumState) return;
        
        const precision = this.settings.precision;
        const hideNegligibles = this.settings.hideNegligibles;
        const threshold = hideNegligibles ? Math.pow(10, -(precision + 2)) : 1e-10;
        
        resultsEl.innerHTML = '';
        
        const probabilities = quantumState.getAllProbabilities();
        let sortedProbs = Object.entries(probabilities)
            .filter(([_, prob]) => prob >= threshold);
        
        // Apply sorting based on settings
        const sortBy = this.settings.sortBy || 'probability';
        const sortOrder = this.settings.sortOrder || 'desc';
        
        if (sortBy === 'label') {
            sortedProbs.sort((a, b) => {
                const cmp = parseInt(a[0], 2) - parseInt(b[0], 2);
                return sortOrder === 'asc' ? cmp : -cmp;
            });
        } else {
            sortedProbs.sort((a, b) => {
                const cmp = a[1] - b[1];
                return sortOrder === 'asc' ? cmp : -cmp;
            });
        }
        
        if (sortedProbs.length === 0) {
            resultsEl.innerHTML = '<p class="placeholder">No measurement data</p>';
            return;
        }
        
        const scrollContainer = document.createElement('div');
        scrollContainer.className = 'results-scroll-container';
        scrollContainer.style.maxHeight = '320px';
        scrollContainer.style.overflowY = 'auto';
        
        sortedProbs.forEach(([binary, prob]) => {
            const resultItem = document.createElement('div');
            resultItem.className = 'result-item';
            
            const binaryEl = document.createElement('div');
            binaryEl.className = 'result-binary';
            binaryEl.textContent = `|${binary}⟩`;
            
            const probEl = document.createElement('div');
            probEl.className = 'result-probability';
            probEl.textContent = `${(prob * 100).toFixed(precision)}%`;
            
            resultItem.appendChild(binaryEl);
            resultItem.appendChild(probEl);
            
            const barContainer = document.createElement('div');
            barContainer.style.cssText = 'display: flex; justify-content: flex-end; width: 100%; margin-top: 0.5rem;';
            
            const bar = document.createElement('div');
            bar.className = 'result-bar';
            const barFill = document.createElement('div');
            barFill.className = 'result-bar-fill';
            barFill.style.width = `${prob * 100}%`;
            bar.appendChild(barFill);
            barContainer.appendChild(bar);
            
            resultItem.appendChild(barContainer);
            scrollContainer.appendChild(resultItem);
        });
        
        resultsEl.appendChild(scrollContainer);
        
        if (sortedProbs.length > 8) {
            const countInfo = document.createElement('div');
            countInfo.style.cssText = 'font-size: 0.75rem; color: var(--text-secondary); text-align: center; padding-top: 0.5rem; border-top: 1px solid var(--border-color); margin-top: 0.5rem;';
            countInfo.textContent = `Showing ${sortedProbs.length} states`;
            resultsEl.appendChild(countInfo);
        }
    }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { QubitVisualizer };
}
