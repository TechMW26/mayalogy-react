/**
 * MAYA - Kundli Chart Generator
 * North Indian and South Indian Chart Styles
 * Enhanced with detailed planetary information
 */

const MayaKundli = {
    localizeHindiAstroText(text) {
        const astroRules = MAYA_CONFIG?.LANGUAGE?.HINDI_ASTRO_TERM_RULES || [];

        return astroRules.reduce((localized, rule) => {
            try {
                return localized.replace(new RegExp(rule.pattern, 'gi'), rule.replacement);
            } catch (_error) {
                return localized;
            }
        }, String(text || '')).trim();
    },

    /**
     * Zodiac sign short names
     */
    signShortNames: {
        'Aries': 'Ari', 'Taurus': 'Tau', 'Gemini': 'Gem', 'Cancer': 'Can',
        'Leo': 'Leo', 'Virgo': 'Vir', 'Libra': 'Lib', 'Scorpio': 'Sco',
        'Sagittarius': 'Sag', 'Capricorn': 'Cap', 'Aquarius': 'Aqu', 'Pisces': 'Pis'
    },

    /**
     * Zodiac sign icons (using abbreviations with colors)
     */
    signIcons: {
        'Aries': { abbr: 'AR', color: '#FF5733' },
        'Taurus': { abbr: 'TA', color: '#2ECC71' },
        'Gemini': { abbr: 'GE', color: '#F1C40F' },
        'Cancer': { abbr: 'CA', color: '#BDC3C7' },
        'Leo': { abbr: 'LE', color: '#E74C3C' },
        'Virgo': { abbr: 'VI', color: '#3498DB' },
        'Libra': { abbr: 'LI', color: '#9B59B6' },
        'Scorpio': { abbr: 'SC', color: '#8E44AD' },
        'Sagittarius': { abbr: 'SA', color: '#1ABC9C' },
        'Capricorn': { abbr: 'CP', color: '#34495E' },
        'Aquarius': { abbr: 'AQ', color: '#9B59B6' },
        'Pisces': { abbr: 'PI', color: '#3498DB' }
    },

    /**
     * Planet details with symbols and image rendering configs
     */
    planetInfo: {
        'Sun': { symbol: '☉', vedic: 'Surya', color: '#FFD700', nature: 'Benefic', imgColors: ['#FFF8DC','#FFD700','#FF8C00','#CC6600'], glow: 'rgba(255,215,0,0.5)', corona: true },
        'Moon': { symbol: '☽', vedic: 'Chandra', color: '#C0C0C0', nature: 'Benefic', imgColors: ['#FFFFFF','#E8E8E8','#C0C0C0','#808080'], glow: 'rgba(200,200,220,0.4)', craters: true },
        'Mars': { symbol: '♂', vedic: 'Mangal', color: '#FF4444', nature: 'Malefic', imgColors: ['#FF8C69','#CD5C5C','#B22222','#8B0000'], glow: 'rgba(255,68,68,0.35)' },
        'Mercury': { symbol: '☿', vedic: 'Budha', color: '#00CC66', nature: 'Neutral', imgColors: ['#D4D4D4','#A8A8A8','#808080','#505050'], glow: 'rgba(160,160,160,0.3)' },
        'Jupiter': { symbol: '♃', vedic: 'Guru', color: '#FFAA00', nature: 'Benefic', imgColors: ['#FFD700','#DAA520','#B8860B','#8B6914'], glow: 'rgba(218,165,32,0.35)', bands: true },
        'Venus': { symbol: '♀', vedic: 'Shukra', color: '#FF69B4', nature: 'Benefic', imgColors: ['#FFFAF0','#FAEBD7','#DEB887','#C8A882'], glow: 'rgba(250,235,215,0.4)' },
        'Saturn': { symbol: '♄', vedic: 'Shani', color: '#4169E1', nature: 'Malefic', imgColors: ['#F0E68C','#DAA520','#B8860B','#8B7D3C'], glow: 'rgba(218,165,32,0.35)', ring: true },
        'Rahu': { symbol: '☊', vedic: 'Rahu', color: '#8B008B', nature: 'Malefic', imgColors: ['#DA70D6','#8B008B','#4B0082','#2E0051'], glow: 'rgba(139,0,139,0.4)' },
        'Ketu': { symbol: '☋', vedic: 'Ketu', color: '#8B4513', nature: 'Malefic', imgColors: ['#DEB887','#8B4513','#654321','#3E2723'], glow: 'rgba(139,69,19,0.35)' }
    },

    _planetImageCache: {},

    /**
     * Create a realistic photographic-style planet image on an offscreen canvas.
     */
    createPlanetImage(planetName, size) {
        size = size || 22;
        const key = `${planetName}_${size}`;
        if (this._planetImageCache[key]) return this._planetImageCache[key];

        const info = this.planetInfo[planetName];
        if (!info || !info.imgColors) return null;

        const c = document.createElement('canvas');
        c.width = size;
        c.height = size;
        const ctx = c.getContext('2d');
        const r = size / 2 - 2;
        const cx = size / 2;
        const cy = size / 2;

        // Outer glow
        const glowGrad = ctx.createRadialGradient(cx, cy, r * 0.5, cx, cy, r + 3);
        glowGrad.addColorStop(0, 'transparent');
        glowGrad.addColorStop(0.7, info.glow);
        glowGrad.addColorStop(1, 'transparent');
        ctx.fillStyle = glowGrad;
        ctx.fillRect(0, 0, size, size);

        // Planet sphere with 3D gradient
        const sphereGrad = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.35, r * 0.05, cx + r * 0.1, cy + r * 0.1, r);
        sphereGrad.addColorStop(0, info.imgColors[0]);
        sphereGrad.addColorStop(0.35, info.imgColors[1]);
        sphereGrad.addColorStop(0.7, info.imgColors[2]);
        sphereGrad.addColorStop(1, info.imgColors[3]);
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fillStyle = sphereGrad;
        ctx.fill();

        // Corona (Sun)
        if (info.corona) {
            ctx.save();
            ctx.globalAlpha = 0.45;
            for (let a = 0; a < 12; a++) {
                const angle = (a / 12) * Math.PI * 2;
                ctx.beginPath();
                ctx.moveTo(cx + Math.cos(angle) * r * 0.85, cy + Math.sin(angle) * r * 0.85);
                ctx.lineTo(cx + Math.cos(angle) * (r + 2.5), cy + Math.sin(angle) * (r + 2.5));
                ctx.strokeStyle = '#FFD700';
                ctx.lineWidth = 1;
                ctx.stroke();
            }
            ctx.restore();
        }

        // Jupiter bands
        if (info.bands) {
            ctx.save();
            ctx.beginPath();
            ctx.arc(cx, cy, r, 0, Math.PI * 2);
            ctx.clip();
            ctx.globalAlpha = 0.22;
            [-3, -1, 2, 4].forEach(offset => {
                ctx.beginPath();
                ctx.moveTo(cx - r, cy + offset);
                ctx.lineTo(cx + r, cy + offset);
                ctx.strokeStyle = offset % 2 ? '#8B6914' : '#654321';
                ctx.lineWidth = 1.5;
                ctx.stroke();
            });
            ctx.restore();
        }

        // Saturn ring
        if (info.ring) {
            ctx.save();
            ctx.globalAlpha = 0.6;
            ctx.beginPath();
            ctx.ellipse(cx, cy, r + 4, r * 0.25, -0.3, 0, Math.PI * 2);
            ctx.strokeStyle = '#F0E68C';
            ctx.lineWidth = 1.2;
            ctx.stroke();
            ctx.restore();
        }

        // Moon craters
        if (info.craters) {
            ctx.save();
            ctx.globalAlpha = 0.14;
            [[cx - 2, cy - 2, 1.5], [cx + 3, cy + 1, 1], [cx - 1, cy + 3, 0.8]].forEach(([x, y, rr]) => {
                ctx.beginPath();
                ctx.arc(x, y, rr, 0, Math.PI * 2);
                ctx.fillStyle = '#555';
                ctx.fill();
            });
            ctx.restore();
        }

        // Specular highlight
        ctx.save();
        const specGrad = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, 0, cx - r * 0.3, cy - r * 0.3, r * 0.45);
        specGrad.addColorStop(0, 'rgba(255,255,255,0.55)');
        specGrad.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = specGrad;
        ctx.beginPath();
        ctx.arc(cx - r * 0.3, cy - r * 0.3, r * 0.45, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        this._planetImageCache[key] = c;
        return c;
    },

    planetShortCodes: {
        'Sun': 'Su',
        'Moon': 'Mo',
        'Mars': 'Ma',
        'Mercury': 'Me',
        'Jupiter': 'Ju',
        'Venus': 'Ve',
        'Saturn': 'Sa',
        'Rahu': 'Ra',
        'Ketu': 'Ke'
    },

    /**
     * House meanings
     */
    houseMeanings: {
        1: { name: 'Lagna', meaning: 'Self, Personality, Health', hindi: 'तनु भाव' },
        2: { name: 'Dhana', meaning: 'Wealth, Family, Speech', hindi: 'धन भाव' },
        3: { name: 'Sahaja', meaning: 'Siblings, Courage, Skills', hindi: 'सहज भाव' },
        4: { name: 'Sukha', meaning: 'Home, Mother, Happiness', hindi: 'सुख भाव' },
        5: { name: 'Putra', meaning: 'Children, Intelligence, Romance', hindi: 'पुत्र भाव' },
        6: { name: 'Ripu', meaning: 'Enemies, Health Issues, Service', hindi: 'रिपु भाव' },
        7: { name: 'Kalatra', meaning: 'Marriage, Partnership, Business', hindi: 'कलत्र भाव' },
        8: { name: 'Randhra', meaning: 'Longevity, Transformation, Occult', hindi: 'रन्ध्र भाव' },
        9: { name: 'Dharma', meaning: 'Fortune, Father, Spirituality', hindi: 'धर्म भाव' },
        10: { name: 'Karma', meaning: 'Career, Status, Authority', hindi: 'कर्म भाव' },
        11: { name: 'Labha', meaning: 'Gains, Income, Aspirations', hindi: 'लाभ भाव' },
        12: { name: 'Vyaya', meaning: 'Losses, Moksha, Foreign Lands', hindi: 'व्यय भाव' }
    },

    /**
     * South Indian layout positions (fixed signs)
     */
    southIndianLayout: [
        { sign: 11, row: 0, col: 0 }, // Pisces
        { sign: 0, row: 0, col: 1 },  // Aries
        { sign: 1, row: 0, col: 2 },  // Taurus
        { sign: 2, row: 0, col: 3 },  // Gemini
        { sign: 10, row: 1, col: 0 }, // Aquarius
        { sign: 3, row: 1, col: 3 },  // Cancer
        { sign: 9, row: 2, col: 0 },  // Capricorn
        { sign: 4, row: 2, col: 3 },  // Leo
        { sign: 8, row: 3, col: 0 },  // Sagittarius
        { sign: 7, row: 3, col: 1 },  // Scorpio
        { sign: 6, row: 3, col: 2 },  // Libra
        { sign: 5, row: 3, col: 3 }   // Virgo
    ],

    clamp01(value) {
        const number = Number(value);
        if (!Number.isFinite(number)) return 0;
        return Math.max(0, Math.min(1, number));
    },

    easeOutCubic(value) {
        const amount = this.clamp01(value);
        return 1 - Math.pow(1 - amount, 3);
    },

    easeOutBack(value) {
        const amount = this.clamp01(value);
        const c1 = 1.70158;
        const c3 = c1 + 1;
        return 1 + c3 * Math.pow(amount - 1, 3) + c1 * Math.pow(amount - 1, 2);
    },

    lerp(start, end, amount) {
        return start + (end - start) * amount;
    },

    getSouthIndianLineSegments(width, height) {
        const inset = 10;
        const cellW = (width - inset * 2) / 4;
        const cellH = (height - inset * 2) / 4;

        return [
            { x1: inset, y1: inset, x2: width - inset, y2: inset, width: 2.2 },
            { x1: width - inset, y1: inset, x2: width - inset, y2: height - inset, width: 2.2 },
            { x1: width - inset, y1: height - inset, x2: inset, y2: height - inset, width: 2.2 },
            { x1: inset, y1: height - inset, x2: inset, y2: inset, width: 2.2 },
            { x1: inset + cellW, y1: inset, x2: inset + cellW, y2: height - inset, width: 1.55 },
            { x1: inset + cellW * 2, y1: inset, x2: inset + cellW * 2, y2: height - inset, width: 1.55 },
            { x1: inset + cellW * 3, y1: inset, x2: inset + cellW * 3, y2: height - inset, width: 1.55 },
            { x1: inset, y1: inset + cellH, x2: width - inset, y2: inset + cellH, width: 1.55 },
            { x1: inset, y1: inset + cellH * 2, x2: width - inset, y2: inset + cellH * 2, width: 1.55 },
            { x1: inset, y1: inset + cellH * 3, x2: width - inset, y2: inset + cellH * 3, width: 1.55 },
            { x1: inset + cellW, y1: inset + cellH, x2: inset + cellW * 3, y2: inset + cellH * 3, width: 1.5 },
            { x1: inset + cellW * 3, y1: inset + cellH, x2: inset + cellW, y2: inset + cellH * 3, width: 1.5 }
        ];
    },

    drawAnimatedLineSegment(ctx, segment, progress, color) {
        const amount = this.clamp01(progress);
        if (amount <= 0) return;

        const endX = this.lerp(segment.x1, segment.x2, amount);
        const endY = this.lerp(segment.y1, segment.y2, amount);

        ctx.save();
        ctx.beginPath();
        ctx.moveTo(segment.x1, segment.y1);
        ctx.lineTo(endX, endY);
        ctx.strokeStyle = color;
        ctx.lineWidth = segment.width || 1.5;
        ctx.lineCap = 'round';
        ctx.shadowColor = 'rgba(226, 196, 106, 0.7)';
        ctx.shadowBlur = amount < 1 ? 18 : 9;
        ctx.stroke();
        ctx.restore();
    },

    drawPlanetGlyphBadge(ctx, planet, centerX, centerY, reveal = 1, pulse = 0, options = {}) {
        const amount = this.easeOutBack(reveal);
        if (amount <= 0) return;

        const info = this.planetInfo[planet.name] || {};
        const label = this.planetShortCodes[planet.name] || planet.name.substring(0, 2);
        const pulseScale = 1 + Math.sin(pulse + centerX * 0.01 + centerY * 0.01) * 0.04;
        const scale = (0.3 + amount * 0.7) * pulseScale;
        const imgSize = options.size || 20;
        const labelSize = options.labelSize || 7;
        const showLabel = options.showLabel !== false;
        const planetImg = this.createPlanetImage(planet.name, imgSize);
        const spinSpeed = {
            Sun: 0.55,
            Moon: 0.72,
            Mars: 0.9,
            Mercury: 1.18,
            Jupiter: 0.42,
            Venus: 0.66,
            Saturn: 0.34,
            Rahu: -0.58,
            Ketu: -0.62
        }[planet.name] || 0.5;
        const rotation = pulse * spinSpeed + (planet.name || '').length * 0.19;

        ctx.save();
        ctx.globalAlpha = this.clamp01(reveal);
        ctx.translate(centerX, centerY);
        ctx.scale(scale, scale);

        if (planetImg) {
            ctx.save();
            ctx.rotate(rotation);
            ctx.drawImage(planetImg, -imgSize / 2, -imgSize / 2 - 1, imgSize, imgSize);
            ctx.restore();
        } else {
            const color = info.color || '#d4a732';
            ctx.beginPath();
            ctx.arc(0, -1, 8, 0, Math.PI * 2);
            ctx.fillStyle = color;
            ctx.shadowColor = color;
            ctx.shadowBlur = 10;
            ctx.fill();
        }

        if (showLabel) {
            ctx.shadowBlur = 0;
            ctx.fillStyle = options.labelColor || '#fffaf0';
            ctx.font = `bold ${labelSize}px Arial`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            ctx.fillText(label, 0, imgSize / 2 + 1);
        }

        ctx.restore();
    },

    renderSouthIndianCanvasFrame(ctx, data, frameState = {}) {
        const dpr = window.devicePixelRatio || 1;
        const w = ctx.canvas.width / dpr;
        const h = ctx.canvas.height / dpr;
        const lineColor = '#d4a732';
        const textColor = getComputedStyle(document.documentElement).getPropertyValue('--maya-text-primary').trim() || '#ffffff';
        const mutedColor = getComputedStyle(document.documentElement).getPropertyValue('--maya-text-muted').trim() || '#888888';
        const ascColor = '#fbbf24';
        const inset = 10;
        const cellW = (w - inset * 2) / 4;
        const cellH = (h - inset * 2) / 4;
        const lineProgress = this.clamp01(frameState.lineProgress ?? 1);
        const labelOpacity = this.clamp01(frameState.labelOpacity ?? 1);
        const planetProgress = this.clamp01(frameState.planetProgress ?? 1);
        const pulse = Number(frameState.pulse || 0);

        ctx.clearRect(0, 0, w, h);

        const segments = this.getSouthIndianLineSegments(w, h);
        const segmentCursor = lineProgress * segments.length;
        segments.forEach((segment, index) => {
            this.drawAnimatedLineSegment(ctx, segment, segmentCursor - index, lineColor);
        });

        ctx.save();
        ctx.globalAlpha = 0.28 + labelOpacity * 0.72;
        ctx.fillStyle = textColor;
        ctx.font = 'bold 16px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('MAYA', w / 2, h / 2 + 5);
        ctx.restore();

        const signPositions = data.southIndianLayout || this.southIndianLayout;
        const visiblePlanetCount = signPositions.reduce((count, pos) => {
            return count + Math.min((data.planetsBySign[pos.sign] || []).length, 3);
        }, 0);
        let badgeCursor = 0;

        signPositions.forEach((pos) => {
            const x = inset + pos.col * cellW;
            const y = inset + pos.row * cellH;
            const sign = data.signs[pos.sign];
            const isAsc = pos.sign === data.ascIndex;
            const signPlanets = data.planetsBySign[pos.sign] || [];
            const shortName = data.signShortNames[sign.name] || sign.name.substring(0, 3);

            if (isAsc && labelOpacity > 0) {
                ctx.save();
                ctx.fillStyle = `rgba(251, 191, 36, ${0.08 + labelOpacity * 0.14})`;
                ctx.fillRect(x, y, cellW, cellH);
                ctx.restore();
            }

            ctx.save();
            ctx.globalAlpha = labelOpacity;
            ctx.fillStyle = isAsc ? ascColor : mutedColor;
            ctx.font = '600 11px Arial';
            ctx.textAlign = 'left';
            ctx.fillText(`${sign.symbol} ${shortName}`, x + 6, y + 15);
            if (isAsc) {
                ctx.font = 'bold 9px Arial';
                ctx.fillText('Asc', x + cellW - 26, y + 15);
            }
            ctx.restore();

            signPlanets.slice(0, 3).forEach((planet, localIndex) => {
                badgeCursor += 1;
                const reveal = this.clamp01(planetProgress * Math.max(visiblePlanetCount, 1) - (badgeCursor - 1));
                if (reveal <= 0) return;

                const col = localIndex % 2;
                const row = Math.floor(localIndex / 2);
                const badgeX = x + 20 + col * 26;
                const badgeY = y + 36 + row * 22;
                this.drawPlanetGlyphBadge(ctx, planet, badgeX, badgeY, reveal, pulse);
            });

            if (signPlanets.length > 3) {
                const reveal = this.clamp01(planetProgress * Math.max(visiblePlanetCount, 1) - badgeCursor);
                if (reveal > 0) {
                    ctx.save();
                    ctx.globalAlpha = reveal;
                    ctx.fillStyle = mutedColor;
                    ctx.font = 'bold 9px Arial';
                    ctx.textAlign = 'left';
                    ctx.fillText(`+${signPlanets.length - 3}`, x + cellW - 20, y + cellH - 10);
                    ctx.restore();
                }
            }
        });
    },

    animateSouthIndianCanvas(canvas, data, options = {}) {
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        this._chartAnimationFrames = this._chartAnimationFrames || {};
        if (this._chartAnimationFrames[canvas.id]) {
            cancelAnimationFrame(this._chartAnimationFrames[canvas.id]);
            delete this._chartAnimationFrames[canvas.id];
        }

        const duration = options.durationMs || 5500;
        const start = performance.now();

        const renderFrame = (now) => {
            if (!document.body.contains(canvas)) {
                delete this._chartAnimationFrames[canvas.id];
                return;
            }

            const progress = this.clamp01((now - start) / duration);
            // Lines grow progressively: 0-40% of animation
            const lineProgress = this.easeOutCubic(this.clamp01(progress / 0.40));
            // Labels fade in: 25-48%
            const labelOpacity = this.easeOutCubic(this.clamp01((progress - 0.25) / 0.23));
            // Planets placed one by one: 42-100% (long window for dramatic reveal)
            const planetProgress = this.easeOutCubic(this.clamp01((progress - 0.42) / 0.58));

            this.renderSouthIndianCanvasFrame(ctx, data, {
                lineProgress,
                labelOpacity,
                planetProgress,
                pulse: now * 0.006
            });

            this._chartAnimationFrames[canvas.id] = requestAnimationFrame(renderFrame);
        };

        this._chartAnimationFrames[canvas.id] = requestAnimationFrame(renderFrame);
    },

    /**
     * Generate South Indian style chart HTML (canvas-based)
     */
    generateSouthIndianChart(planets, ascendantSign, options = {}) {
        const signs = MAYA_CONFIG.ZODIAC.SIGNS;
        const ascIndex = signs.findIndex(s => s.name === ascendantSign);

        // Group planets by sign
        const planetsBySign = {};
        signs.forEach((sign, i) => {
            planetsBySign[i] = [];
        });
        
        planets.forEach(planet => {
            const signIndex = signs.findIndex(s => s.name === planet.sign.name);
            if (signIndex >= 0) {
                planetsBySign[signIndex].push(planet);
            }
        });

        // Prepare data for canvas
        const chartData = {
            type: 'south',
            ascIndex,
            planetsBySign,
            signs,
            signShortNames: this.signShortNames,
            planetInfo: this.planetInfo,
            southIndianLayout: this.southIndianLayout
        };

        const chartId = 'kundli-canvas-south-' + Date.now();
        
        // Store chart data for later rendering
        this._pendingCharts = this._pendingCharts || {};
        this._pendingCharts[chartId] = { type: 'south', data: chartData, options };
        
        // Schedule draw after DOM update
        setTimeout(() => this.renderPendingChart(chartId), 50);
        
        return `
            <div class="kundli-canvas-container">
                <canvas id="${chartId}" class="kundli-canvas"></canvas>
            </div>
        `;
    },
    
    /**
     * Render pending chart after DOM is ready
     */
    renderPendingChart(chartId) {
        if (!this._pendingCharts || !this._pendingCharts[chartId]) return;
        
        const { type, data, options } = this._pendingCharts[chartId];
        let rendered = false;
        
        if (type === 'south') {
            rendered = this.drawSouthIndianCanvas(chartId, data, options);
        } else if (type === 'north') {
            rendered = this.drawNorthIndianCanvas(chartId, data, options);
        }
        
        if (rendered) {
            delete this._pendingCharts[chartId];
        }
    },

    /**
     * Draw South Indian chart on canvas
     */
    drawSouthIndianCanvas(canvasId, data, options = {}) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) {
            console.log('Canvas not found:', canvasId);
            return false;
        }
        
        console.log('Drawing South Indian chart on:', canvasId);
        
        // Set canvas to full width of container (HiDPI-aware)
        const container = canvas.parentElement;
        const size = container.offsetWidth || 400;
        const dpr = window.devicePixelRatio || 1;
        canvas.width = size * dpr;
        canvas.height = size * dpr;
        canvas.style.width = size + 'px';
        canvas.style.height = size + 'px';
        
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            return false;
        }
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
        if (options.animateFormation && !prefersReducedMotion) {
            this.animateSouthIndianCanvas(canvas, data, options);
        } else {
            this.renderSouthIndianCanvasFrame(ctx, data, {
                lineProgress: 1,
                labelOpacity: 1,
                planetProgress: 1,
                pulse: performance.now() * 0.006
            });
        }

        return true;
    },

    /**
     * Generate North Indian style chart HTML (canvas-based)
     */
    generateNorthIndianChart(planets, ascendantSign, options = {}) {
        const signs = MAYA_CONFIG.ZODIAC.SIGNS;
        const ascIndex = signs.findIndex(s => s.name === ascendantSign);
        
        // Calculate house-sign mapping (ascendant = house 1)
        const houseToSign = {};
        for (let i = 0; i < 12; i++) {
            houseToSign[i + 1] = signs[(ascIndex + i) % 12];
        }

        // Group planets by house
        const planetsByHouse = {};
        for (let i = 1; i <= 12; i++) {
            planetsByHouse[i] = [];
        }
        
        planets.forEach(planet => {
            const signIndex = signs.findIndex(s => s.name === planet.sign.name);
            const house = ((signIndex - ascIndex + 12) % 12) + 1;
            planetsByHouse[house].push(planet);
        });

        // Prepare data for canvas
        const chartData = {
            type: 'north',
            houseToSign,
            planetsByHouse,
            signShortNames: this.signShortNames,
            planetInfo: this.planetInfo
        };

        const chartId = 'kundli-canvas-north-' + Date.now();
        
        // Store chart data for later rendering
        this._pendingCharts = this._pendingCharts || {};
        this._pendingCharts[chartId] = { type: 'north', data: chartData, options };
        
        // Schedule draw after DOM update
        setTimeout(() => this.renderPendingChart(chartId), 50);

        return `
            <div class="kundli-canvas-container">
                <canvas id="${chartId}" class="kundli-canvas"></canvas>
            </div>
        `;
    },

    getNorthIndianHousePaths() {
        return [
            [{ x: 50, y: 0 }, { x: 75, y: 25 }, { x: 50, y: 50 }, { x: 25, y: 25 }],
            [{ x: 50, y: 0 }, { x: 100, y: 0 }, { x: 75, y: 25 }],
            [{ x: 100, y: 0 }, { x: 100, y: 50 }, { x: 75, y: 25 }],
            [{ x: 75, y: 25 }, { x: 100, y: 50 }, { x: 75, y: 75 }, { x: 50, y: 50 }],
            [{ x: 75, y: 75 }, { x: 100, y: 50 }, { x: 100, y: 100 }],
            [{ x: 75, y: 75 }, { x: 100, y: 100 }, { x: 50, y: 100 }],
            [{ x: 50, y: 50 }, { x: 75, y: 75 }, { x: 50, y: 100 }, { x: 25, y: 75 }],
            [{ x: 25, y: 75 }, { x: 50, y: 100 }, { x: 0, y: 100 }],
            [{ x: 0, y: 50 }, { x: 25, y: 75 }, { x: 0, y: 100 }],
            [{ x: 25, y: 25 }, { x: 50, y: 50 }, { x: 25, y: 75 }, { x: 0, y: 50 }],
            [{ x: 0, y: 0 }, { x: 25, y: 25 }, { x: 0, y: 50 }],
            [{ x: 0, y: 0 }, { x: 50, y: 0 }, { x: 25, y: 25 }]
        ];
    },

    getNorthIndianLineSegments(mapPoint) {
        const segments = [];
        const seen = new Set();
        const addSegment = (start, end, width = 1.5) => {
            const points = [`${start.x},${start.y}`, `${end.x},${end.y}`].sort();
            const key = points.join('|');
            if (seen.has(key)) return;
            seen.add(key);
            const p1 = mapPoint(start.x, start.y);
            const p2 = mapPoint(end.x, end.y);
            segments.push({ x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y, width });
        };

        const outerCorners = [
            { x: 0, y: 0 }, { x: 100, y: 0 },
            { x: 100, y: 100 }, { x: 0, y: 100 }
        ];
        outerCorners.forEach((corner, index) => addSegment(corner, outerCorners[(index + 1) % outerCorners.length], 2.2));

        this.getNorthIndianHousePaths().forEach((path) => {
            path.forEach((point, index) => addSegment(point, path[(index + 1) % path.length]));
        });

        return segments;
    },

    renderNorthIndianCanvasFrame(ctx, data, frameState = {}) {
        const dpr = window.devicePixelRatio || 1;
        const canvasWidth = ctx.canvas.width / dpr;
        const canvasHeight = ctx.canvas.height / dpr;
        const size = Math.min(canvasWidth, canvasHeight);
        const lineProgress = this.clamp01(frameState.lineProgress ?? 1);
        const labelOpacity = this.clamp01(frameState.labelOpacity ?? 1);
        const planetProgress = this.clamp01(frameState.planetProgress ?? 1);
        const pulse = Number(frameState.pulse || 0);

        ctx.clearRect(0, 0, canvasWidth, canvasHeight);

        const paperGrad = ctx.createRadialGradient(canvasWidth * 0.35, canvasHeight * 0.3, size * 0.1, canvasWidth / 2, canvasHeight / 2, size * 0.75);
        paperGrad.addColorStop(0, '#fbeec2');
        paperGrad.addColorStop(0.55, '#ecd497');
        paperGrad.addColorStop(1, '#c79a55');
        ctx.fillStyle = paperGrad;
        ctx.fillRect(0, 0, canvasWidth, canvasHeight);

        const seededUnit = (seed) => {
            const value = Math.sin(seed * 12.9898) * 43758.5453;
            return value - Math.floor(value);
        };
        ctx.save();
        ctx.globalAlpha = 0.055;
        for (let index = 0; index < 86; index++) {
            const speckleX = seededUnit(index + 1) * canvasWidth;
            const speckleY = seededUnit(index + 17) * canvasHeight;
            const speckleRadius = seededUnit(index + 33) * 1.25 + 0.25;
            ctx.fillStyle = seededUnit(index + 49) > 0.5 ? '#5a3b12' : '#3a2408';
            ctx.beginPath();
            ctx.arc(speckleX, speckleY, speckleRadius, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();

        const vignette = ctx.createRadialGradient(canvasWidth / 2, canvasHeight / 2, size * 0.3, canvasWidth / 2, canvasHeight / 2, size * 0.7);
        vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
        vignette.addColorStop(1, 'rgba(80, 40, 0, 0.22)');
        ctx.fillStyle = vignette;
        ctx.fillRect(0, 0, canvasWidth, canvasHeight);

        const lineColor = '#5a3a14';
        const textColor = '#3a2408';
        const mutedColor = '#7a5320';
        const ascColor = '#a3590d';
        const pad = Math.max(16, Math.round(size * 0.07));
        const innerX = pad;
        const innerY = pad;
        const innerW = canvasWidth - pad * 2;
        const innerH = canvasHeight - pad * 2;
        const mapPoint = (xp, yp) => ({
            x: innerX + (xp / 100) * innerW,
            y: innerY + (yp / 100) * innerH
        });

        const segments = this.getNorthIndianLineSegments(mapPoint);
        const segmentCursor = lineProgress * segments.length;
        segments.forEach((segment, index) => {
            this.drawAnimatedLineSegment(ctx, segment, segmentCursor - index, lineColor);
        });

        const housePositions = {
            1: { x: 50, y: 28 },
            2: { x: 78, y: 13 },
            3: { x: 90, y: 29 },
            4: { x: 78, y: 50 },
            5: { x: 90, y: 71 },
            6: { x: 78, y: 85 },
            7: { x: 50, y: 72 },
            8: { x: 22, y: 85 },
            9: { x: 10, y: 71 },
            10: { x: 22, y: 50 },
            11: { x: 10, y: 29 },
            12: { x: 22, y: 13 }
        };

        const totalPlanetMarkers = Object.values(data.planetsByHouse || {}).reduce((count, planets = []) => {
            return count + Math.min(planets.length, 3) + (planets.length > 3 ? 1 : 0);
        }, 0);
        let planetCursor = 0;

        for (let house = 1; house <= 12; house++) {
            const pos = housePositions[house];
            const sign = data.houseToSign[house];
            if (!pos || !sign) continue;

            const housePlanets = data.planetsByHouse[house] || [];
            const shortName = data.signShortNames[sign.name] || sign.name.substring(0, 3);
            const isAsc = house === 1;
            const point = mapPoint(pos.x, pos.y);

            ctx.save();
            ctx.globalAlpha = labelOpacity;
            ctx.fillStyle = isAsc ? ascColor : mutedColor;
            ctx.font = isAsc ? 'bold 11px Arial' : '10px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(`${sign.symbol} ${shortName}`, point.x, point.y - 8);

            if (isAsc) {
                ctx.fillStyle = ascColor;
                ctx.font = 'bold 8px Arial';
                ctx.fillText('Asc', point.x, point.y + 2);
            }
            ctx.restore();

            const visiblePlanets = housePlanets.slice(0, 3);
            const lowerHouse = pos.y >= 78;
            const planetBaseY = point.y + (lowerHouse ? -2 : (isAsc ? 15 : 9));
            const layoutOffsets = visiblePlanets.length <= 1
                ? [{ x: 0, y: 0 }]
                : visiblePlanets.length === 2
                    ? [{ x: -11, y: 0 }, { x: 11, y: 0 }]
                    : (lowerHouse
                        ? [{ x: -12, y: 0 }, { x: 12, y: 0 }, { x: 0, y: -22 }]
                        : [{ x: -12, y: 0 }, { x: 12, y: 0 }, { x: 0, y: 22 }]);

            visiblePlanets.forEach((planet, localIndex) => {
                planetCursor += 1;
                const reveal = this.clamp01(planetProgress * Math.max(totalPlanetMarkers, 1) - (planetCursor - 1));
                if (reveal <= 0) return;
                const offset = layoutOffsets[localIndex] || { x: 0, y: 0 };
                this.drawPlanetGlyphBadge(
                    ctx,
                    planet,
                    point.x + offset.x,
                    planetBaseY + offset.y,
                    reveal,
                    pulse + localIndex * 0.75 + house * 0.13,
                    { size: 18, labelSize: 6, labelColor: '#3a2408' }
                );
            });

            if (housePlanets.length > 3) {
                planetCursor += 1;
                const reveal = this.clamp01(planetProgress * Math.max(totalPlanetMarkers, 1) - (planetCursor - 1));
                if (reveal > 0) {
                    const moreY = planetBaseY + (lowerHouse ? -29 : 29);
                    ctx.save();
                    ctx.globalAlpha = reveal;
                    ctx.fillStyle = mutedColor;
                    ctx.font = '8px Arial';
                    ctx.textAlign = 'center';
                    ctx.fillText(`+${housePlanets.length - 3}`, point.x, moreY);
                    ctx.restore();
                }
            }
        }

        ctx.save();
        ctx.globalAlpha = 0.25 + labelOpacity * 0.75;
        ctx.fillStyle = textColor;
        ctx.font = 'bold 16px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('MAYA', innerX + innerW / 2, innerY + innerH / 2 + 5);
        ctx.restore();
    },

    animateNorthIndianCanvas(canvas, data, options = {}) {
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        this._chartAnimationFrames = this._chartAnimationFrames || {};
        if (this._chartAnimationFrames[canvas.id]) {
            cancelAnimationFrame(this._chartAnimationFrames[canvas.id]);
            delete this._chartAnimationFrames[canvas.id];
        }

        const duration = options.durationMs || 5200;
        const start = performance.now();

        const renderFrame = (now) => {
            if (!document.body.contains(canvas)) {
                delete this._chartAnimationFrames[canvas.id];
                return;
            }

            const progress = this.clamp01((now - start) / duration);
            const lineProgress = this.easeOutCubic(this.clamp01(progress / 0.42));
            const labelOpacity = this.easeOutCubic(this.clamp01((progress - 0.25) / 0.25));
            const planetProgress = this.easeOutCubic(this.clamp01((progress - 0.43) / 0.57));

            this.renderNorthIndianCanvasFrame(ctx, data, {
                lineProgress,
                labelOpacity,
                planetProgress,
                pulse: now * 0.006
            });

            this._chartAnimationFrames[canvas.id] = requestAnimationFrame(renderFrame);
        };

        this._chartAnimationFrames[canvas.id] = requestAnimationFrame(renderFrame);
    },

    /**
     * Draw North Indian chart on canvas (diamond style from template)
     */
    drawNorthIndianCanvas(canvasId, data, options = {}) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) {
            console.log('Canvas not found:', canvasId);
            return false;
        }

        console.log('Drawing North Indian chart on:', canvasId);

        // Set canvas to full width of container (HiDPI-aware)
        const container = canvas.parentElement;
        const size = container.offsetWidth || 400;
        const dpr = window.devicePixelRatio || 1;
        canvas.width = size * dpr;
        canvas.height = size * dpr;
        canvas.style.width = size + 'px';
        canvas.style.height = size + 'px';

        const ctx = canvas.getContext('2d');
        if (!ctx) return false;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        this._chartAnimationFrames = this._chartAnimationFrames || {};
        if (this._chartAnimationFrames[canvas.id]) {
            cancelAnimationFrame(this._chartAnimationFrames[canvas.id]);
            delete this._chartAnimationFrames[canvas.id];
        }

        const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
        if (options.animateFormation && !prefersReducedMotion) {
            this.animateNorthIndianCanvas(canvas, data, options);
        } else {
            this.renderNorthIndianCanvasFrame(ctx, data, {
                lineProgress: 1,
                labelOpacity: 1,
                planetProgress: 1
            });
        }

        return true;
    },

    /**
     * Generate chart based on style preference
     */
    generateChart(planets, ascendantSign, style = 'south', options = {}) {
        if (style === 'north') {
            return this.generateNorthIndianChart(planets, ascendantSign, options);
        }
        return this.generateSouthIndianChart(planets, ascendantSign, options);
    },

    /**
     * Group planets by zodiac sign for chart summaries and animated reveals.
     */
    groupPlanetsBySign(planets) {
        return MAYA_CONFIG.ZODIAC.SIGNS.map((sign) => {
            const signPlanets = planets
                .filter((planet) => planet.sign.name === sign.name)
                .map((planet) => ({
                    ...planet,
                    info: this.planetInfo[planet.name] || {}
                }));

            return {
                signName: sign.name,
                signSymbol: sign.symbol,
                shortName: this.signShortNames[sign.name] || sign.name.slice(0, 3),
                element: sign.element,
                planets: signPlanets
            };
        });
    },

    /**
     * Generate basic birth chart data
     */
    generateBirthChart(birthDate, birthTime, birthPlace, birthLat = null, birthLon = null, birthTimezone = null) {
        const resolvedContext = MayaAstrology.resolveBirthContext(birthDate, {
            birthTime,
            birthPlace,
            birthLat,
            birthLon,
            birthTimezone
        });
        const resolvedTime = resolvedContext.birthTime && resolvedContext.birthTime !== 'unknown' ? resolvedContext.birthTime : '12:00';
        const latitude = Number.isFinite(Number(resolvedContext.birthLat)) ? Number(resolvedContext.birthLat) : 0;
        const longitude = Number.isFinite(Number(resolvedContext.birthLon)) ? Number(resolvedContext.birthLon) : 0;
        const timezone = Number.isFinite(Number(resolvedContext.birthTimezone)) ? Number(resolvedContext.birthTimezone) : null;
        const ascendant = MayaAstrology.calculateAscendant(birthDate, resolvedTime, latitude, longitude, timezone);
        const planets = MayaAstrology.calculateBirthPlanets
            ? MayaAstrology.calculateBirthPlanets(birthDate, resolvedTime, latitude, longitude, timezone)
            : MayaAstrology.getCurrentPlanets();
        
        return {
            ascendant,
            planets,
            birthDate,
            birthTime: resolvedTime,
            birthPlace: birthPlace || resolvedContext.birthPlace || '',
            birthLat: latitude,
            birthLon: longitude,
            birthTimezone: timezone
        };
    },

    /**
     * Build a compact chart summary for the funnel and AI prompts.
     */
    summarizeBirthChart(birthChart) {
        if (!birthChart?.planets?.length) {
            return {
                planetGroups: [],
                yogaNames: [],
                highlights: []
            };
        }

        const planetGroups = this.groupPlanetsBySign(birthChart.planets);
        const elementCounts = {};
        birthChart.planets.forEach((planet) => {
            const element = planet.sign.element || 'Unknown';
            elementCounts[element] = (elementCounts[element] || 0) + 1;
        });

        const dominantElement = Object.entries(elementCounts)
            .sort(([, left], [, right]) => right - left)[0]?.[0] || birthChart.ascendant.element || 'Fire';

        const sun = birthChart.planets.find((planet) => planet.name === 'Sun');
        const moon = birthChart.planets.find((planet) => planet.name === 'Moon');
        const allYogas = this.calculateYogas(birthChart.planets, birthChart.ascendant.name)
            .filter((yoga) => yoga.name !== 'Analyzing...');
        // Only include yogas with "Very Strong" strength to avoid reporting common yogas to everyone
        const yogas = allYogas.filter((yoga) => yoga.strength === 'Very Strong');
        const moonPlanet = birthChart.planets.find((p) => p.name === 'Moon');
        const currentDasha = this.getCurrentDasha(birthChart.birthDate, moonPlanet?.sign?.name, moonPlanet?.degree);
        const groupedSigns = planetGroups
            .filter((group) => group.planets.length >= 2)
            .map((group) => `${group.signName} (${group.planets.map((planet) => planet.info.vedic || planet.name).join(', ')})`);

        return {
            ascendant: birthChart.ascendant,
            sunSign: sun?.sign?.name || '',
            moonSign: moon?.sign?.name || '',
            dominantElement,
            currentDasha,
            yogas,
            yogaNames: yogas.map((yoga) => yoga.name),
            planetGroups,
            highlights: [
                birthChart.ascendant?.name ? `${birthChart.ascendant.name} ascendant` : '',
                moon?.sign?.name ? `Moon in ${moon.sign.name}` : '',
                currentDasha?.vedic ? `${currentDasha.vedic} dasha active` : '',
                groupedSigns[0] ? `Planet cluster in ${groupedSigns[0]}` : '',
                yogas[0]?.name ? `${yogas[0].name} present in the chart` : ''
            ].filter(Boolean)
        };
    },

    /**
     * Get Dasha periods using proper Vimshottari system based on Moon's nakshatra.
     * @param {string} birthDate
     * @param {string} moonSign  - Moon's zodiac sign name e.g. 'Aries'
     * @param {number} moonDegree - Moon's degree within that sign (0-30)
     */
    getDashaPeriods(birthDate, moonSign, moonDegree) {
        const date = window.MayaAstrology ? MayaAstrology.parseDate(birthDate) : new Date(birthDate);
        if (!date) return [];

        // Vimshottari order and durations (years)
        const dashaOrder = ['Ketu', 'Venus', 'Sun', 'Moon', 'Mars', 'Rahu', 'Jupiter', 'Saturn', 'Mercury'];
        const dashaDurations = [7, 20, 6, 10, 7, 18, 16, 19, 17];
        const SIGN_NAMES = ['Aries','Taurus','Gemini','Cancer','Leo','Virgo','Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces'];
        const MS_PER_YEAR = 365.25 * 24 * 60 * 60 * 1000;

        // Determine first dasha from Moon nakshatra
        // 27 nakshatras × 13°20' each = 360°; nakshatra ruler = naksha % 9 maps to dashaOrder
        const NAK_SPAN = 360 / 27; // 13.333...°
        const signIdx = SIGN_NAMES.indexOf(moonSign);
        let firstDashaIdx = 0;
        let yearsElapsed = 0;

        if (signIdx >= 0 && moonDegree != null && !isNaN(Number(moonDegree))) {
            const moonLong = signIdx * 30 + Number(moonDegree);
            const nakIdx = Math.floor(moonLong / NAK_SPAN) % 27;
            firstDashaIdx = nakIdx % 9; // 0-8 into dashaOrder
            // How far Moon has advanced in this nakshatra → elapsed portion of first dasha
            const posInNak = moonLong % NAK_SPAN;
            const fractionElapsed = posInNak / NAK_SPAN;
            yearsElapsed = fractionElapsed * dashaDurations[firstDashaIdx];
        }

        // First dasha started (yearsElapsed) years before birth
        let currentMs = date.getTime() - yearsElapsed * MS_PER_YEAR;

        const periods = [];
        for (let i = 0; i < 9; i++) {
            const idx = (firstDashaIdx + i) % 9;
            const planet = dashaOrder[idx];
            const duration = dashaDurations[idx];
            const planetInfo = this.planetInfo[planet] || {};
            const startMs = currentMs;
            const endMs = currentMs + duration * MS_PER_YEAR;
            periods.push({
                planet,
                vedic: planetInfo.vedic || planet,
                symbol: planetInfo.symbol || '•',
                startYear: new Date(startMs).getFullYear(),
                endYear: new Date(endMs).getFullYear(),
                startMs,
                endMs,
                duration,
                nature: planetInfo.nature || 'Neutral'
            });
            currentMs = endMs;
        }

        return periods;
    },

    /**
     * Get current running Vimshottari Dasha.
     * @param {string} birthDate
     * @param {string} moonSign   - Moon's sign name
     * @param {number} moonDegree - Moon's degree within its sign
     */
    getCurrentDasha(birthDate, moonSign, moonDegree) {
        const periods = this.getDashaPeriods(birthDate, moonSign, moonDegree);
        if (!periods.length) return null;
        const now = Date.now();
        return periods.find(p => now >= p.startMs && now < p.endMs) || null;
    },

    /**
     * Infer likely marriage status from kundli data + age.
     * Uses 7th house lord, Venus position, dasha periods, and age heuristics.
     * Returns { likelyMarried: bool, confidence: 'high'|'medium'|'low', reasoning: string, marriageWindow: string }
     */
    inferMarriageStatus(birthChart, birthDate) {
        if (!birthChart?.planets?.length || !birthDate) {
            return { likelyMarried: false, confidence: 'low', reasoning: 'Insufficient data', marriageWindow: '' };
        }

        const parsedDate = window.MayaAstrology ? MayaAstrology.parseDate(birthDate) : new Date(birthDate);
        if (!parsedDate) return { likelyMarried: false, confidence: 'low', reasoning: 'Invalid birth date', marriageWindow: '' };

        const age = Math.floor((Date.now() - parsedDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
        const signs = MAYA_CONFIG?.ZODIAC?.SIGNS || [];
        const ascendant = birthChart.ascendant;
        const ascIndex = ascendant ? signs.findIndex(s => s.name === ascendant.name) : -1;

        // Find 7th house sign (opposite to ascendant)
        const seventhHouseSignIndex = ascIndex >= 0 ? (ascIndex + 6) % 12 : -1;
        const seventhHouseSign = seventhHouseSignIndex >= 0 ? signs[seventhHouseSignIndex] : null;

        // Find planets
        const venus = birthChart.planets.find(p => p.name === 'Venus');
        const jupiter = birthChart.planets.find(p => p.name === 'Jupiter');
        const saturn = birthChart.planets.find(p => p.name === 'Saturn');
        const rahu = birthChart.planets.find(p => p.name === 'Rahu');
        const mars = birthChart.planets.find(p => p.name === 'Mars');

        // Check planets in 7th house
        const planetsIn7th = seventhHouseSign
            ? birthChart.planets.filter(p => p.sign.name === seventhHouseSign.name)
            : [];

        // Dasha analysis -needs Moon's nakshatra for accurate Vimshottari
        const moonForMarriage = birthChart.planets.find(p => p.name === 'Moon');
        const dashas = this.getDashaPeriods(birthDate, moonForMarriage?.sign?.name, moonForMarriage?.degree);
        const nowMs = Date.now();
        const currentYear = new Date().getFullYear();
        const currentDasha = dashas.find(p => nowMs >= p.startMs && nowMs < p.endMs);

        // Venus dasha period (typical marriage trigger)
        const venusDasha = dashas.find(p => p.planet === 'Venus');
        const jupiterDasha = dashas.find(p => p.planet === 'Jupiter');

        let score = 0; // positive = likely married, negative = likely unmarried
        const reasons = [];

        // Age-based heuristic (Indian context)
        if (age >= 30) { score += 3; reasons.push(`age ${age} - statistically likely married`); }
        else if (age >= 26) { score += 1; reasons.push(`age ${age} - marriage-probable age`); }
        else if (age >= 22) { score -= 1; reasons.push(`age ${age} - could be either`); }
        else { score -= 3; reasons.push(`age ${age} - likely unmarried`); }

        // Venus dasha is a strong marriage indicator
        if (venusDasha) {
            if (age >= 18 && currentYear > venusDasha.startYear && currentYear >= venusDasha.startYear + 2) {
                score += 2;
                reasons.push(`Venus दशा (${venusDasha.startYear}-${venusDasha.endYear}) already running or passed - marriage trigger likely activated`);
            } else if (currentYear < venusDasha.startYear) {
                score -= 1;
                reasons.push(`Venus दशा hasn't started yet (starts ${venusDasha.startYear})`);
            }
        }

        // Jupiter dasha can also bring marriage
        if (jupiterDasha && currentYear > jupiterDasha.startYear + 2 && age >= 22) {
            score += 1;
            reasons.push(`Jupiter दशा (${jupiterDasha.startYear}-${jupiterDasha.endYear}) - auspicious for marriage`);
        }

        // Saturn in 7th = delayed marriage
        if (planetsIn7th.some(p => p.name === 'Saturn')) {
            score -= 2;
            reasons.push('शनि in 7th house - delays marriage');
        }

        // Rahu in 7th = unconventional or delayed
        if (planetsIn7th.some(p => p.name === 'Rahu')) {
            score -= 1;
            reasons.push('राहु in 7th house - unconventional relationship pattern');
        }

        // Mars in 7th (Manglik) = potential delay
        if (planetsIn7th.some(p => p.name === 'Mars')) {
            score -= 1;
            reasons.push('मंगल in 7th house (Manglik) - can delay marriage');
        }

        // Jupiter or Venus in 7th = early/happy marriage
        if (planetsIn7th.some(p => p.name === 'Jupiter' || p.name === 'Venus')) {
            score += 2;
            reasons.push(`${planetsIn7th.filter(p => p.name === 'Jupiter' || p.name === 'Venus').map(p => p.name).join('/')} in 7th house - strong marriage indicator`);
        }

        // Determine marriage window
        let marriageWindow = '';
        if (venusDasha) {
            marriageWindow = `${venusDasha.startYear}-${Math.min(venusDasha.startYear + 7, venusDasha.endYear)}`;
        }

        const likelyMarried = score >= 2;
        const confidence = Math.abs(score) >= 4 ? 'high' : Math.abs(score) >= 2 ? 'medium' : 'low';

        return {
            likelyMarried,
            confidence,
            reasoning: reasons.join('; '),
            marriageWindow,
            age,
            seventhHouseSign: seventhHouseSign?.name || '',
            planetsIn7th: planetsIn7th.map(p => p.name),
            venusSign: venus?.sign?.name || '',
            jupiterSign: jupiter?.sign?.name || ''
        };
    },

    /**
     * Compute the 7 Chara Karakas (Jaimini) by sorting the 7 non-nodal planets
     * (Sun, Moon, Mars, Mercury, Jupiter, Venus, Saturn) by their degree within
     * their sign in DESCENDING order. The planet with the highest degree becomes
     * the Atmakaraka (soul indicator), next is Amatyakaraka, and so on.
     *
     * Karaka signification (what each karaka indicates about life/relatives):
     *   AK  Atmakaraka      - Self, soul purpose, core life direction
     *   AmK Amatyakaraka    - Career, profession, mind, minister-like role
     *   BK  Bhratrukaraka   - Siblings (esp. younger), courage, short journeys
     *   MK  Matrukaraka     - Mother, emotional base, home, property
     *   PK  Putrakaraka     - Children, creativity, intelligence, progeny
     *   GK  Gnatikaraka     - Paternal relatives, obstacles, hidden adversaries, health
     *   DK  Darakaraka      - Spouse / life partner, marriage dynamics
     */
    calculateCharaKarakas(planets) {
        if (!Array.isArray(planets) || !planets.length) return null;

        const eligibleNames = ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn'];
        const contenders = planets
            .filter(p => eligibleNames.includes(p.name) && Number.isFinite(p.degree))
            .map(p => ({
                name: p.name,
                sign: p.sign?.name || '',
                degree: Number(p.degree) || 0,
                element: p.sign?.element || ''
            }));

        if (contenders.length < 7) return null;

        // Highest degree within a sign wins the top karaka slot.
        contenders.sort((a, b) => b.degree - a.degree);

        const roles = [
            { key: 'atmakaraka',    code: 'AK',  signifies: 'self, soul purpose, core life direction',        hindi: 'आत्मकारक (स्वयं)' },
            { key: 'amatyakaraka',  code: 'AmK', signifies: 'career, profession, mind',                      hindi: 'अमात्यकारक (करियर)' },
            { key: 'bhratrukaraka', code: 'BK',  signifies: 'siblings (esp. younger), courage, initiative',  hindi: 'भ्रातृकारक (भाई-बहन)' },
            { key: 'matrukaraka',   code: 'MK',  signifies: 'mother, emotional base, home, property',        hindi: 'मातृकारक (माँ)' },
            { key: 'putrakaraka',   code: 'PK',  signifies: 'children, creativity, intelligence',            hindi: 'पुत्रकारक (संतान)' },
            { key: 'gnatikaraka',   code: 'GK',  signifies: 'paternal relatives, obstacles, hidden enemies, health', hindi: 'ज्ञातिकारक (रिश्तेदार/अवरोध)' },
            { key: 'darakaraka',    code: 'DK',  signifies: 'spouse, life partner, marriage dynamics',       hindi: 'दाराकारक (जीवनसाथी)' }
        ];

        const result = {};
        roles.forEach((role, idx) => {
            const c = contenders[idx];
            result[role.key] = {
                code: role.code,
                planet: c.name,
                sign: c.sign,
                degree: Number(c.degree.toFixed(2)),
                element: c.element,
                signifies: role.signifies,
                hindi: role.hindi
            };
        });

        return result;
    },

    /**
     * Determine the user's age (from birthDate) and a normalized life stage
     * bucket so predictions stay age-appropriate (don't discuss retirement
     * with a 22-year-old, don't discuss college with a 55-year-old).
     */
    calculateLifeStage(birthDate) {
        const parsed = window.MayaAstrology ? MayaAstrology.parseDate(birthDate) : new Date(birthDate);
        if (!parsed || isNaN(parsed.getTime())) {
            return { age: null, stage: 'unknown', label: '', focusEn: '', focusHi: '' };
        }
        const age = Math.floor((Date.now() - parsed.getTime()) / (365.25 * 24 * 60 * 60 * 1000));

        let stage, label, focusEn, focusHi;
        if (age < 18) {
            stage = 'minor';
            label = 'Minor / formative years';
            focusEn = 'studies, parents (especially mother -Matrukaraka), siblings, early identity. Do NOT discuss marriage, career decisions, children, or money responsibilities.';
            focusHi = 'पढ़ाई, माता-पिता (खासकर माँ -मातृकारक), भाई-बहन, शुरुआती पहचान। शादी, career decisions, संतान, पैसे की जिम्मेदारी पर बात मत कीजिए।';
        } else if (age <= 25) {
            stage = 'young_adult';
            label = 'Young adult / identity formation';
            focusEn = 'education finishing, first job / direction finding, friendships, early romantic attachments, relationship with parents & siblings (BK/MK), identity questions (AK). Marriage only as a future window. No retirement, no talk of grown children.';
            focusHi = 'पढ़ाई पूरी होना, पहली job / दिशा खोजना, दोस्ती, शुरुआती relationship, माता-पिता & भाई-बहन से रिश्ता (BK/MK), खुद की पहचान (AK)। शादी सिर्फ future window के रूप में। Retirement, बड़े बच्चों की बात मत कीजिए।';
        } else if (age <= 32) {
            stage = 'early_career';
            label = 'Early career / marriage threshold';
            focusEn = 'career direction & first serious professional pivots (AmK), marriage decisions / partner (DK), sibling dynamics (BK), parents aging (MK, 9th/4th), money stabilisation, possible first child. Avoid retirement and empty-nest themes.';
            focusHi = 'career की दिशा और पहले serious professional बदलाव (AmK), शादी का फैसला / partner (DK), भाई-बहन की dynamics (BK), माता-पिता का उम्र बढ़ना (MK, 9th/4th), पैसे की stability, पहला बच्चा संभव। Retirement और empty-nest topics मत छेड़िए।';
        } else if (age <= 40) {
            stage = 'establishment';
            label = 'Establishment / family consolidation';
            focusEn = 'career peak-building, marriage texture (DK), children & creativity (PK), responsibilities toward aging parents (MK), property / home (4th), siblings\' shifting lives (BK), mid-life identity questions emerging (AK).';
            focusHi = 'career का पीक बनाना, शादी का texture (DK), बच्चे और creativity (PK), बूढ़े माता-पिता की जिम्मेदारी (MK), प्रॉपर्टी / घर (4th), भाई-बहन की बदलती ज़िंदगी (BK), mid-life identity के सवाल (AK)।';
        } else if (age <= 50) {
            stage = 'peak_responsibility';
            label = 'Peak responsibility / mid-life pivot';
            focusEn = 'career reinvention / plateau, marriage renegotiation (DK), teenage or young-adult children (PK), health of self & parents (GK, MK), legacy thoughts beginning, sibling support systems (BK), identity recalibration (AK).';
            focusHi = 'career reinvention / plateau, शादी की renegotiation (DK), teenage या young-adult बच्चे (PK), खुद और माता-पिता की health (GK, MK), legacy सोचने की शुरुआत, भाई-बहन का support (BK), पहचान की recalibration (AK)।';
        } else if (age <= 60) {
            stage = 'legacy';
            label = 'Legacy / reflection';
            focusEn = 'children\'s own lives (PK), spouse companionship (DK), possibly loss / distance from parents (MK), health watch (GK), semi-retirement direction, wisdom sharing, property & succession. Avoid framing them as starting fresh careers unless chart strongly supports.';
            focusHi = 'बच्चों की अपनी ज़िंदगी (PK), जीवनसाथी का साथ (DK), माता-पिता का दूर होना / न रहना (MK), health (GK), semi-retirement direction, अनुभव बाँटना, property & उत्तराधिकार। नए career की शुरुआत की बात तब तक मत कीजिए जब तक chart strongly support न करे।';
        } else {
            stage = 'wisdom';
            label = 'Wisdom / detachment';
            focusEn = 'health (GK), spouse (DK), grandchildren & descendants (PK), spiritual / moksha themes, peace of mind, passing on legacy. Do NOT give early-career, marriage-search, or child-birth predictions.';
            focusHi = 'health (GK), जीवनसाथी (DK), पोते-पोतियाँ / वंशज (PK), आध्यात्मिक / मोक्ष विषय, मन की शांति, विरासत सौंपना। शुरुआती career, शादी की खोज, या बच्चे होने की predictions मत दीजिए।';
        }

        return { age, stage, label, focusEn, focusHi };
    },

    /**
     * Build detailed kundli fact sheet for AI - includes exact planetary positions,
     * dasha timeline, 7th house analysis, and marriage inference.
     */
    buildDetailedChartFacts(birthChart, birthDate) {
        if (!birthChart?.planets?.length) return '';

        const lines = [];

        // Planetary positions with degrees
        lines.push('=== PLANETARY POSITIONS (Sidereal/Vedic) ===');
        birthChart.planets.forEach(p => {
            lines.push(`${p.name}: ${p.sign.name} ${p.degree.toFixed(1)}°`);
        });
        if (birthChart.ascendant?.name) {
            lines.push(`Ascendant (Lagna): ${birthChart.ascendant.name}`);
        }

        // Dasha timeline -use Moon's nakshatra for accurate Vimshottari calculation
        const moonPlanetFacts = birthChart.planets.find(p => p.name === 'Moon');
        const dashas = this.getDashaPeriods(birthDate, moonPlanetFacts?.sign?.name, moonPlanetFacts?.degree);
        const now = Date.now();
        const currentDasha = dashas.find(d => now >= d.startMs && now < d.endMs);
        const currentYear = new Date().getFullYear();
        const pastDashas = dashas.filter(d => d.endYear <= currentYear);
        const futureDashas = dashas.filter(d => d.startYear > currentYear);

        lines.push('\n=== DASHA TIMELINE (Vimshottari) ===');
        dashas.forEach(d => {
            const marker = (currentYear >= d.startYear && currentYear < d.endYear) ? ' ← CURRENT' : '';
            lines.push(`${d.vedic || d.planet} दशा: ${d.startYear}-${d.endYear} (${d.duration} years, ${d.nature})${marker}`);
        });

        // Past dasha transitions (key life event markers)
        if (pastDashas.length > 0) {
            lines.push('\n=== KEY PAST DASHA TRANSITIONS (life-changing periods) ===');
            pastDashas.forEach(d => {
                lines.push(`${d.vedic || d.planet} दशा ended ${d.endYear} - this marked a major life shift`);
            });
        }

        // 7th house analysis
        const marriage = this.inferMarriageStatus(birthChart, birthDate);
        lines.push('\n=== 7TH HOUSE & MARRIAGE ANALYSIS ===');
        lines.push(`7th house sign: ${marriage.seventhHouseSign || 'unknown'}`);
        lines.push(`Planets in 7th house: ${marriage.planetsIn7th.length ? marriage.planetsIn7th.join(', ') : 'none'}`);
        lines.push(`Venus in: ${marriage.venusSign}`);
        lines.push(`Jupiter in: ${marriage.jupiterSign}`);
        lines.push(`Marriage window (from दशा): ${marriage.marriageWindow || 'not determined'}`);
        lines.push(`Likely married: ${marriage.likelyMarried ? 'YES' : 'NO'} (confidence: ${marriage.confidence})`);
        lines.push(`Age: ${marriage.age}`);
        lines.push(`Marriage reasoning: ${marriage.reasoning}`);

        // Chara Karakas (Jaimini) - personal significators for self & key relatives
        const karakas = this.calculateCharaKarakas(birthChart.planets);
        if (karakas) {
            // House lookup (ascendant = house 1)
            const signs = MAYA_CONFIG?.ZODIAC?.SIGNS || [];
            const ascIndex = birthChart.ascendant ? signs.findIndex(s => s.name === birthChart.ascendant.name) : -1;
            const houseOf = (signName) => {
                if (ascIndex < 0) return null;
                const sIdx = signs.findIndex(s => s.name === signName);
                if (sIdx < 0) return null;
                return ((sIdx - ascIndex + 12) % 12) + 1;
            };

            lines.push('\n=== CHARA KARAKAS (Jaimini -who/what each planet signifies for THIS user) ===');
            lines.push('Use these to talk about the user and their key relatives with specificity.');
            Object.values(karakas).forEach(k => {
                const h = houseOf(k.sign);
                const houseStr = h ? ` (in house ${h} from lagna)` : '';
                lines.push(`${k.code} ${k.hindi}: ${k.planet} in ${k.sign} ${k.degree}°${houseStr} -signifies ${k.signifies}`);
            });
            lines.push('Correlation rule: the sign + house placement of each karaka describes the NATURE of that person/area in the user\'s life. Example: a Darakaraka in a fiery sign = spouse is assertive/independent; Matrukaraka afflicted by Saturn/Rahu = mother faces hardship or emotional distance; Putrakaraka in a strong house = creative/child-related fulfilment.');
        }

        // Life stage guidance (age-appropriate prediction framing)
        const lifeStage = this.calculateLifeStage(birthDate);
        if (lifeStage.age != null) {
            lines.push('\n=== LIFE STAGE (age-appropriate framing -CRITICAL) ===');
            lines.push(`Age: ${lifeStage.age} -Stage: ${lifeStage.label}`);
            lines.push(`Topic focus (EN): ${lifeStage.focusEn}`);
            lines.push(`विषय-फोकस (HI): ${lifeStage.focusHi}`);
            lines.push('RULE: Every prediction, remedy, and timing statement MUST match this life stage. Do NOT predict events that are biologically/socially implausible for this age (e.g., school admission for a 45-year-old, retirement for a 24-year-old, first child for a 68-year-old).');
        }

        // Yogas
        const yogas = this.calculateYogas(birthChart.planets, birthChart.ascendant?.name);
        const realYogas = yogas.filter(y => y.name !== 'Analyzing...');
        if (realYogas.length) {
            lines.push('\n=== YOGAS (planetary combinations) ===');
            realYogas.forEach(y => {
                lines.push(`${y.name} (${y.hindi}): ${y.description} [${y.strength}]`);
            });
        }

        return lines.join('\n');
    },

    /**
     * Calculate Yogas (planetary combinations)
     */
    calculateYogas(planets, ascendantSign) {
        const yogas = [];
        const signs = MAYA_CONFIG.ZODIAC.SIGNS;
        // IMPORTANT: ZODIAC.SIGNS is an array of objects {name, ...} -must compare by .name
        const signIndex = (signName) => signs.findIndex(s => s.name === signName);
        const signGap = (a, b) => {
            const ia = signIndex(a), ib = signIndex(b);
            if (ia < 0 || ib < 0) return -1; // unknown sign -no gap
            return (ia - ib + 12) % 12;
        };

        const planetPositions = {};
        const planetDegrees = {};
        planets.forEach(p => {
            planetPositions[p.name] = p.sign.name;
            planetDegrees[p.name] = p.degree;
        });

        const kendraGaps = [0, 3, 6, 9]; // 1st, 4th, 7th, 10th
        const trikonaGaps = [0, 4, 8]; // 1st, 5th, 9th

        // Gaja Kesari Yoga - Jupiter in kendra (1,4,7,10) from Moon
        // Only Very Strong when Jupiter is in EXACT same sign as Moon (conjunction)
        if (planetPositions['Jupiter'] && planetPositions['Moon']) {
            const gap = signGap(planetPositions['Jupiter'], planetPositions['Moon']);
            if (gap >= 0 && kendraGaps.includes(gap)) {
                // Conjunction (same sign) = Very Strong; other kendras = Medium at best
                // We only show as Very Strong for conjunction
                const strength = gap === 0 ? 'Very Strong' : 'Medium';
                yogas.push({
                    name: 'गजकेसरी योग',
                    hindi: 'गजकेसरी योग',
                    description: `Jupiter (${planetPositions['Jupiter']}) in kendra from Moon (${planetPositions['Moon']}) - wisdom, respect, financial stability`,
                    strength
                });
            }
        }

        // Budha Aditya Yoga - Sun-Mercury same sign
        if (planetPositions['Sun'] && planetPositions['Mercury'] && planetPositions['Sun'] === planetPositions['Mercury']) {
            const sunDeg = planetDegrees['Sun'] || 0;
            const mercDeg = planetDegrees['Mercury'] || 0;
            const orb = Math.abs(sunDeg - mercDeg);
            // Combust Mercury (within ~5°) weakens the yoga
            const strength = orb < 5 ? 'Weak (combust)' : orb < 12 ? 'Strong' : 'Medium';
            yogas.push({
                name: 'बुधादित्य योग',
                hindi: 'बुधादित्य योग',
                description: `Sun-Mercury conjunction in ${planetPositions['Sun']} (${orb.toFixed(1)}° apart) - sharp intellect, communication skill`,
                strength
            });
        }

        // Chandra Mangal Yoga - Moon-Mars same sign
        if (planetPositions['Moon'] && planetPositions['Mars'] && planetPositions['Moon'] === planetPositions['Mars']) {
            yogas.push({
                name: 'चन्द्र मंगल योग',
                hindi: 'चन्द्र मंगल योग',
                description: `Moon-Mars conjunction in ${planetPositions['Moon']} - strong willpower, wealth through effort`,
                strength: 'Medium'
            });
        }

        // Hamsa Yoga - Jupiter in kendra from Ascendant in own/exaltation sign
        if (ascendantSign && planetPositions['Jupiter']) {
            const jupSign = planetPositions['Jupiter'];
            const jupGap = signGap(jupSign, ascendantSign);
            const jupKendra = jupGap >= 0 && kendraGaps.includes(jupGap);
            const jupStrong = ['Sagittarius', 'Pisces', 'Cancer'].includes(jupSign);
            if (jupKendra && jupStrong) {
                yogas.push({
                    name: 'हंस योग',
                    hindi: 'हंस योग',
                    description: `Jupiter in ${jupSign} (own/exalted) in kendra from lagna - spirituality, fortune, noble character`,
                    strength: 'Strong'
                });
            }
        }

        // Malavya Yoga - Venus in kendra from Ascendant in own/exaltation sign
        if (ascendantSign && planetPositions['Venus']) {
            const venSign = planetPositions['Venus'];
            const venGap = signGap(venSign, ascendantSign);
            const venKendra = venGap >= 0 && kendraGaps.includes(venGap);
            const venStrong = ['Taurus', 'Libra', 'Pisces'].includes(venSign);
            if (venKendra && venStrong) {
                yogas.push({
                    name: 'मालव्य योग',
                    hindi: 'मालव्य योग',
                    description: `Venus in ${venSign} (own/exalted) in kendra - luxury, beauty, artistic talent, strong relationships`,
                    strength: 'Strong'
                });
            }
        }

        // Ruchaka Yoga - Mars in kendra from Ascendant in own/exaltation sign
        if (ascendantSign && planetPositions['Mars']) {
            const marsSign = planetPositions['Mars'];
            const marsGap = signGap(marsSign, ascendantSign);
            const marsKendra = marsGap >= 0 && kendraGaps.includes(marsGap);
            const marsStrong = ['Aries', 'Scorpio', 'Capricorn'].includes(marsSign);
            if (marsKendra && marsStrong) {
                yogas.push({
                    name: 'रुचक योग',
                    hindi: 'रुचक योग',
                    description: `Mars in ${marsSign} (own/exalted) in kendra - courage, leadership, victory over enemies`,
                    strength: 'Strong'
                });
            }
        }

        // Bhadra Yoga - Mercury in kendra from Ascendant in own/exaltation sign
        if (ascendantSign && planetPositions['Mercury']) {
            const mercSign = planetPositions['Mercury'];
            const mercGap = signGap(mercSign, ascendantSign);
            const mercKendra = mercGap >= 0 && kendraGaps.includes(mercGap);
            const mercStrong = ['Gemini', 'Virgo'].includes(mercSign);
            if (mercKendra && mercStrong) {
                yogas.push({
                    name: 'भद्र योग',
                    hindi: 'भद्र योग',
                    description: `Mercury in ${mercSign} (own/exalted) in kendra - sharp mind, business success, eloquence`,
                    strength: 'Strong'
                });
            }
        }

        // Shasha Yoga - Saturn in kendra from Ascendant in own/exaltation sign
        if (ascendantSign && planetPositions['Saturn']) {
            const satSign = planetPositions['Saturn'];
            const satGap = signGap(satSign, ascendantSign);
            const satKendra = satGap >= 0 && kendraGaps.includes(satGap);
            const satStrong = ['Capricorn', 'Aquarius', 'Libra'].includes(satSign);
            if (satKendra && satStrong) {
                yogas.push({
                    name: 'शश योग',
                    hindi: 'शश योग',
                    description: `Saturn in ${satSign} (own/exalted) in kendra - authority, discipline, lasting success`,
                    strength: 'Strong'
                });
            }
        }

        // Neecha Bhanga Raja Yoga - debilitated planet with cancellation
        const debilitationSigns = { Sun: 'Libra', Moon: 'Scorpio', Mars: 'Cancer', Mercury: 'Pisces', Jupiter: 'Capricorn', Venus: 'Virgo', Saturn: 'Aries' };
        const exaltationSigns = { Sun: 'Aries', Moon: 'Taurus', Mars: 'Capricorn', Mercury: 'Virgo', Jupiter: 'Cancer', Venus: 'Pisces', Saturn: 'Libra' };
        const signLords = { Aries: 'Mars', Taurus: 'Venus', Gemini: 'Mercury', Cancer: 'Moon', Leo: 'Sun', Virgo: 'Mercury', Libra: 'Venus', Scorpio: 'Mars', Sagittarius: 'Jupiter', Capricorn: 'Saturn', Aquarius: 'Saturn', Pisces: 'Jupiter' };

        for (const [planet, debSign] of Object.entries(debilitationSigns)) {
            if (planetPositions[planet] === debSign) {
                // Check if lord of debilitation sign is in kendra from Ascendant
                const lord = signLords[debSign];
                if (lord && planetPositions[lord] && ascendantSign) {
                    const lordGap = signGap(planetPositions[lord], ascendantSign);
                    if (lordGap >= 0 && kendraGaps.includes(lordGap)) {
                        yogas.push({
                            name: 'नीचभंग राजयोग',
                            hindi: 'नीचभंग राजयोग',
                            description: `${planet} debilitated in ${debSign} but ${lord} (sign lord) in kendra cancels it - rise after struggles, unexpected success`,
                            strength: 'Strong'
                        });
                        break; // only report first occurrence
                    }
                }
            }
        }

        // Dhana Yoga - lords of 2nd and 11th related
        if (ascendantSign && signIndex(ascendantSign) >= 0) {
            const ascIdx = signIndex(ascendantSign);
            const houseSignIndex = (houseNum) => (ascIdx + houseNum - 1) % 12;
            const secondSign = signs[houseSignIndex(2)]?.name;
            const eleventhSign = signs[houseSignIndex(11)]?.name;
            const lord2 = signLords[secondSign];
            const lord11 = signLords[eleventhSign];
            if (lord2 && lord11 && planetPositions[lord2] && planetPositions[lord11] && planetPositions[lord2] === planetPositions[lord11]) {
                yogas.push({
                    name: 'धन योग',
                    hindi: 'धन योग',
                    description: `2nd lord (${lord2}) and 11th lord (${lord11}) conjoined in ${planetPositions[lord2]} - strong wealth potential`,
                    strength: 'Medium'
                });
            }
        }

        // Viparita Raja Yoga - lords of 6th, 8th, 12th in each other's houses
        if (ascendantSign && signIndex(ascendantSign) >= 0) {
            const ascIdx2 = signIndex(ascendantSign);
            const houseSignIndex = (houseNum) => (ascIdx2 + houseNum - 1) % 12;
            const lord6 = signLords[signs[houseSignIndex(6)]?.name];
            const lord8 = signLords[signs[houseSignIndex(8)]?.name];
            const lord12 = signLords[signs[houseSignIndex(12)]?.name];
            const dusthanaLords = [lord6, lord8, lord12].filter(Boolean);
            const dusthanaSigns = [signs[houseSignIndex(6)]?.name, signs[houseSignIndex(8)]?.name, signs[houseSignIndex(12)]?.name].filter(Boolean);
            for (const lord of dusthanaLords) {
                if (planetPositions[lord] && dusthanaSigns.includes(planetPositions[lord]) && planetPositions[lord] !== signs[houseSignIndex(dusthanaLords.indexOf(lord) === 0 ? 6 : dusthanaLords.indexOf(lord) === 1 ? 8 : 12)]) {
                    yogas.push({
                        name: 'विपरीत राजयोग',
                        hindi: 'विपरीत राजयोग',
                        description: `Dusthana lord ${lord} placed in another dusthana house - gain through adversity, hidden blessings`,
                        strength: 'Medium'
                    });
                    break;
                }
            }
        }

        // Kemadruma Yoga (negative) - Moon with no planets in 2nd or 12th from it
        if (planetPositions['Moon']) {
            const moonIdx = signIndex(planetPositions['Moon']);
            const adjSigns = [signs[(moonIdx + 1) % 12], signs[(moonIdx + 11) % 12]];
            const adjPlanets = planets.filter(p => p.name !== 'Moon' && p.name !== 'Rahu' && p.name !== 'Ketu' && adjSigns.includes(p.sign.name));
            if (adjPlanets.length === 0) {
                // Check cancellation: planet in kendra from Moon or Lagna
                const moonKendraPlanets = planets.filter(p => p.name !== 'Moon' && p.name !== 'Rahu' && p.name !== 'Ketu' && kendraGaps.includes(signGap(p.sign.name, planetPositions['Moon'])));
                if (moonKendraPlanets.length === 0) {
                    yogas.push({
                        name: 'केमद्रुम योग',
                        hindi: 'केमद्रुम योग',
                        description: `Moon isolated in ${planetPositions['Moon']} with no support - periods of emotional loneliness, financial fluctuations`,
                        strength: 'Challenging'
                    });
                }
            }
        }

        if (yogas.length === 0) {
            yogas.push({
                name: 'Analyzing...',
                hindi: 'विश्लेषण...',
                description: 'Detailed yoga analysis requires precise birth time',
                strength: 'Pending'
            });
        }

        return yogas;
    },

    /**
     * Render Kundli page - returns HTML string
     */
    async renderKundliPage(profile, isHindi = false) {
        isHindi = false;

        if (!profile || !profile.birthDate) {
            return `
                <div class="maya-page maya-kundli-page">
                    <div class="maya-info-card maya-info-card--warning">
                        <div class="maya-info-card__icon"><i class="bi bi-exclamation-triangle"></i></div>
                        <div class="maya-info-card__content">
                            <h5>${isHindi ? 'जन्म विवरण आवश्यक' : 'Birth Details Required'}</h5>
                            <p>${isHindi ? 'कृपया अपनी कुंडली देखने के लिए प्रोफाइल में जन्म तिथि जोड़ें।' : 'Please add your birth date in profile to view your Kundli.'}</p>
                        </div>
                    </div>
                </div>
            `;
        }

        const hasExactBirthTime = !!(profile.birthTime && profile.birthTime !== 'unknown');
        const hasBirthCoordinates = Number.isFinite(Number(profile.birthLat)) && Number.isFinite(Number(profile.birthLon));
        const hasReliableAscendant = hasExactBirthTime && hasBirthCoordinates;
        const birthTimeInput = hasExactBirthTime ? profile.birthTime : 'unknown';

        const birthChart = this.generateBirthChart(
            profile.birthDate,
            birthTimeInput,
            profile.birthPlace || 'Unknown',
            profile.birthLat,
            profile.birthLon,
            profile.birthTimezone
        );

        const westernSign = MayaAstrology.getWesternZodiac(profile.birthDate)?.name || '';
        const moonSign = MayaAstrology.getVedicZodiac(profile.birthDate, {
            birthTime: birthTimeInput,
            birthPlace: profile.birthPlace || '',
            birthLat: profile.birthLat,
            birthLon: profile.birthLon,
            birthTimezone: profile.birthTimezone
        })?.name || birthChart.planets.find((planet) => planet.name === 'Moon')?.sign?.name || '';
        
        const moonForDasha = birthChart.planets.find(p => p.name === 'Moon');
        const currentDasha = this.getCurrentDasha(profile.birthDate, moonForDasha?.sign?.name, moonForDasha?.degree);
        const dashaPeriods = this.getDashaPeriods(profile.birthDate, moonForDasha?.sign?.name, moonForDasha?.degree);
        const yogas = this.calculateYogas(birthChart.planets, birthChart.ascendant.name);
        const inAppChartOptions = { animateFormation: true, durationMs: 5200 };
        const southChart = this.generateChart(birthChart.planets, birthChart.ascendant.name, 'south', inAppChartOptions);
        const northChart = this.generateChart(birthChart.planets, birthChart.ascendant.name, 'north', inAppChartOptions);

        // Format birth date
        const birthDateObj = MayaAstrology.parseDate(profile.birthDate);
        const formattedDate = birthDateObj ? birthDateObj.toLocaleDateString('en-IN', {
            day: 'numeric', month: 'long', year: 'numeric'
        }) : profile.birthDate;
        const localize = (value) => isHindi ? this.localizeHindiAstroText(value) : value;

        return `
            <div class="maya-page maya-kundli-page">
                <!-- Chart Style Toggle -->
                <div class="maya-kundli-toggle">
                    <button class="maya-kundli-toggle__btn maya-kundli-toggle__btn--active" data-style="north" onclick="MayaKundli.switchChart('north')">
                        ${isHindi ? 'उत्तर भारतीय' : 'North Indian'}
                    </button>
                    <button class="maya-kundli-toggle__btn" data-style="south" onclick="MayaKundli.switchChart('south')">
                        ${isHindi ? 'दक्षिण भारतीय' : 'South Indian'}
                    </button>
                </div>
                
                <!-- Chart Display -->
                <div class="maya-card maya-kundli-chart-card">
                    <div id="kundli-north-chart" class="maya-kundli-chart">
                        ${northChart}
                    </div>
                    <div id="kundli-south-chart" class="maya-kundli-chart" style="display: none;">
                        ${southChart}
                    </div>
                </div>
                
                <!-- Birth Details -->
                <div class="maya-card">
                    <h4 class="maya-card__title">${isHindi ? 'जन्म विवरण' : 'Birth Details'}</h4>
                    <div class="maya-kundli-details">
                        <div class="maya-kundli-detail">
                            <span class="maya-kundli-detail__label">${isHindi ? 'तिथि' : 'Date'}</span>
                            <span class="maya-kundli-detail__value">${formattedDate}</span>
                        </div>
                        <div class="maya-kundli-detail">
                            <span class="maya-kundli-detail__label">${isHindi ? 'समय' : 'Time'}</span>
                            <span class="maya-kundli-detail__value">${profile.birthTime || (isHindi ? 'अज्ञात' : 'Unknown')}</span>
                        </div>
                        <div class="maya-kundli-detail maya-kundli-detail--full">
                            <span class="maya-kundli-detail__label">${isHindi ? 'स्थान' : 'Place'}</span>
                            <span class="maya-kundli-detail__value">${profile.birthPlace || (isHindi ? 'अज्ञात' : 'Unknown')}</span>
                        </div>
                    </div>
                </div>
                
                ${hasReliableAscendant ? `
                <div class="maya-card">
                    <h4 class="maya-card__title">${isHindi ? 'लग्न (Ascendant)' : 'Ascendant (Lagna)'}</h4>
                    <div class="maya-kundli-ascendant">
                        <div class="maya-kundli-ascendant__symbol">
                            <img src="${birthChart.ascendant.image}" alt="${birthChart.ascendant.name}" class="maya-kundli-ascendant__img" onerror="this.style.display='none';this.nextElementSibling.style.display='block';">
                            <span style="display:none;">${birthChart.ascendant.symbol}</span>
                        </div>
                        <div class="maya-kundli-ascendant__info">
                            <h5>${birthChart.ascendant.name} <span class="maya-text-muted">(${birthChart.ascendant.hindi || ''})</span></h5>
                            <p>${birthChart.ascendant.element} Sign • Ruled by ${birthChart.ascendant.ruling || 'Mars'}</p>
                        </div>
                    </div>
                </div>
                ` : `
                <div class="maya-card">
                    <h4 class="maya-card__title">${isHindi ? 'विश्वसनीय राशियाँ' : 'Reliable Sign Markers'}</h4>
                    <div class="maya-kundli-details">
                        <div class="maya-kundli-detail">
                            <span class="maya-kundli-detail__label">${isHindi ? 'सूर्य राशि' : 'Sun Sign'}</span>
                            <span class="maya-kundli-detail__value">${westernSign || '--'}</span>
                        </div>
                        <div class="maya-kundli-detail">
                            <span class="maya-kundli-detail__label">${isHindi ? 'चंद्र राशि' : 'Moon Sign'}</span>
                            <span class="maya-kundli-detail__value">${moonSign || '--'}</span>
                        </div>
                        <div class="maya-kundli-detail maya-kundli-detail--full">
                            <span class="maya-kundli-detail__label">${isHindi ? 'लग्न' : 'Ascendant'}</span>
                            <span class="maya-kundli-detail__value">${isHindi ? 'Exact birth time के बिना lagna reliable नहीं है।' : 'Ascendant is not reliable without an exact birth time.'}</span>
                        </div>
                    </div>
                </div>
                `}
                
                <!-- Current Dasha -->
                ${currentDasha ? `
                <div class="maya-card">
                    <h4 class="maya-card__title">${isHindi ? 'वर्तमान महादशा' : 'Current Mahadasha'}</h4>
                    <div class="maya-kundli-dasha-current">
                        <div class="maya-kundli-dasha-current__planet">
                            <span class="maya-kundli-dasha-current__symbol">${currentDasha.symbol}</span>
                            <span class="maya-kundli-dasha-current__name">${localize(currentDasha.vedic)} ${isHindi ? 'दशा' : 'Dasha'}</span>
                        </div>
                        <div class="maya-kundli-dasha-current__period">
                            <span>${currentDasha.startYear} - ${currentDasha.endYear}</span>
                            <span class="maya-badge maya-badge--${currentDasha.nature === 'Benefic' ? 'success' : currentDasha.nature === 'Malefic' ? 'warning' : 'info'}">${currentDasha.duration} ${isHindi ? 'वर्ष' : 'years'}</span>
                        </div>
                    </div>
                    
                    <!-- All Dasha Periods -->
                    <div class="maya-kundli-dasha-list">
                        <h5>${isHindi ? 'सभी दशाएं' : 'All Dasha Periods'}</h5>
                        ${dashaPeriods.map(d => `
                            <div class="maya-kundli-dasha-item ${d.planet === currentDasha.planet ? 'maya-kundli-dasha-item--active' : ''}">
                                <span class="maya-kundli-dasha-item__planet">${d.symbol} ${localize(d.vedic)}</span>
                                <span class="maya-kundli-dasha-item__years">${d.startYear}-${d.endYear}</span>
                                <span class="maya-kundli-dasha-item__duration">${d.duration}y</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
                ` : ''}
                
                <!-- Planetary Positions -->
                <div class="maya-card">
                    <h4 class="maya-card__title">${isHindi ? 'ग्रह स्थिति' : 'Planetary Positions'}</h4>
                    <div class="maya-kundli-planets">
                        ${birthChart.planets.map(p => {
                            const info = this.planetInfo[p.name] || {};
                            const signIcon = this.signIcons[p.sign.name] || { abbr: '??', color: '#666' };
                            return `
                                <div class="maya-kundli-planet-row">
                                    <div class="maya-kundli-planet-row__planet">
                                        <span class="maya-kundli-planet-row__symbol" style="color: ${info.color || 'var(--maya-accent)'}">${info.symbol || p.symbol}</span>
                                        <span class="maya-kundli-planet-row__name">${localize(info.vedic || p.name)}</span>
                                    </div>
                                    <div class="maya-kundli-planet-row__sign">
                                        <span class="maya-kundli-planet-row__sign-icon" style="background: ${signIcon.color}">${signIcon.abbr}</span>
                                        <span>${localize(p.sign.name)}</span>
                                    </div>
                                    <div class="maya-kundli-planet-row__degree">
                                        ${p.degree}°
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
                
                <!-- Yogas -->
                <div class="maya-card">
                    <h4 class="maya-card__title">${isHindi ? 'योग' : 'Yogas (Planetary Combinations)'}</h4>
                    <div class="maya-kundli-yogas">
                        ${yogas.map(yoga => `
                            <div class="maya-kundli-yoga">
                                <div class="maya-kundli-yoga__header">
                                    <h5>${isHindi ? localize(yoga.name) : yoga.name}</h5>
                                    <span class="maya-badge maya-badge--${yoga.strength === 'Strong' ? 'success' : yoga.strength === 'Medium' ? 'warning' : 'info'}">${yoga.strength}</span>
                                </div>
                                <p class="maya-kundli-yoga__hindi">${yoga.hindi}</p>
                                <p class="maya-kundli-yoga__desc">${yoga.description}</p>
                            </div>
                        `).join('')}
                    </div>
                </div>
                
                <!-- House Meanings -->
                <div class="maya-card">
                    <h4 class="maya-card__title">${isHindi ? 'भाव (Houses)' : 'House Meanings'}</h4>
                    <div class="maya-kundli-houses">
                        ${Object.entries(this.houseMeanings).map(([num, house]) => `
                            <div class="maya-kundli-house-meaning">
                                <div class="maya-kundli-house-meaning__num">${num}</div>
                                <div class="maya-kundli-house-meaning__info">
                                    <span class="maya-kundli-house-meaning__name">${house.name} ${isHindi ? `(${house.hindi})` : ''}</span>
                                    <span class="maya-kundli-house-meaning__desc">${house.meaning}</span>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
    },

    /**
     * Switch between chart styles
     */
    switchChart(style) {
        const northChart = document.getElementById('kundli-north-chart');
        const southChart = document.getElementById('kundli-south-chart');
        const buttons = document.querySelectorAll('.maya-kundli-toggle__btn');
        
        buttons.forEach(btn => {
            btn.classList.remove('maya-kundli-toggle__btn--active');
        });
        
        const activeBtn = document.querySelector(`.maya-kundli-toggle__btn[data-style="${style}"]`);
        if (activeBtn) {
            activeBtn.classList.add('maya-kundli-toggle__btn--active');
        }
        
        if (style === 'north') {
            if (northChart) northChart.style.display = 'block';
            if (southChart) southChart.style.display = 'none';
        } else {
            if (northChart) northChart.style.display = 'none';
            if (southChart) southChart.style.display = 'block';
        }
        
        // Re-render any pending charts
        this.renderAllPendingCharts();
    },
    
    /**
     * Render all pending charts
     */
    renderAllPendingCharts() {
        if (!this._pendingCharts) return;
        
        Object.keys(this._pendingCharts).forEach(chartId => {
            this.renderPendingChart(chartId);
        });
    },
    
    /**
     * Initialize charts after page load
     */
    initCharts() {
        setTimeout(() => {
            this.renderAllPendingCharts();
        }, 100);
    }
};

// Make globally available
window.MayaKundli = MayaKundli;
