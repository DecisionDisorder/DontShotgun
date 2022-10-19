const { Trimesh } = require("cannon-es");
const { MeshPhongMaterial } = require("three");

let container, clock, mixer, actions, activeAction, previousAction, isJumping;
var keypressed = [false, false, false, false] // w, a, s, d
var jumpSpeed = 0.75;
var moveSpeed = 0.1;
var isPointerLocked = false;
var player;

const KeyCode = {
	SPACE: 32,
	W: 87,
	A: 65,
	S: 83,
	D: 68
}

var theta = 0;
var phi = 0;

const api = {state: 'Idle'};

const states = [ 'Idle', 'Walking', 'Running', 'Dance', 'Death', 'Sitting', 'Standing' ];
const emotes = [ 'Jump', 'Yes', 'No', 'Wave', 'Punch', 'ThumbsUp' ];

window.onload = function init()
{
	const canvas = document.getElementById("gl-canvas");
	canvas.width = window.innerWidth;
	canvas.height = window.innerHeight;

	const renderer = new THREE.WebGLRenderer({canvas});
	renderer.setSize(canvas.width,canvas.height);

	const scene = new THREE.Scene();
	scene.background = new THREE.Color(0x000000);

	camera = new THREE.PerspectiveCamera(75, canvas.width / canvas.height, 0.1, 1000);
	camera.rotation.y = 45 / 180 * Math.PI;
	camera.position.x = 10;
	camera.position.y = 10;
	camera.position.z = 10;

	clock = new THREE.Clock();

	const hemiLight = new THREE.HemisphereLight( 0xffffff, 0x444444 );
	hemiLight.position.set( 0, 20, 0 );
	scene.add( hemiLight );

	const dirLight = new THREE.DirectionalLight( 0xffffff );
	dirLight.position.set( 0, 20, 10 );
	scene.add( dirLight );

	setInterval(jump, 1000/jumpSpeed);

	const loader = new THREE.GLTFLoader();
	loader.load('./model/RobotExpressive.glb', function(gltf){
		player = gltf.scene.children[0];
		player.scale.set(1.0, 1.0, 1.0);
		scene.add(gltf.scene);
		loadAnimation(player, gltf.animations);
		render();
	}, undefined, function (error) {
		console.error(error);
	});

	setKeyboardInput();
	setMousePointerLock();

	createFloor();

	physicsTest();

	function render() {
		const dt = clock.getDelta();
		if(mixer) mixer.update(dt);

		movePlayer();
		setCameraPosition();
		requestAnimationFrame(render);
	
		renderer.render(scene, camera);
	}

	function createFloor() {
		const planeGeometry = new THREE.PlaneGeometry(25, 25);
		const planeMesh = new THREE.Mesh(planeGeometry, new THREE.MeshPhongMaterial());
		planeMesh.receiveShadow = true;
		
	}
}

// Load animation from model file(animation parameter)
function loadAnimation(model, animations) {

	mixer = new THREE.AnimationMixer(model);

	actions = {};

	for (let i = 0; i < animations.length; i++) {

		const clip = animations[i];
		const action = mixer.clipAction(clip);
		actions[clip.name] = action;

		if (emotes.indexOf(clip.name) >= 0 || states.indexOf(clip.name) >= 4) {
			action.clampWhenFinished = true;
			action.loop = THREE.LoopOnce;
		}
	}
	activeAction = actions['Idle'];
	activeAction.play();
}

// Play specific animation of model
function executeEmote(name, restoreState) {
	fadeToAction(name, 0.2);
	mixer.addEventListener('finished', restoreState);
}

// On end of jumping motion
function restoreJump() {
	mixer.removeEventListener('finished', restoreJump);
	fadeToAction(api.state, 0.2);
	if(isJumping)
		isJumping = false;
}

// Jump the player
function jump() {
	isJumping = true;
	executeEmote("Jump", restoreJump);
}

// Naturally shifts the animation of the model slowly
function fadeToAction(name, duration) {
	previousAction = activeAction;
	activeAction = actions[name];

	if(previousAction !== activeAction) {
		previousAction.fadeOut(duration);
	}

	activeAction.reset()
			.setEffectiveTimeScale(jumpSpeed)
			.setEffectiveWeight(1)
			.fadeIn(duration)
			.play();
}

// Initialize pointer lock events
function setMousePointerLock() {
	document.addEventListener('click', function(event) {
		document.body.requestPointerLock();
	});

	document.addEventListener('mousemove', function(event) {
		if(isPointerLocked) {
			console.log("x: " + event.movementX + ", y: " + event.movementY);
			moveCamera(event.movementX, event.movementY);
		}
	});

	document.addEventListener('pointerlockchange', function(event) {
		if(document.pointerLockElement === document.body) {
			isPointerLocked = true;
		}
		else {
			isPointerLocked = false;
		}
	});
}

function movePlayer() {
	if(keypressed[0]) { // forward (w)
		player.position.z += moveSpeed;
	}
	else if(keypressed[1]) { // left (a)
		player.position.x += moveSpeed;
	}
	else if(keypressed[2]) { // backward (s)
		player.position.z -= moveSpeed;
	}
	else if(keypressed[3]) { // right (d)
		player.position.x -= moveSpeed;
	}
}

function angleToRadian(angle) {
	return angle * Math.PI / 180;
}

function moveCamera(moveX, moveY) {
	var mouseSpeed = 2;
	phi -= moveX * 0.001 * mouseSpeed;
	theta += moveY * 0.001 * mouseSpeed;
	if(theta > angleToRadian(80))
		theta = angleToRadian(80);
	else if(theta < angleToRadian(-60))
		theta =  angleToRadian(-60);

	setCameraPosition();
}

function setCameraPosition() {
	var cameraDistHeight = 10;
	var modelHeight = 3;
	var cameraDist = 10;

	camera.position.x = player.position.x + cameraDist * Math.cos(theta) * Math.sin(phi);
	camera.position.y = player.position.y + modelHeight + cameraDistHeight * Math.sin(theta);
	camera.position.z = player.position.z + cameraDist * Math.cos(theta) * Math.cos(phi) ;
	camera.lookAt(player.position);

}

function setKeyboardInput() {
	document.onkeydown = function(event) {
		console.log(event.keyCode);
		switch(event.keyCode) {
		case KeyCode.SPACE: //space
			if(!isJumping)
				jump();
			break;
		case KeyCode.W: // w
			keypressed[0] = true;
			break;
		case KeyCode.A: // a
			keypressed[1] = true;
			break;
		case KeyCode.S: // s
			keypressed[2] = true;
			break;
		case KeyCode.D: // d
			keypressed[3] = true;
			break;
		}
	};
	document.onkeyup = function(event) {
		switch(event.keyCode) {
		case KeyCode.W: // w
			keypressed[0] = false;
			break;
		case KeyCode.A: // a
			keypressed[1] = false;
			break;
		case KeyCode.S: // s
			keypressed[2] = false;
			break;
		case KeyCode.D: // d
			keypressed[3] = false;
			break;
		}
	};
}