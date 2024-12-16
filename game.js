const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Set canvas size to window size
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

// Herní proměnné
let lives = 3;
let isInvincible = false;
let invincibilityTimer = 0;
const INVINCIBILITY_DURATION = 3000; // 3 sekundy
const RESPAWN_DURATION = 1000; // 1 sekunda pro respawn
let gameOver = false;
let gameLoopId;
let crystalCount = 0; // Počet sebraných krystalů
let lastShotTime = 0; // Čas posledního výstřelu
const SHOT_INTERVAL = 800; // 0.8 sekundy mezi výstřely

// Vlastnosti lodi
const ship = {
    x: canvas.width / 2,
    y: canvas.height - 100,  // Začíná ve spodní části
    rotation: -Math.PI / 2,  // Otočená nahoru
    velocity: { x: 0, y: 0 },
    acceleration: 0.1,
    rotationSpeed: 0.1,
    friction: 0.99,
    size: 20,  // Pro detekci kolizí
    visible: true
};

// Projektily
const projectiles = [];
class Projectile {
    constructor(x, y, rotation) {
        this.x = x;
        this.y = y;
        this.speed = 8;
        this.dx = Math.cos(rotation) * this.speed;
        this.dy = Math.sin(rotation) * this.speed;
        this.size = 3;
    }

    update() {
        this.x += this.dx;
        this.y += this.dy;
        return this.x < 0 || this.x > canvas.width || this.y < 0 || this.y > canvas.height;
    }

    draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fillStyle = '#ff0';
        ctx.fill();
    }
}

// Asteroidy
const asteroids = [];
class Asteroid {
    constructor(size = null, x = null, y = null, dx = null, dy = null) {
        if (size === null) {
            this.regenerate();
        } else {
            this.size = size;
            this.x = x;
            this.y = y;
            this.dx = dx;
            this.dy = dy;
            this.baseSpeed = 120 / this.size;
            this.vertices = this.generateVertices();
            this.rotation = Math.random() * Math.PI * 2;
            this.rotationSpeed = (Math.random() - 0.5) * 0.02;
            this.mass = Math.PI * this.size * this.size;
        }
        // Přidání health pointů podle velikosti
        this.maxHealth = Math.floor(this.size);
        this.health = this.maxHealth;
        this.cracks = []; // Seznam prasklin
    }

    regenerate() {
        const side = Math.floor(Math.random() * 4);
        this.size = 20 + Math.random() * 30;
        this.baseSpeed = 120 / this.size;
        
        switch(side) {
            case 0: // Horní strana
                this.x = Math.random() * canvas.width;
                this.y = -this.size;
                this.dx = (Math.random() - 0.5) * this.baseSpeed;
                this.dy = Math.random() * this.baseSpeed * 0.5 + this.baseSpeed * 0.5;
                break;
            case 1: // Pravá strana
                this.x = canvas.width + this.size;
                this.y = Math.random() * canvas.height;
                this.dx = -this.baseSpeed;
                this.dy = (Math.random() - 0.5) * this.baseSpeed;
                break;
            case 2: // Dolní strana
                this.x = Math.random() * canvas.width;
                this.y = canvas.height + this.size;
                this.dx = (Math.random() - 0.5) * this.baseSpeed;
                this.dy = -this.baseSpeed;
                break;
            case 3: // Levá strana
                this.x = -this.size;
                this.y = Math.random() * canvas.height;
                this.dx = this.baseSpeed;
                this.dy = (Math.random() - 0.5) * this.baseSpeed;
                break;
        }

        this.vertices = this.generateVertices();
        this.rotation = Math.random() * Math.PI * 2;
        this.rotationSpeed = (Math.random() - 0.5) * 0.02;
        this.mass = Math.PI * this.size * this.size;
        this.maxHealth = Math.floor(this.size);
        this.health = this.maxHealth;
        this.cracks = [];
    }

    generateVertices() {
        const vertices = [];
        const vertexCount = 6 + Math.floor(Math.random() * 3);
        
        for (let i = 0; i < vertexCount; i++) {
            const angle = (i / vertexCount) * Math.PI * 2;
            const radius = this.size * (0.8 + Math.random() * 0.4);
            vertices.push({
                x: Math.cos(angle) * radius,
                y: Math.sin(angle) * radius
            });
        }
        
        return vertices;
    }

    damage(amount) {
        this.health -= amount;
        if (this.health <= 0) {
            return this.destroy();
        }
        // Přidání nové praskliny
        this.addCrack();
        return false;
    }

    addCrack() {
        const crackCount = Math.floor((1 - this.health / this.maxHealth) * 5);
        while (this.cracks.length < crackCount) {
            const startVertex = Math.floor(Math.random() * this.vertices.length);
            const endVertex = (startVertex + 1 + Math.floor(Math.random() * (this.vertices.length - 2))) % this.vertices.length;
            this.cracks.push({
                start: startVertex,
                end: endVertex,
                offset: (Math.random() - 0.5) * this.size * 0.3
            });
        }
    }

    destroy() {
        if (this.size > 40) { // Velký asteroid
            for (let i = 0; i < 3; i++) {
                asteroids.push(new Asteroid(
                    this.size * 0.4,
                    this.x + (Math.random() - 0.5) * 20,
                    this.y + (Math.random() - 0.5) * 20,
                    this.dx + (Math.random() - 0.5) * 2,
                    this.dy + (Math.random() - 0.5) * 2
                ));
            }
        } else if (this.size > 25) { // Střední asteroid
            for (let i = 0; i < 2; i++) {
                asteroids.push(new Asteroid(
                    this.size * 0.6,
                    this.x + (Math.random() - 0.5) * 10,
                    this.y + (Math.random() - 0.5) * 10,
                    this.dx + (Math.random() - 0.5) * 1.5,
                    this.dy + (Math.random() - 0.5) * 1.5
                ));
            }
        } else { // Malý asteroid
            crystals.push(new Crystal(this.x, this.y));
        }
        return true;
    }

    isPointInside(px, py) {
        let inside = false;
        const transformedPoint = {
            x: (px - this.x) * Math.cos(-this.rotation) - (py - this.y) * Math.sin(-this.rotation),
            y: (px - this.x) * Math.sin(-this.rotation) + (py - this.y) * Math.cos(-this.rotation)
        };
        
        for (let i = 0, j = this.vertices.length - 1; i < this.vertices.length; j = i++) {
            const vi = this.vertices[i];
            const vj = this.vertices[j];
            
            if (((vi.y > transformedPoint.y) !== (vj.y > transformedPoint.y)) &&
                (transformedPoint.x < (vj.x - vi.x) * (transformedPoint.y - vi.y) / (vj.y - vi.y) + vi.x)) {
                inside = !inside;
            }
        }
        return inside;
    }

    update() {
        this.x += this.dx;
        this.y += this.dy;
        this.rotation += this.rotationSpeed;

        // Kontrola kolizí s ostatními asteroidy
        for (let other of asteroids) {
            if (other !== this && this.isPointInside(other.x, other.y)) {
                // Kolize asteroidů
                const dx = other.x - this.x;
                const dy = other.y - this.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                // Normalizované vektory směru
                const nx = dx / distance;
                const ny = dy / distance;
                
                // Relativní rychlost
                const dvx = other.dx - this.dx;
                const dvy = other.dy - this.dy;
                
                // Výpočet impulzu
                const impulse = 2 * (dvx * nx + dvy * ny) / (1/this.mass + 1/other.mass);
                
                // Aplikace impulzu
                this.dx += (impulse / this.mass) * nx;
                this.dy += (impulse / this.mass) * ny;
                other.dx -= (impulse / other.mass) * nx;
                other.dy -= (impulse / other.mass) * ny;
                
                // Mírné odrážení asteroidů od sebe
                const overlap = (this.size + other.size) * 0.7 - distance;
                if (overlap > 0) {
                    const pushX = (overlap * nx) / 2;
                    const pushY = (overlap * ny) / 2;
                    this.x -= pushX;
                    this.y -= pushY;
                    other.x += pushX;
                    other.y += pushY;
                }
            }
        }

        // Regenerace asteroidu, když opustí obrazovku
        if (
            this.x < -this.size * 2 || 
            this.x > canvas.width + this.size * 2 ||
            this.y < -this.size * 2 || 
            this.y > canvas.height + this.size * 2
        ) {
            this.regenerate();
        }
    }

    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);
        
        // Vykreslení základního tvaru
        ctx.beginPath();
        ctx.moveTo(this.vertices[0].x, this.vertices[0].y);
        for (let i = 1; i < this.vertices.length; i++) {
            ctx.lineTo(this.vertices[i].x, this.vertices[i].y);
        }
        ctx.closePath();
        
        // Barva asteroidu podle zdraví
        const healthPercent = this.health / this.maxHealth;
        const color = Math.floor(healthPercent * 64 + 32);
        ctx.fillStyle = `rgb(${color}, ${color}, ${color})`;
        ctx.fill();
        ctx.strokeStyle = '#606060';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Vykreslení prasklin
        if (this.cracks.length > 0) {
            ctx.beginPath();
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 1;
            for (const crack of this.cracks) {
                const start = this.vertices[crack.start];
                const end = this.vertices[crack.end];
                const controlX = (start.x + end.x) / 2 + crack.offset;
                const controlY = (start.y + end.y) / 2 + crack.offset;
                
                ctx.moveTo(start.x, start.y);
                ctx.quadraticCurveTo(controlX, controlY, end.x, end.y);
            }
            ctx.stroke();
        }
        
        ctx.restore();
    }
}

// Krystaly
const crystals = [];
class Crystal {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.size = 10;
        this.rotation = 0;
        this.rotationSpeed = 0.05;
        this.collectible = false;
        this.collectTimer = 1000; // 1 sekunda před možností sebrání
    }

    update() {
        this.rotation += this.rotationSpeed;
        if (!this.collectible) {
            this.collectTimer -= 16; // Přibližně 60 FPS
            if (this.collectTimer <= 0) {
                this.collectible = true;
            }
        }
    }

    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);
        
        ctx.beginPath();
        ctx.moveTo(0, -this.size);
        ctx.lineTo(this.size, 0);
        ctx.lineTo(0, this.size);
        ctx.lineTo(-this.size, 0);
        ctx.closePath();
        
        ctx.fillStyle = this.collectible ? '#5ff' : '#2aa';
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;
        ctx.stroke();
        
        ctx.restore();
    }
}

// Inicializace asteroidů
function initAsteroids() {
    asteroids.length = 0;  // Vyčištění pole
    for (let i = 0; i < 10; i++) {
        asteroids.push(new Asteroid());
    }
}

// Detekce kolize
function checkCollision(asteroid) {
    // Kontrola kolize lodi s asteroidem pomocí přesné detekce
    const shipPoints = [
        { x: ship.x + Math.cos(ship.rotation) * ship.size,
          y: ship.y + Math.sin(ship.rotation) * ship.size },
        { x: ship.x + Math.cos(ship.rotation + 2.6) * (ship.size * 0.8),
          y: ship.y + Math.sin(ship.rotation + 2.6) * (ship.size * 0.8) },
        { x: ship.x + Math.cos(ship.rotation - 2.6) * (ship.size * 0.8),
          y: ship.y + Math.sin(ship.rotation - 2.6) * (ship.size * 0.8) }
    ];

    return shipPoints.some(point => asteroid.isPointInside(point.x, point.y));
}

// Zpracování kolize
function handleCollision(asteroid) {
    if (isInvincible) return; // Ochrana před opakovanou kolizí během nesmrtelnosti

    // Okamžitá aktivace nesmrtelnosti
    isInvincible = true;
    invincibilityTimer = Date.now();

    // Vytvoření exploze na místě kolize
    currentExplosion = new Explosion(ship.x, ship.y);
    ship.visible = false;
    
    // Odebrání života pouze pokud ještě nějaké jsou
    if (lives > 0) {
        lives--;
        
        // Log pro ztrátu života
        console.log(`Život ztracen! Zbývající životy: ${lives}`);
        
        if (lives <= 0) {
            console.log('Hra skončena - žádné životy nezbyly');
            
            // Vytvoř dramatičtější finální explozi
            const finalExplosion = new Explosion(ship.x, ship.y);
            finalExplosion.duration = 2000; // Delší trvání
            finalExplosion.particles = finalExplosion.particles.map(particle => ({
                ...particle,
                dx: particle.dx * 2, // Větší rychlost rozptylu
                dy: particle.dy * 2,
                size: particle.size * 2, // Větší velikost částic
            }));
            
            currentExplosion = finalExplosion;
            
            // Počkej na dokončení animace exploze před game over
            setTimeout(() => {
                gameOver = true;
                cancelAnimationFrame(gameLoopId);
            }, finalExplosion.duration);
        } else {
            // Respawn na počáteční pozici s dočasnou nesmrtelností
            setTimeout(() => {
                ship.x = canvas.width / 2;
                ship.y = canvas.height - 100;
                ship.velocity = { x: 0, y: 0 };
                ship.rotation = -Math.PI / 2;
                ship.visible = true;
                // Obnovení nesmrtelnosti po respawnu
                isInvincible = true;
                invincibilityTimer = Date.now();
            }, RESPAWN_DURATION);
        }
    }
}

// Funkce pro nalezení bezpečného místa pro teleportaci
function findSafeSpot() {
    const margin = 100; // Minimální vzdálenost od okrajů
    const minDistanceFromAsteroids = 150; // Minimální vzdálenost od asteroidů
    
    for (let attempts = 0; attempts < 50; attempts++) {
        let x = margin + Math.random() * (canvas.width - 2 * margin);
        let y = margin + Math.random() * (canvas.height - 2 * margin);
        
        // Kontrola vzdálenosti od všech asteroidů
        let isSafe = true;
        for (const asteroid of asteroids) {
            const dx = x - asteroid.x;
            const dy = y - asteroid.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance < minDistanceFromAsteroids) {
                isSafe = false;
                break;
            }
        }
        
        if (isSafe) {
            return { x, y };
        }
    }
    
    // Pokud nenajdeme bezpečné místo, vrátíme výchozí pozici
    return {
        x: canvas.width / 2,
        y: canvas.height - 100
    };
}

// Vykreslení životů
function drawLives() {
    const spacing = 30;
    const startX = 20;
    const startY = 30;
    
    for (let i = 0; i < lives; i++) {
        ctx.save();
        ctx.translate(startX + i * spacing, startY);
        ctx.scale(0.5, 0.5);
        ctx.rotate(-Math.PI / 2);
        
        ctx.beginPath();
        ctx.moveTo(20, 0);
        ctx.lineTo(-10, -10);
        ctx.lineTo(-10, 10);
        ctx.closePath();
        
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        ctx.restore();
    }
}

// Stars background
const stars = Array(200).fill().map(() => ({
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height,
    size: Math.random() * 2,
    speed: 0.1 + Math.random() * 0.3,
    angle: Math.random() * Math.PI * 2,  // Úhel pro kruhový pohyb
    radius: Math.random() * 1,  // Poloměr kruhového pohybu
    twinkleSpeed: 0.5 + Math.random() * 1.5  // Individuální rychlost pulzování
}));

// Draw the stars with enhanced animation
function drawStars() {
    const time = Date.now() * 0.001; // Čas pro animaci
    
    ctx.fillStyle = 'white';
    stars.forEach(star => {
        // Základní pohyb hvězd v závislosti na pohybu lodě
        star.x -= (ship.velocity.x * star.speed * 0.3);
        star.y -= (ship.velocity.y * star.speed * 0.3);
        
        // Přidání kruhového pohybu
        const circleX = Math.cos(time * star.speed + star.angle) * star.radius;
        const circleY = Math.sin(time * star.speed + star.angle) * star.radius;
        
        // Aplikace kruhového pohybu
        const finalX = star.x + circleX;
        const finalY = star.y + circleY;
        
        // Wrap hvězd kolem obrazovky
        if (star.x < 0) star.x = canvas.width;
        if (star.x > canvas.width) star.x = 0;
        if (star.y < 0) star.y = canvas.height;
        if (star.y > canvas.height) star.y = 0;
        
        // Vylepšené pulzování hvězd
        const twinkle = 0.6 + Math.sin(time * star.twinkleSpeed) * 0.4;
        
        // Vykreslení hvězdy s efektem záře
        const gradient = ctx.createRadialGradient(
            finalX, finalY, 0,
            finalX, finalY, star.size * 2
        );
        gradient.addColorStop(0, `rgba(255, 255, 255, ${twinkle})`);
        gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
        
        ctx.beginPath();
        ctx.arc(finalX, finalY, star.size * 2, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();
    });
}

// Flame animation properties
let thrustPower = 0;  // Pro plynulou animaci plamene
const THRUST_MAX = 1.0;
const THRUST_INCREASE_SPEED = 0.1;
const THRUST_DECREASE_SPEED = 0.05;

// Draw the spaceship
function drawShip() {
    ctx.save();
    ctx.translate(ship.x, ship.y);
    ctx.rotate(ship.rotation);
    
    // Loď
    ctx.beginPath();
    ctx.moveTo(20, 0);
    ctx.lineTo(-10, -10);
    ctx.lineTo(-10, 10);
    ctx.closePath();
    
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // Vylepšený efekt plamene s plynulou animací
    if (keys.up || keys.space) {
        thrustPower = Math.min(thrustPower + THRUST_INCREASE_SPEED, THRUST_MAX);
    } else {
        thrustPower = Math.max(thrustPower - THRUST_DECREASE_SPEED, 0);
    }
    
    if (thrustPower > 0) {
        // Základní plamen
        const baseFlameLength = 15;
        const flameLength = baseFlameLength + (Math.random() * 10 * thrustPower);
        const flameWidth = 6 * thrustPower;
        
        // Vnitřní plamen (žlutý)
        ctx.beginPath();
        ctx.moveTo(-10, 0);
        ctx.lineTo(-10 - flameLength * 0.7, -flameWidth);
        ctx.lineTo(-10 - flameLength - 5, 0);
        ctx.lineTo(-10 - flameLength * 0.7, flameWidth);
        ctx.closePath();
        ctx.fillStyle = `rgba(255, 255, 0, ${0.8 * thrustPower})`;
        ctx.fill();
        
        // Vnější plamen (oranžový)
        ctx.beginPath();
        ctx.moveTo(-10, -3);
        ctx.lineTo(-10 - flameLength - 8, -flameWidth - 2);
        ctx.lineTo(-10 - flameLength - 15, 0);
        ctx.lineTo(-10 - flameLength - 8, flameWidth + 2);
        ctx.lineTo(-10, 3);
        ctx.closePath();
        ctx.fillStyle = `rgba(255, 69, 0, ${0.7 * thrustPower})`;
        ctx.fill();
        
        // Přidání jisker
        for (let i = 0; i < 3; i++) {
            const sparkX = -10 - flameLength - Math.random() * 10;
            const sparkY = (Math.random() - 0.5) * flameWidth * 2;
            const sparkSize = Math.random() * 2 * thrustPower;
            
            ctx.beginPath();
            ctx.arc(sparkX, sparkY, sparkSize, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255, 200, 0, 0.8)';
            ctx.fill();
        }
    }
    
    ctx.restore();
}

// Update game state
function update() {
    if (gameOver) return;

    // Aktualizace projektilů
    updateProjectiles();

    // Automatická střelba
    autoShoot();

    // Aktualizace asteroidů
    updateAsteroids();

    // Aktualizace krystalů
    updateCrystals();

    // Přidávání nových asteroidů
    addAsteroids();

    // Rotate ship
    if (keys.left) ship.rotation -= ship.rotationSpeed;
    if (keys.right) ship.rotation += ship.rotationSpeed;
    
    // Accelerate ship
    if (keys.up || keys.space) {
        ship.velocity.x += Math.cos(ship.rotation) * ship.acceleration;
        ship.velocity.y += Math.sin(ship.rotation) * ship.acceleration;
    }
    
    // Apply friction
    ship.velocity.x *= ship.friction;
    ship.velocity.y *= ship.friction;
    
    // Update position
    ship.x += ship.velocity.x;
    ship.y += ship.velocity.y;
    
    // Wrap around screen
    if (ship.x > canvas.width) ship.x = 0;
    if (ship.x < 0) ship.x = canvas.width;
    if (ship.y > canvas.height) ship.y = 0;
    if (ship.y < 0) ship.y = canvas.height;

    // Kontrola nesmrtelnosti
    if (isInvincible && Date.now() - invincibilityTimer > INVINCIBILITY_DURATION) {
        isInvincible = false;
    }
}

// Game controls state
const keys = {
    up: false,
    left: false,
    right: false,
    space: false
};

// Event listeners for controls
window.addEventListener('keydown', (e) => {
    switch(e.key.toLowerCase()) {
        case 'w':
        case 'arrowup':
            keys.up = true;
            break;
        case 'a':
        case 'arrowleft':
            keys.left = true;
            break;
        case 'd':
        case 'arrowright':
            keys.right = true;
            break;
        case ' ':
            keys.space = true;
            break;
    }
});

window.addEventListener('keyup', (e) => {
    switch(e.key.toLowerCase()) {
        case 'w':
        case 'arrowup':
            keys.up = false;
            break;
        case 'a':
        case 'arrowleft':
            keys.left = false;
            break;
        case 'd':
        case 'arrowright':
            keys.right = false;
            break;
        case ' ':
            keys.space = false;
            break;
    }
});

// Herní smyčka
function gameLoop() {
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    drawStars();
    
    // Vykreslení projektilů
    for (const projectile of projectiles) {
        projectile.draw();
    }
    
    // Vykreslení krystalů
    for (const crystal of crystals) {
        crystal.draw();
    }
    
    // Vykreslení asteroidů
    for (const asteroid of asteroids) {
        asteroid.draw();
    }
    
    // Vykreslení výbuchu
    if (currentExplosion) {
        currentExplosion.draw();
        if (!currentExplosion.update()) {
            currentExplosion = null;
        }
    }
    
    // Vykreslení lodi
    if (ship.visible) {
        if (!isInvincible || Math.floor(Date.now() / 200) % 2) {
            drawShip();
        }
    }
    
    // Vykreslení UI
    drawUI();
    
    // Game Over obrazovka
    if (gameOver) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        ctx.fillStyle = 'white';
        ctx.font = '48px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Game Over', canvas.width / 2, canvas.height / 2);
        
        ctx.font = '24px Arial';
        ctx.fillText('Stiskni ENTER pro restart', canvas.width / 2, canvas.height / 2 + 50);
    } else {
        update();
        requestAnimationFrame(gameLoop);
    }
}

// Vykreslení UI
function drawUI() {
    // Vykreslení životů
    const spacing = 30;
    const startX = 20;
    const startY = 30;
    
    for (let i = 0; i < lives; i++) {
        ctx.save();
        ctx.translate(startX + i * spacing, startY);
        ctx.scale(0.5, 0.5);
        ctx.rotate(-Math.PI / 2);
        
        ctx.beginPath();
        ctx.moveTo(20, 0);
        ctx.lineTo(-10, -10);
        ctx.lineTo(-10, 10);
        ctx.closePath();
        
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        ctx.restore();
    }
    
    // Vykreslení počtu krystalů
    ctx.fillStyle = '#fff';
    ctx.font = '20px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(`Krystaly: ${crystalCount}`, 10, 70);
}

// Třída pro animaci výbuchu
class Explosion {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.particles = [];
        this.duration = 1000; // 1 sekunda
        this.startTime = Date.now();
        
        // Vytvoření většího počtu částic s lepším rozptylem
        const particleCount = 100; // Zvýšení počtu částic
        for (let i = 0; i < particleCount; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 3 + Math.random() * 6; // Vyšší rychlost
            const size = 1 + Math.random() * 5; // Větší variabilita velikosti
            this.particles.push({
                x: x,
                y: y,
                dx: Math.cos(angle) * speed,
                dy: Math.sin(angle) * speed,
                size: size,
                alpha: 1,
                initialSize: size,
                color: this.getRandomExplosionColor() // Přidání barevnosti
            });
        }
    }

    // Metoda pro náhodné barvy exploze
    getRandomExplosionColor() {
        const colors = [
            'rgba(255, 100, 0, ', // oranžová
            'rgba(255, 200, 0, ',  // žlutá
            'rgba(255, 50, 0, ',   // tmavě červená
            'rgba(255, 150, 50, ', // světle oranžová
            'rgba(255, 0, 0, ',    // jasně červená
            'rgba(255, 165, 0, '   // tmavě oranžová
        ];
        return colors[Math.floor(Math.random() * colors.length)];
    }

    update() {
        const progress = (Date.now() - this.startTime) / this.duration;
        
        if (progress >= 1) {
            return false;
        }

        this.particles.forEach(particle => {
            particle.x += particle.dx;
            particle.y += particle.dy;
            
            // Plynulé zmenšování a blednutí
            particle.alpha = 1 - progress;
            particle.size = particle.initialSize * (1 - progress);
            
            // Zpomalení pohybu
            particle.dx *= 0.95;
            particle.dy *= 0.95;
        });

        return true;
    }

    draw() {
        this.particles.forEach(particle => {
            ctx.beginPath();
            ctx.arc(particle.x, particle.y, Math.max(0.1, particle.size), 0, Math.PI * 2);
            ctx.fillStyle = `${particle.color}${particle.alpha})`;
            ctx.fill();
        });
    }
}

let currentExplosion = null;

// Aktualizace a vykreslení asteroidů
function updateAsteroids() {
    for (const asteroid of asteroids) {
        asteroid.update();
        
        // Wrap around pro asteroidy
        if (asteroid.x < -asteroid.size) asteroid.x = canvas.width + asteroid.size;
        if (asteroid.x > canvas.width + asteroid.size) asteroid.x = -asteroid.size;
        if (asteroid.y < -asteroid.size) asteroid.y = canvas.height + asteroid.size;
        if (asteroid.y > canvas.height + asteroid.size) asteroid.y = -asteroid.size;
        
        if (checkCollision(asteroid)) {
            handleCollision(asteroid);
        }
    }
}

// Aktualizace projektilů
function updateProjectiles() {
    for (let i = projectiles.length - 1; i >= 0; i--) {
        if (projectiles[i].update()) {
            projectiles.splice(i, 1);
            continue;
        }
        
        // Kontrola kolize projektilu s asteroidy
        for (let j = asteroids.length - 1; j >= 0; j--) {
            if (asteroids[j].isPointInside(projectiles[i].x, projectiles[i].y)) {
                if (asteroids[j].damage(10)) { // Pokud je asteroid zničen
                    asteroids.splice(j, 1);
                }
                projectiles.splice(i, 1);
                break;
            }
        }
    }
}

// Automatická střelba
function autoShoot() {
    const currentTime = Date.now();
    if (currentTime - lastShotTime >= SHOT_INTERVAL) {
        projectiles.push(new Projectile(
            ship.x + Math.cos(ship.rotation) * ship.size,
            ship.y + Math.sin(ship.rotation) * ship.size,
            ship.rotation
        ));
        lastShotTime = currentTime;
    }
}

// Aktualizace krystalů
function updateCrystals() {
    for (let i = crystals.length - 1; i >= 0; i--) {
        crystals[i].update();
        if (crystals[i].collectible) {
            const dx = crystals[i].x - ship.x;
            const dy = crystals[i].y - ship.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance < ship.size + crystals[i].size) {
                crystalCount++;
                crystals.splice(i, 1);
            }
        }
    }
}

// Přidávání nových asteroidů postupně
function addAsteroids() {
    const currentTime = Date.now();
    if (!gameOver && asteroids.length < 20 && currentTime - lastAsteroidSpawn > 5000) {
        asteroids.push(new Asteroid());
        lastAsteroidSpawn = currentTime;
    }
}

// Inicializace hry
let lastAsteroidSpawn = Date.now();
initAsteroids();

// Přidání počáteční nesmrtelnosti
isInvincible = true;
invincibilityTimer = Date.now();

gameLoop();

// Event listener pro restart hry
window.addEventListener('keydown', (e) => {
    if (gameOver && e.key === 'Enter') {
        resetGame();
    }
});

// Reset hry
function resetGame() {
    lives = 3;
    gameOver = false;
    ship.visible = true;
    ship.x = canvas.width / 2;
    ship.y = canvas.height - 100;
    ship.rotation = -Math.PI / 2;
    ship.velocity.x = 0;
    ship.velocity.y = 0;
    crystalCount = 0;
    projectiles.length = 0;
    crystals.length = 0;
    
    // Obnovení počáteční nesmrtelnosti
    isInvincible = true;
    invincibilityTimer = Date.now();
    
    initAsteroids();
    gameLoop();
}
