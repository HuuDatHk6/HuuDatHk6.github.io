import * as THREE from 'three';

// --- Scene Setup ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87CEEB); // Sky blue

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.z = 15; // Move camera back

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// --- Lighting ---
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);
const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
directionalLight.position.set(5, 10, 7.5);
scene.add(directionalLight);

// --- Game Elements ---
const birdGeometry = new THREE.BoxGeometry(1, 0.8, 1.2); // Slightly elongated
const birdMaterial = new THREE.MeshStandardMaterial({ color: 0xffff00 }); // Yellow
const birdMesh = new THREE.Mesh(birdGeometry, birdMaterial);
birdMesh.position.x = -5; // Start position
scene.add(birdMesh);

const groundGeometry = new THREE.BoxGeometry(100, 2, 10); // Wide and thin
const groundMaterial = new THREE.MeshStandardMaterial({ color: 0x8B4513 }); // Brown
const groundMesh = new THREE.Mesh(groundGeometry, groundMaterial);
groundMesh.position.y = -8; // Position below the bird's starting point
scene.add(groundMesh);

const pipeMaterial = new THREE.MeshStandardMaterial({ color: 0x008000 }); // Green
const pipes = [];
const pipeWidth = 2;
const pipeHeight = 15; // Total height of a *single* pipe section
const pipeDepth = 2;
const pipeGap = 5; // Vertical gap between pipes

// --- Game State & Physics ---
let gameState = 'start'; // 'start', 'playing', 'gameOver'
let score = 0;
const gravity = -0.03;
const flapStrength = 0.5;
let birdVelocityY = 0;
const pipeSpeed = -0.1;
const pipeSpawnInterval = 150; // Lower number = more frequent pipes
let frameCount = 0; // Used for spawn timing

// --- UI Elements ---
const scoreElement = document.getElementById('score');
const messageElement = document.getElementById('message');

// --- Collision Detection Boxes ---
const birdBox = new THREE.Box3();
const pipeTopBox = new THREE.Box3();
const pipeBottomBox = new THREE.Box3();
const groundBox = new THREE.Box3();
groundBox.setFromObject(groundMesh); // Ground box doesn't change

// --- Functions ---

function createPipePair() {
    const totalPipeHeight = pipeHeight * 2 + pipeGap;
    const randomOffset = (Math.random() - 0.5) * (pipeHeight - 2); // Randomize vertical position, ensure gap stays reasonable
    const gapCenterY = randomOffset;

    // Top Pipe
    const topPipeGeometry = new THREE.BoxGeometry(pipeWidth, pipeHeight, pipeDepth);
    const topPipeMesh = new THREE.Mesh(topPipeGeometry, pipeMaterial);
    topPipeMesh.position.x = 25; // Start off-screen right
    topPipeMesh.position.y = gapCenterY + pipeGap / 2 + pipeHeight / 2;
    scene.add(topPipeMesh);

    // Bottom Pipe
    const bottomPipeGeometry = new THREE.BoxGeometry(pipeWidth, pipeHeight, pipeDepth);
    const bottomPipeMesh = new THREE.Mesh(bottomPipeGeometry, pipeMaterial);
    bottomPipeMesh.position.x = 25; // Start off-screen right
    bottomPipeMesh.position.y = gapCenterY - pipeGap / 2 - pipeHeight / 2;
    scene.add(bottomPipeMesh);

    pipes.push({ top: topPipeMesh, bottom: bottomPipeMesh, scored: false });
}

function resetGame() {
    // Reset bird
    birdMesh.position.set(-5, 0, 0);
    birdMesh.rotation.set(0, 0, 0);
    birdVelocityY = 0;

    // Clear existing pipes
    pipes.forEach(pipePair => {
        scene.remove(pipePair.top);
        scene.remove(pipePair.bottom);
        // Dispose geometries if concerned about memory, but simple shapes are okay here
        // pipePair.top.geometry.dispose();
        // pipePair.bottom.geometry.dispose();
    });
    pipes.length = 0; // Clear the array

    // Reset score & UI
    score = 0;
    scoreElement.innerText = `Score: ${score}`;
    messageElement.innerText = 'Click to Start';
    messageElement.classList.add('active'); // Make clickable
    gameState = 'start';
    frameCount = 0; // Reset frame count for spawning
}

function flap() {
    birdVelocityY = flapStrength;
}

function gameOver() {
    gameState = 'gameOver';
    messageElement.innerText = `Game Over!\nScore: ${score}\nClick to Restart`;
    messageElement.classList.add('active'); // Make clickable
}

function updateGame() {
    if (gameState !== 'playing') return;

    // --- Bird Physics ---
    birdVelocityY += gravity;
    birdMesh.position.y += birdVelocityY;

    // Simple rotation based on velocity
    birdMesh.rotation.z = Math.min(Math.PI / 6, Math.max(-Math.PI / 4, birdVelocityY * 0.1));

    // --- Pipe Movement & Spawning ---
    frameCount++;
    if (frameCount % pipeSpawnInterval === 0) {
        createPipePair();
    }

    // Update Bounding Boxes for Collision
    birdBox.setFromObject(birdMesh);

    for (let i = pipes.length - 1; i >= 0; i--) {
        const pipePair = pipes[i];
        pipePair.top.position.x += pipeSpeed;
        pipePair.bottom.position.x += pipeSpeed;

        // Check for Scoring
        if (!pipePair.scored && pipePair.top.position.x < birdMesh.position.x) {
            score++;
            scoreElement.innerText = `Score: ${score}`;
            pipePair.scored = true;
        }

        // Check for Collision
        pipeTopBox.setFromObject(pipePair.top);
        pipeBottomBox.setFromObject(pipePair.bottom);

        if (birdBox.intersectsBox(pipeTopBox) || birdBox.intersectsBox(pipeBottomBox)) {
            gameOver();
            return; // Stop update on collision
        }

        // Remove pipes that are off-screen left
        if (pipePair.top.position.x < -30) {
            scene.remove(pipePair.top);
            scene.remove(pipePair.bottom);
            // pipePair.top.geometry.dispose(); // Optional cleanup
            // pipePair.bottom.geometry.dispose(); // Optional cleanup
            pipes.splice(i, 1);
        }
    }

    // --- Ground Collision ---
    if (birdBox.intersectsBox(groundBox)) {
        // Place bird exactly on ground to prevent sinking through slightly
        birdMesh.position.y = groundMesh.position.y + 1 + (birdGeometry.parameters.height / 2); // groundY + half ground height + half bird height
        birdVelocityY = 0; // Stop falling
        gameOver();
        return;
    }

    // --- Ceiling Collision (Optional, prevents flying too high) ---
     if (birdMesh.position.y > 15) { // Adjust limit as needed
         birdMesh.position.y = 15;
         birdVelocityY = 0;
     }
}

// --- Main Loop ---
function animate() {
    requestAnimationFrame(animate);

    if (gameState === 'playing') {
        updateGame();
    }

    renderer.render(scene, camera);
}

// --- Event Listeners ---
function handleClick() {
     if (gameState === 'start') {
        gameState = 'playing';
        messageElement.innerText = '';
        messageElement.classList.remove('active'); // Make unclickable during play
        flap(); // Give initial flap
    } else if (gameState === 'playing') {
        flap();
    } else if (gameState === 'gameOver') {
        resetGame();
    }
}

// Listen for clicks or touches anywhere
window.addEventListener('mousedown', handleClick);
window.addEventListener('touchstart', handleClick, { passive: true }); // Use passive for touch performance


// Handle window resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}, false);

// --- Initial Setup ---
resetGame(); // Set initial state
animate();   // Start the loop