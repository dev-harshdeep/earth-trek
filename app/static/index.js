import * as THREE from "three";
import { OrbitControls } from 'jsm/controls/OrbitControls.js';
import getStarfield from "./getStarfield.js";


let dataPoints = {};
let availableYears = [];
let textures = {}; 
let currentYear = ''; 

async function loadAvailableTextures() {
    const textureFolder = '../static/output_images/';
    
    try {
        // Try dynamic loading first
        const response = await fetch(textureFolder);
        if (!response.ok) throw new Error('Directory listing not available');
        
        const html = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        
        // Extract PNG files with the smudge effect pattern
        const textureFiles = [...doc.querySelectorAll('a')]
            .map(a => a.href)
            .filter(href => href.includes('smudge_effect_year_'))
            .map(href => href.split('/').pop());
        
        if (textureFiles.length > 0) {
            await loadAndProcessTextures(textureFiles, textureFolder);
            return;
        }
        throw new Error('No texture files found');
    } catch (error) {
        console.warn("Dynamic loading failed, using fallback:", error);
        // Fallback to all years from 1967 to 2035
        const fallbackFiles = generateAllYearTextures(1967, 2035);
        await loadAndProcessTextures(fallbackFiles, textureFolder);
    }
}

// Helper function to generate filenames for all years in range
function generateAllYearTextures(startYear, endYear) {
    const files = [];
    for (let year = startYear; year <= endYear; year++) {
        files.push(`smudge_effect_year_${year}.png`);
    }
    return files;
}

// Shared texture loading logic
async function loadAndProcessTextures(fileList, basePath) {
    const availableYears = [];
    
    await Promise.all(fileList.map(async (file) => {
        const year = file.match(/\d{4}/)?.[0];
        if (!year) return;
        
        const textureURL = `${basePath}${file}`;
        try {
            const texture = await new Promise((resolve, reject) => {
                new THREE.TextureLoader().load(
                    textureURL,
                    resolve,
                    undefined,
                    () => reject(new Error(`Failed to load ${file}`))
                );
            });
            
            availableYears.push(parseInt(year));
            textures[year] = texture;
        } catch (error) {
            console.warn(`Skipping ${file}:`, error.message);
        }
    }));
    
    populateDropdown(availableYears.sort((a, b) => a - b));
}

loadAvailableTextures();


function populateDropdown(years) {
    const yearDropdown = document.getElementById('yearDropdown');
    yearDropdown.innerHTML = ''; 

    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = 'Select a year';
    yearDropdown.appendChild(defaultOption);

    years.forEach(year => {
        const option = document.createElement('option');
        option.value = year;
        option.textContent = year;
        yearDropdown.appendChild(option);
    });

    
    yearDropdown.addEventListener('change', (event) => {
        const selectedYear = event.target.value;
        setCurrentYear(selectedYear); 
    });
}


function setCurrentYear(year) {
    currentYear = year; 
    loadTextureForYear(year); 
    plotData(year); 
}

 
function loadTextureForYear(year) {
    const dayTexture = textures[year]; 
    // const nightTexture = textures[`night_${year}`];  
 
    if (dayTexture) {
        dayEarthMesh.material.map = dayTexture;
        dayEarthMesh.material.needsUpdate = true; // Ensure material is updated
    } else {
        console.error(`No day texture found for year ${year}`);
    }

    // Update the night texture
    // if (nightTexture) {
    //     nightMaterial.map = nightTexture; // Update the night texture
    //     nightMaterial.needsUpdate = true; // Ensure material is updated
    // } else {
    //     console.error(`No night texture found for year ${year}`);
    // }
}


// Three.js setup
const w = window.innerWidth;
const h = window.innerHeight;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(35, w / h, 0.1, 1000);
camera.position.set(0, 2, 5); // Adjusted camera position for better visibility
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(w, h);
document.body.appendChild(renderer.domElement);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableZoom = true; // Allow zoom for better globe view
controls.enablePan = true; 

// Earth Group
const earthGroup = new THREE.Group();
scene.add(earthGroup);

// Geometry and material for the earth
const geometry = new THREE.SphereGeometry(1, 32, 32);

// Load textures for day, night, and clouds
const textureLoader = new THREE.TextureLoader();
const dayTexture = textureLoader.load('../static/2k_earth_daymap.jpg'); 
const nightTexture = textureLoader.load('../static/8k_earth_nightmap.jpg'); 
const cloudTexture = textureLoader.load('../static/04_earthcloudmap.jpg'); // Cloud texture

 const dayMaterial = new THREE.MeshPhongMaterial({
    map: dayTexture, 
    specularMap: textureLoader.load('../static/02_earthspec1k.jpg'),
    displacementScale: 0.05, 
    opacity: 1 

});

 const dayEarthMesh = new THREE.Mesh(geometry, dayMaterial);
earthGroup.add(dayEarthMesh);

 const nightMaterial = new THREE.MeshBasicMaterial({
    map: nightTexture,
    transparent: true,
    opacity: 0.5 // Adjust opacity to reduce darkness (lower than 1.0)
});
const nightEarthMesh = new THREE.Mesh(geometry, nightMaterial);
earthGroup.add(nightEarthMesh);

// Clouds
const cloudMaterial = new THREE.MeshPhongMaterial({
    map: cloudTexture,
    transparent: true, // Make the clouds semi-transparent
    opacity: 0.4,
});
const cloudGeometry = new THREE.SphereGeometry(1.01, 32, 32); // Slightly larger than Earth
const cloudMesh = new THREE.Mesh(cloudGeometry, cloudMaterial);
earthGroup.add(cloudMesh);

 const stars = getStarfield({ numStars: 2000 });
scene.add(stars);

const sunLight = new THREE.DirectionalLight(0xffffff, 1.0); // Increased intensity for better illumination
sunLight.position.set(-2, 1, 3);
scene.add(sunLight);

 const ambientLight = new THREE.AmbientLight(0x404040, 0.6); // Adjust intensity to lighten night
scene.add(ambientLight);

// Load CSV data
async function loadCSV(filePath) {
    const response = await fetch(filePath);
    const text = await response.text();
    const lines = text.split('\n').slice(1); // Skip header line
    lines.forEach(line => {
        const [year, lat, lon, data] = line.split(',');
        if (!dataPoints[year]) {
            dataPoints[year] = [];
        }
        dataPoints[year].push({
            lat: parseFloat(lat),
            lon: parseFloat(lon),
            value: parseFloat(data)
        });
    });
}

 function plotData(year) {
    // Clear previous points
    const existingPoints = scene.getObjectByName("dataPoints");
    if (existingPoints) {
        scene.remove(existingPoints);
    }

    const pointGroup = new THREE.Group();
    pointGroup.name = "dataPoints";

    const points = dataPoints[year] || [];
    points.forEach(point => {
        const { lat, lon, value } = point;

         const planeGeometry = new THREE.PlaneGeometry(0.05, 0.05); // Size of the point
        const color = new THREE.Color(`hsl(${(value % 360)}, 100%, 50%)`); // Color based on value
        const planeMaterial = new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: 0.8 });
        const plane = new THREE.Mesh(planeGeometry, planeMaterial);

         const radius = 1; // Earth radius
        const phi = (90 - lat) * (Math.PI / 180);
        const theta = (lon + 180) * (Math.PI / 180);

         plane.position.x = radius * Math.sin(phi) * Math.cos(theta);
        plane.position.y = radius * Math.cos(phi);
        plane.position.z = radius * Math.sin(phi) * Math.sin(theta);

        
        plane.lookAt(0, 0, 0);  

        pointGroup.add(plane);
    });

    scene.add(pointGroup);
}

 
window.addEventListener('resize', () => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
});
 
function animate() {
    requestAnimationFrame(animate);

     
    dayEarthMesh.rotation.y += 0.001;
    nightEarthMesh.rotation.y += 0.001;
    cloudMesh.rotation.y += 0.0005; 

    renderer.render(scene, camera);
}

 
loadAvailableTextures('.static/output_images'); 
loadCSV('../static/processed_data.csv');  

animate();
