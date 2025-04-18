import * as THREE from "three";
import { OrbitControls } from 'jsm/controls/OrbitControls.js';
import getStarfield from "./getStarfield.js";


let dataPoints = {};
let availableYears = [];
let textures = {}; 
let currentYear = ''; 

async function loadAvailableTextures() {
    const folderPath = "./static/output_images"; 
    const response = await fetch("/api/textures"); 
    const textureFiles = await response.json(); 
    const availableYears = [];
    // const textures = {};

    
    textureFiles.forEach(file => {
        const year = file.match(/\d{4}/)[0];
        availableYears.push(year);

        
        const textureURL = `${folderPath}/${file}`; 
        const texture = new THREE.TextureLoader().load(textureURL);
        textures[year] = texture; 
    });

    
    populateDropdown(availableYears);
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
    const nightTexture = textures[`night_${year}`];  
 
    if (dayTexture) {
        dayEarthMesh.material.map = dayTexture;
        dayEarthMesh.material.needsUpdate = true; // Ensure material is updated
    } else {
        console.error(`No day texture found for year ${year}`);
    }

    // Update the night texture
    if (nightTexture) {
        nightMaterial.map = nightTexture; // Update the night texture
        nightMaterial.needsUpdate = true; // Ensure material is updated
    } else {
        console.error(`No night texture found for year ${year}`);
    }
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
const dayTexture = textureLoader.load('./static/2k_earth_daymap.jpg'); 
const nightTexture = textureLoader.load('./static/8k_earth_nightmap.jpg'); 
const cloudTexture = textureLoader.load('./static/04_earthcloudmap.jpg'); // Cloud texture

 const dayMaterial = new THREE.MeshPhongMaterial({
    map: dayTexture, 
    specularMap: textureLoader.load('./static/02_earthspec1k.jpg'),
    displacementMap: textureLoader.load('./static/your_height_map.jpg'), 
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
loadCSV('processed_data.csv');  

animate();
