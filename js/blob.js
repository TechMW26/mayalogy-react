/**
 * MAYA - Blob Module
 * Three.js Glowing Blue Blob Animation
 */

const MayaBlob = {
    scene: null,
    camera: null,
    renderer: null,
    blob: null,
    clock: null,
    isAnimating: false,
    container: null,
    uniforms: null,
    mouseX: 0,
    mouseY: 0,
    targetMouseX: 0,
    targetMouseY: 0,

    /**
     * Vertex Shader
     */
    vertexShader: `
        uniform float uTime;
        uniform float uAmplitude;
        uniform float uFrequency;
        
        varying vec3 vNormal;
        varying vec3 vPosition;
        varying float vDisplacement;
        
        //
        // Simplex 3D Noise
        //
        vec4 permute(vec4 x) { return mod(((x*34.0)+1.0)*x, 289.0); }
        vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
        
        float snoise(vec3 v) {
            const vec2 C = vec2(1.0/6.0, 1.0/3.0);
            const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
            
            vec3 i  = floor(v + dot(v, C.yyy));
            vec3 x0 = v - i + dot(i, C.xxx);
            
            vec3 g = step(x0.yzx, x0.xyz);
            vec3 l = 1.0 - g;
            vec3 i1 = min(g.xyz, l.zxy);
            vec3 i2 = max(g.xyz, l.zxy);
            
            vec3 x1 = x0 - i1 + C.xxx;
            vec3 x2 = x0 - i2 + C.yyy;
            vec3 x3 = x0 - D.yyy;
            
            i = mod(i, 289.0);
            vec4 p = permute(permute(permute(
                i.z + vec4(0.0, i1.z, i2.z, 1.0))
                + i.y + vec4(0.0, i1.y, i2.y, 1.0))
                + i.x + vec4(0.0, i1.x, i2.x, 1.0));
                
            float n_ = 1.0/7.0;
            vec3 ns = n_ * D.wyz - D.xzx;
            
            vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
            
            vec4 x_ = floor(j * ns.z);
            vec4 y_ = floor(j - 7.0 * x_);
            
            vec4 x = x_ *ns.x + ns.yyyy;
            vec4 y = y_ *ns.x + ns.yyyy;
            vec4 h = 1.0 - abs(x) - abs(y);
            
            vec4 b0 = vec4(x.xy, y.xy);
            vec4 b1 = vec4(x.zw, y.zw);
            
            vec4 s0 = floor(b0)*2.0 + 1.0;
            vec4 s1 = floor(b1)*2.0 + 1.0;
            vec4 sh = -step(h, vec4(0.0));
            
            vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
            vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
            
            vec3 p0 = vec3(a0.xy, h.x);
            vec3 p1 = vec3(a0.zw, h.y);
            vec3 p2 = vec3(a1.xy, h.z);
            vec3 p3 = vec3(a1.zw, h.w);
            
            vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
            p0 *= norm.x;
            p1 *= norm.y;
            p2 *= norm.z;
            p3 *= norm.w;
            
            vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
            m = m * m;
            return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
        }
        
        void main() {
            vNormal = normal;
            vPosition = position;
            
            float noise = snoise(position * uFrequency + uTime * 0.5);
            float displacement = noise * uAmplitude;
            vDisplacement = displacement;
            
            vec3 newPosition = position + normal * displacement;
            
            gl_Position = projectionMatrix * modelViewMatrix * vec4(newPosition, 1.0);
        }
    `,

    /**
     * Fragment Shader
     */
    fragmentShader: `
        uniform float uTime;
        uniform vec3 uColor1;
        uniform vec3 uColor2;
        uniform vec3 uColor3;
        uniform float uGlowIntensity;
        
        varying vec3 vNormal;
        varying vec3 vPosition;
        varying float vDisplacement;
        
        void main() {
            // Calculate fresnel for glow effect
            vec3 viewDirection = normalize(cameraPosition - vPosition);
            float fresnel = pow(1.0 - dot(viewDirection, vNormal), 2.5);
            
            // Three-tone color mixing based on displacement
            // uColor1 = bronze (dark), uColor2 = yellow (mid), uColor3 = white (light)
            float colorMix = (vDisplacement + 0.3) / 0.6;
            vec3 baseColor;
            if (colorMix < 0.5) {
                baseColor = mix(uColor1, uColor2, colorMix * 2.0);
            } else {
                baseColor = mix(uColor2, uColor3, (colorMix - 0.5) * 2.0);
            }
            
            // Add bright glow on edges (white-yellow)
            vec3 glowColor = vec3(1.0, 0.95, 0.7);
            vec3 finalColor = mix(baseColor, glowColor, fresnel * uGlowIntensity);
            
            // Add subtle pulsing
            float pulse = sin(uTime * 2.0) * 0.08 + 0.92;
            finalColor *= pulse;
            
            // Enhanced glow effect
            float glow = fresnel * 0.6;
            finalColor += glowColor * glow * 0.3;
            
            gl_FragColor = vec4(finalColor, 1.0);
        }
    `,

    /**
     * Initialize the blob scene
     */
    init(containerId = 'mayaBlob') {
        this.container = document.getElementById(containerId);
        if (!this.container) {
            console.error('Blob container not found');
            return;
        }

        // Use fixed size for blob - CSS will constrain the container
        // This ensures consistent blob rendering regardless of container computed size
        const size = 280; // Match CSS .maya-blob-container width/height
        const width = size;
        const height = size;

        // Scene
        this.scene = new THREE.Scene();

        // Camera
        this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
        this.camera.position.z = 5;

        // Clear any existing canvases
        const existingCanvas = this.container.querySelector('canvas');
        if (existingCanvas) {
            existingCanvas.remove();
        }

        // Renderer
        this.renderer = new THREE.WebGLRenderer({
            alpha: true,
            antialias: true
        });
        this.renderer.setSize(width, height);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.setClearColor(0x000000, 0);
        
        // Style the canvas for proper centering
        this.renderer.domElement.style.display = 'block';
        this.renderer.domElement.style.margin = '0 auto';
        this.container.appendChild(this.renderer.domElement);

        // Clock for animation
        this.clock = new THREE.Clock();

        // Create blob
        this.createBlob();

        // Add ambient glow particles
        this.createParticles();

        // Event listeners
        window.addEventListener('resize', this.onResize.bind(this));
        this.container.addEventListener('mousemove', this.onMouseMove.bind(this));
        this.container.addEventListener('touchmove', this.onTouchMove.bind(this), { passive: true });

        // Start animation
        this.animate();
    },

    /**
     * Create the blob mesh
     */
    createBlob() {
        // Geometry
        const geometry = new THREE.IcosahedronGeometry(1.5, 64);

        // Uniforms
        this.uniforms = {
            uTime: { value: 0 },
            uAmplitude: { value: 0.15 },
            uFrequency: { value: 1.5 },
            uColor1: { value: new THREE.Color(0xa8741f) },  // Bronze (dark)
            uColor2: { value: new THREE.Color(0xffdf64) },  // Yellow (highlights)
            uColor3: { value: new THREE.Color(0xfffef5) },  // White (inner light)
            uGlowIntensity: { value: 0.6 }
        };

        // Material
        const material = new THREE.ShaderMaterial({
            vertexShader: this.vertexShader,
            fragmentShader: this.fragmentShader,
            uniforms: this.uniforms,
            transparent: false,
            side: THREE.FrontSide,
            depthWrite: true
        });

        // Mesh
        this.blob = new THREE.Mesh(geometry, material);
        this.scene.add(this.blob);
    },

    /**
     * Create ambient glow particles
     */
    createParticles() {
        const particleCount = 100;
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(particleCount * 3);

        for (let i = 0; i < particleCount; i++) {
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);
            const radius = 2 + Math.random() * 1.5;

            positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
            positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
            positions[i * 3 + 2] = radius * Math.cos(phi);
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

        const material = new THREE.PointsMaterial({
            color: 0xffdf64,
            size: 0.05,
            transparent: false,
            opacity: 1.0
        });

        this.particles = new THREE.Points(geometry, material);
        this.scene.add(this.particles);
    },

    /**
     * Animation loop
     */
    animate() {
        if (!this.isAnimating) {
            this.isAnimating = true;
        }

        requestAnimationFrame(this.animate.bind(this));

        const elapsed = this.clock.getElapsedTime();

        // Update uniforms
        if (this.uniforms) {
            this.uniforms.uTime.value = elapsed;

            // Audio reactivity
            const amplitude = window.MayaVoice ? MayaVoice.getAmplitude() : 0;
            this.uniforms.uAmplitude.value = 0.15 + amplitude * 0.3;
            this.uniforms.uGlowIntensity.value = 0.5 + amplitude * 0.5;
        }

        // Rotate blob slightly based on mouse
        if (this.blob) {
            this.mouseX += (this.targetMouseX - this.mouseX) * 0.05;
            this.mouseY += (this.targetMouseY - this.mouseY) * 0.05;
            
            this.blob.rotation.x = this.mouseY * 0.5 + elapsed * 0.1;
            this.blob.rotation.y = this.mouseX * 0.5 + elapsed * 0.15;
        }

        // Rotate particles
        if (this.particles) {
            this.particles.rotation.y = elapsed * 0.05;
        }

        this.renderer.render(this.scene, this.camera);
    },

    /**
     * Handle window resize
     */
    onResize() {
        if (!this.container) return;

        // Keep blob size fixed - CSS handles responsive scaling
        const size = 280;
        const width = size;
        const height = size;

        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
    },

    /**
     * Handle mouse move
     */
    onMouseMove(event) {
        const rect = this.container.getBoundingClientRect();
        this.targetMouseX = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
        this.targetMouseY = ((event.clientY - rect.top) / rect.height - 0.5) * 2;
    },

    /**
     * Handle touch move
     */
    onTouchMove(event) {
        if (event.touches.length > 0) {
            const rect = this.container.getBoundingClientRect();
            this.targetMouseX = ((event.touches[0].clientX - rect.left) / rect.width - 0.5) * 2;
            this.targetMouseY = ((event.touches[0].clientY - rect.top) / rect.height - 0.5) * 2;
        }
    },

    /**
     * Set blob colors
     */
    setColors(color1, color2) {
        if (this.uniforms) {
            this.uniforms.uColor1.value = new THREE.Color(color1);
            this.uniforms.uColor2.value = new THREE.Color(color2);
        }
    },

    /**
     * Pulse effect for speaking
     */
    pulse(intensity = 1) {
        if (this.uniforms) {
            gsap.to(this.uniforms.uAmplitude, {
                value: 0.3 * intensity,
                duration: 0.2,
                yoyo: true,
                repeat: 1,
                ease: 'power2.inOut'
            });
            gsap.to(this.uniforms.uGlowIntensity, {
                value: 0.8 * intensity,
                duration: 0.2,
                yoyo: true,
                repeat: 1,
                ease: 'power2.inOut'
            });
        }
    },

    /**
     * Thinking animation
     */
    startThinking() {
        if (this.uniforms) {
            gsap.killTweensOf(this.uniforms.uFrequency);
            gsap.killTweensOf(this.uniforms.uAmplitude);
            gsap.killTweensOf(this.uniforms.uGlowIntensity);
            gsap.killTweensOf(this.uniforms.uColor1.value);
            gsap.killTweensOf(this.uniforms.uColor2.value);
            if (this.blob?.scale) {
                gsap.killTweensOf(this.blob.scale);
            }

            gsap.to(this.uniforms.uFrequency, {
                value: 3.2,
                duration: 0.9,
                ease: 'sine.inOut',
                yoyo: true,
                repeat: -1
            });
            gsap.to(this.uniforms.uAmplitude, {
                value: 0.32,
                duration: 0.85,
                ease: 'sine.inOut',
                yoyo: true,
                repeat: -1
            });
            gsap.to(this.uniforms.uGlowIntensity, {
                value: 1.15,
                duration: 0.75,
                ease: 'sine.inOut',
                yoyo: true,
                repeat: -1
            });
            gsap.to(this.uniforms.uColor1.value, {
                r: 0.52,
                g: 0.26,
                b: 1.0,
                duration: 0.45
            });
            gsap.to(this.uniforms.uColor2.value, {
                r: 1.0,
                g: 0.76,
                b: 0.95,
                duration: 0.5
            });
            if (this.blob?.scale) {
                gsap.to(this.blob.scale, {
                    x: 1.06,
                    y: 1.06,
                    z: 1.06,
                    duration: 1.1,
                    ease: 'sine.inOut',
                    yoyo: true,
                    repeat: -1
                });
            }
        }
    },

    /**
     * Stop thinking animation
     */
    stopThinking() {
        if (this.uniforms) {
            gsap.killTweensOf(this.uniforms.uFrequency);
            gsap.killTweensOf(this.uniforms.uAmplitude);
            gsap.killTweensOf(this.uniforms.uGlowIntensity);
            gsap.killTweensOf(this.uniforms.uColor1.value);
            gsap.killTweensOf(this.uniforms.uColor2.value);
            if (this.blob?.scale) {
                gsap.killTweensOf(this.blob.scale);
            }

            gsap.to(this.uniforms.uFrequency, {
                value: 1.5,
                duration: 0.5,
                ease: 'power2.out'
            });
            gsap.to(this.uniforms.uAmplitude, {
                value: 0.15,
                duration: 0.55,
                ease: 'power2.out'
            });
            gsap.to(this.uniforms.uGlowIntensity, {
                value: 0.6,
                duration: 0.55,
                ease: 'power2.out'
            });
            gsap.to(this.uniforms.uColor1.value, {
                r: 0.0,
                g: 0.4,
                b: 1.0,
                duration: 0.5
            });
            gsap.to(this.uniforms.uColor2.value, {
                r: 1.0,
                g: 0.8745098039,
                b: 0.3921568627,
                duration: 0.5
            });
            if (this.blob?.scale) {
                gsap.to(this.blob.scale, {
                    x: 1,
                    y: 1,
                    z: 1,
                    duration: 0.55,
                    ease: 'power2.out'
                });
            }
        }
    },

    /**
     * Start speaking animation - intensified pulsing
     */
    startSpeaking() {
        this._speakingAnimation = true;
        if (this.uniforms) {
            gsap.to(this.uniforms.uAmplitude, {
                value: 0.35,
                duration: 0.3,
                ease: 'power2.out'
            });
            gsap.to(this.uniforms.uGlowIntensity, {
                value: 0.9,
                duration: 0.3,
                ease: 'power2.out'
            });
            gsap.to(this.uniforms.uFrequency, {
                value: 2.0,
                duration: 0.3,
                ease: 'power2.out'
            });
        }
    },

    /**
     * Stop speaking animation - return to calm state
     */
    stopSpeaking() {
        this._speakingAnimation = false;
        if (this.uniforms) {
            gsap.to(this.uniforms.uAmplitude, {
                value: 0.15,
                duration: 0.5,
                ease: 'power2.out'
            });
            gsap.to(this.uniforms.uGlowIntensity, {
                value: 0.5,
                duration: 0.5,
                ease: 'power2.out'
            });
            gsap.to(this.uniforms.uFrequency, {
                value: 1.5,
                duration: 0.5,
                ease: 'power2.out'
            });
        }
    },

    /**
     * Destroy and cleanup
     */
    destroy() {
        this.isAnimating = false;
        
        if (this.renderer) {
            this.renderer.dispose();
            try {
                if (this.renderer.domElement && this.renderer.domElement.parentNode) {
                    this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
                }
            } catch (e) {
                console.warn('Blob cleanup:', e.message);
            }
            this.renderer = null;
        }
        
        this.scene = null;
        this.camera = null;
        this.blob = null;
        this.container = null;
        
        window.removeEventListener('resize', this.onResize.bind(this));
    }
};

// Make globally available
window.MayaBlob = MayaBlob;
