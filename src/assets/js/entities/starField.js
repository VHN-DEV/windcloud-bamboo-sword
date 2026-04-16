class StarField {
    static activeInstance = null;

    constructor(count, width, height) {
        this.width = width;
        this.height = height;
        this.sparkLines = [];
        this.seaClouds = [];

        if (StarField.activeInstance && StarField.activeInstance !== this) {
            StarField.activeInstance.destroy();
        }

        if (!window.THREE) {
            console.warn('Three.js chưa tải xong, bỏ qua nền 3D.');
            return;
        }

        if (window.Math.seedrandom) {
            window.Math.seedrandom('ocean-saturn-constant');
        }

        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(60, width / height, 1, 3000);
        this.camera.position.set(0, 150, 350);
        this.hasOrbitControls = Boolean(window.THREE?.OrbitControls);
        this.renderer = new THREE.WebGLRenderer({
            antialias: false,
            alpha: true,
            powerPreference: 'high-performance'
        });
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
        this.renderer.setSize(width, height);
        this.renderer.domElement.id = 'space-bg';
        document.body.prepend(this.renderer.domElement);

        if (this.hasOrbitControls) {
            const gameplayCanvas = document.getElementById('c') || this.renderer.domElement;
            gameplayCanvas.addEventListener('contextmenu', event => event.preventDefault());
            this.controls = new THREE.OrbitControls(this.camera, gameplayCanvas);
            this.controls.enableDamping = true;
            this.controls.enablePan = false;
            this.controls.minDistance = 120;
            this.controls.maxDistance = 900;
            this.controls.mouseButtons = {
                LEFT: null,
                MIDDLE: THREE.MOUSE.DOLLY,
                RIGHT: THREE.MOUSE.ROTATE
            };
            this.controls.touches = {
                ONE: THREE.TOUCH.ROTATE,
                TWO: THREE.TOUCH.DOLLY_ROTATE
            };
            this.controls.target.set(0, 0, 0);
            this.controls.update();
        }

        this.createParticles();
        this.createSeaClouds();
        this.planetNet = this.createNetwork(false);
        this.ring1 = this.createNetwork(true, 0);
        this.ring2 = this.createNetwork(true, 15);
        this.ring1.rotation.x = Math.PI / 2.2;
        this.ring2.rotation.x = -Math.PI / 4;
        this.scene.add(this.planetNet, this.ring1, this.ring2);
        this.createSparkLines();

        StarField.activeInstance = this;
    }

    createOceanTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 128;
        canvas.height = 128;
        const ctx2d = canvas.getContext('2d');
        const gradient = ctx2d.createRadialGradient(64, 64, 0, 64, 64, 64);
        gradient.addColorStop(0, 'rgba(0, 255, 200, 0.5)');
        gradient.addColorStop(0.3, 'rgba(0, 150, 255, 0.2)');
        gradient.addColorStop(0.7, 'rgba(0, 20, 100, 0.1)');
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx2d.fillStyle = gradient;
        ctx2d.fillRect(0, 0, 128, 128);
        return new THREE.CanvasTexture(canvas);
    }

    createParticles() {
        const pointCount = Math.max(4000, (CONFIG.BG.STAR_COUNT || 8000));
        const bubbleGeo = new THREE.BufferGeometry();
        const bubblePos = new Float32Array(pointCount * 3);
        for (let i = 0; i < pointCount * 3; i++) {
            bubblePos[i] = (Math.random() - 0.5) * 2000;
        }
        bubbleGeo.setAttribute('position', new THREE.BufferAttribute(bubblePos, 3));

        const material = new THREE.PointsMaterial({
            size: 2,
            color: 0x88ffff,
            transparent: true,
            opacity: 0.5,
            blending: THREE.AdditiveBlending
        });
        this.scene.add(new THREE.Points(bubbleGeo, material));
    }

    createSeaClouds() {
        const oceanTex = this.createOceanTexture();
        const seaGroup = new THREE.Group();
        for (let i = 0; i < 60; i++) {
            const material = new THREE.SpriteMaterial({
                map: oceanTex,
                transparent: true,
                opacity: 0.6,
                blending: THREE.AdditiveBlending,
                depthWrite: false
            });
            const sprite = new THREE.Sprite(material);
            const angle = Math.random() * Math.PI * 2;
            const radius = 40 + Math.random() * 60;
            sprite.position.set(
                Math.cos(angle) * radius,
                (Math.random() - 0.5) * 60,
                Math.sin(angle) * radius
            );
            sprite.scale.set(100 + Math.random() * 100, 100 + Math.random() * 100, 1);
            sprite.userData = {
                rotSpeed: (Math.random() - 0.5) * 0.005,
                phase: Math.random() * Math.PI,
                baseScale: sprite.scale.x
            };
            this.seaClouds.push(sprite);
            seaGroup.add(sprite);
        }
        this.seaGroup = seaGroup;
        this.scene.add(this.seaGroup);
    }

    createNetwork(isRing, radiusOffset = 0) {
        const group = new THREE.Group();
        const count = isRing ? 700 : 500;
        const positions = [];
        const colors = [];
        const color = new THREE.Color();

        for (let i = 0; i < count; i++) {
            let x;
            let y;
            let z;

            if (isRing) {
                const angle = (i / count) * Math.PI * 2;
                const ringRadius = (70 + radiusOffset) + Math.random() * 25;
                x = Math.cos(angle) * ringRadius;
                z = Math.sin(angle) * ringRadius;
                y = (Math.random() - 0.5) * 5;
                color.setHSL(0.55 + (ringRadius - 70) * 0.002, 0.8, 0.5);
            } else {
                const phi = Math.acos(-1 + (2 * i) / count);
                const theta = Math.sqrt(count * Math.PI) * phi;
                const sphereRadius = 45;
                x = sphereRadius * Math.cos(theta) * Math.sin(phi);
                y = sphereRadius * Math.sin(theta) * Math.sin(phi);
                z = sphereRadius * Math.cos(phi);
                color.setHSL(0.5 + (Math.abs(y) / 45) * 0.1, 0.9, 0.5);
            }
            positions.push(x, y, z);
            colors.push(color.r, color.g, color.b);
        }

        const pointsGeo = new THREE.BufferGeometry();
        pointsGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        pointsGeo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        group.add(new THREE.Points(pointsGeo, new THREE.PointsMaterial({
            size: 1.8,
            vertexColors: true,
            blending: THREE.AdditiveBlending,
            transparent: true
        })));

        const linePos = [];
        const lineColors = [];
        const maxDist = isRing ? 15 : 20;
        for (let i = 0; i < count; i++) {
            for (let j = i + 1; j < count; j++) {
                const dx = positions[i * 3] - positions[j * 3];
                const dy = positions[i * 3 + 1] - positions[j * 3 + 1];
                const dz = positions[i * 3 + 2] - positions[j * 3 + 2];
                if (dx * dx + dy * dy + dz * dz < maxDist * maxDist) {
                    linePos.push(
                        positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2],
                        positions[j * 3], positions[j * 3 + 1], positions[j * 3 + 2]
                    );
                    lineColors.push(
                        colors[i * 3], colors[i * 3 + 1], colors[i * 3 + 2],
                        colors[j * 3], colors[j * 3 + 1], colors[j * 3 + 2]
                    );
                }
            }
        }

        const lineGeo = new THREE.BufferGeometry();
        lineGeo.setAttribute('position', new THREE.Float32BufferAttribute(linePos, 3));
        lineGeo.setAttribute('color', new THREE.Float32BufferAttribute(lineColors, 3));
        group.add(new THREE.LineSegments(lineGeo, new THREE.LineBasicMaterial({
            vertexColors: true,
            transparent: true,
            opacity: 0.25
        })));

        return group;
    }

    createSparkLines() {
        for (let i = 0; i < 6; i++) {
            const line = new THREE.Line(
                new THREE.BufferGeometry(),
                new THREE.LineBasicMaterial({
                    color: 0xe0ffff,
                    transparent: true,
                    blending: THREE.AdditiveBlending
                })
            );
            line.userData = { timer: 0, active: false };
            this.scene.add(line);
            this.sparkLines.push(line);
        }
    }

    launchSpark(line) {
        const points = [];
        let current = new THREE.Vector3(
            (Math.random() - 0.5) * 100,
            (Math.random() - 0.5) * 100,
            (Math.random() - 0.5) * 100
        );

        for (let i = 0; i < 12; i++) {
            points.push(current.clone());
            current = current.clone().add(new THREE.Vector3(
                (Math.random() - 0.5) * 25,
                (Math.random() - 0.5) * 25,
                (Math.random() - 0.5) * 25
            ));
        }
        line.geometry.setFromPoints(points);
        line.userData.active = true;
        line.userData.timer = 1;
    }

    resize(width, height) {
        if (!this.renderer || !this.camera) return;
        this.width = width;
        this.height = height;
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
    }

    destroy() {
        this.controls?.dispose?.();
        if (this.renderer?.domElement?.parentElement) {
            this.renderer.domElement.parentElement.removeChild(this.renderer.domElement);
        }
        this.renderer?.dispose?.();
    }

    draw() {
        if (!this.renderer || !this.camera) return;
        const timeSec = performance.now() * 0.001;

        this.planetNet.rotation.y += 0.0015;
        this.ring1.rotation.z -= 0.003;
        this.ring2.rotation.z += 0.004;
        this.seaClouds.forEach(sprite => {
            sprite.userData.phase += 0.005;
            sprite.material.rotation += sprite.userData.rotSpeed;
            sprite.material.opacity = 0.3 + Math.sin(sprite.userData.phase) * 0.2;
            const pulse = 1 + Math.sin(sprite.userData.phase) * 0.1;
            const scale = sprite.userData.baseScale * pulse;
            sprite.scale.set(scale, scale, 1);
        });
        this.seaGroup.rotation.y += 0.0005;

        this.sparkLines.forEach(line => {
            if (!line.userData.active && Math.random() < 0.015) this.launchSpark(line);
            if (!line.userData.active) return;
            line.userData.timer -= 0.08;
            line.material.opacity = line.userData.timer;
            if (line.userData.timer <= 0) line.userData.active = false;
        });

        if (this.controls) {
            this.controls.update();
        } else {
            this.camera.position.x = Math.sin(timeSec * 0.25) * 20;
            this.camera.position.y = 130 + Math.sin(timeSec * 0.17) * 18;
            this.camera.lookAt(0, 0, 0);
        }

        this.renderer.render(this.scene, this.camera);
    }
}
