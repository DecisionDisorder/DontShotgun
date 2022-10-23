let container, clock, mixer, actions, activeAction, previousAction, isJumping;
var keypressed = [false, false, false, false] // w, a, s, d
var jumpSpeed = 0.5;
var moveSpeed = 0.1;
var moveForce = 10;
var jumpForce = 6;
var sprintRatio = 2;
var isSprinting = false;
var isPointerLocked = false;
var player;

var playerSize = 3;
var playerHeight = 4.5;

const world = new CANNON.World();
const playerShape = new CANNON.Box(new CANNON.Vec3(playerSize / 2, playerHeight / 2, playerSize / 2));
const playerBody = new CANNON.Body({
	mass:1,
	position: new CANNON.Vec3(0, 2, 0)
});
const scene = new THREE.Scene();

var floorBodyList = [];

const KeyCode = {
	SHIFT: 16,
	SPACE: 32,
	W: 87,
	A: 65,
	S: 83,
	D: 68
}

var theta = 0;
var phi = 3.14;

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

	createPlayerHitBox();
	createFloor();
	initPhysics();

	setKeyboardInput();
	setMousePointerLock();

	function render() {
		const dt = clock.getDelta();
		if(mixer) mixer.update(dt);

		world.step(1/60, dt, 3);
		movePlayer();
		playerPhysics();
		setCameraPosition();
		requestAnimationFrame(render);
	
		renderer.render(scene, camera);
	}

	function createFloor() {
		const planeGeometry = new THREE.PlaneGeometry(20, 20);
		const planeMesh = new THREE.Mesh(planeGeometry, new THREE.MeshPhongMaterial());
		planeMesh.receiveShadow = true;
		planeMesh.rotateX(-Math.PI / 2);
		scene.add(planeMesh);
		const planeShape = new CANNON.Plane();
		const planeBody = new CANNON.Body({mass: 0});
		planeBody.addShape(planeShape);
		planeBody.quaternion.setFromAxisAngle(new CANNON.Vec3(-1, 0, 0), Math.PI / 2);
		world.addBody(planeBody);
		floorBodyList.push(planeBody);
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
	setTimeout(jumpOnPhysics, 400)
}

function jumpOnPhysics() {
	playerBody.applyLocalImpulse(new CANNON.Vec3(0, jumpForce, 0), new CANNON.Vec3(0, 0, 0));
}

function restoreOtherState() {
	mixer.removeEventListener('finished', restoreOtherState);
	fadeToAction(api.state, 0.2);
}

function walk() {
	if(activeAction == actions["Idle"])
		executeEmote("Walking", restoreOtherState);
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

// 달리기 여부에 따른 스피드 계산
function getCalculatedSpeed(speed) {
	if(isSprinting) 
		return sprintRatio * speed;
	else
		return speed;
}

function movePlayer() {
	if(keypressed[0]) { // forward (w)
		if(isJumping)
			playerBody.applyLocalForce(new CANNON.Vec3(0, 0, getCalculatedSpeed(moveForce)), new CANNON.Vec3(0, 0, 0));
		else
			playerBody.position.z += getCalculatedSpeed(moveSpeed);//playerBody.vectorToWorldFrame(getCalculatedSpeed(moveSpeed));
	}
	if(keypressed[1]) { // left (a)
		if(isJumping)
			playerBody.applyLocalForce(new CANNON.Vec3(getCalculatedSpeed(moveForce), 0, 0), new CANNON.Vec3(0, 0, 0));
		else
			playerBody.position.x += getCalculatedSpeed(moveSpeed);
	}
	if(keypressed[2]) { // backward (s)
		if(isJumping)
			playerBody.applyLocalForce(new CANNON.Vec3(0, 0, -getCalculatedSpeed(moveForce)), new CANNON.Vec3(0, 0, 0));
		else
			playerBody.position.z -= getCalculatedSpeed(moveSpeed);
	}
	if(keypressed[3]) { // right (d)
		if(isJumping)
			playerBody.applyLocalForce(new CANNON.Vec3(-getCalculatedSpeed(moveForce), 0, 0), new CANNON.Vec3(0, 0, 0));
		else
			playerBody.position.x -= getCalculatedSpeed(moveSpeed);
	}
	if(isNaN(playerBody.position.x))
		console.log("NaN Occured!");
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
	playerBody.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), phi + Math.PI);
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
		case KeyCode.SHIFT: //space
			isSprinting = true;
			break;
		case KeyCode.W: // w
			keypressed[0] = true;
			walk();
			break;
		case KeyCode.A: // a
			keypressed[1] = true;
			walk();
			break;
		case KeyCode.S: // s
			keypressed[2] = true;
			walk();
			break;
		case KeyCode.D: // d
			keypressed[3] = true;
			walk();
			break;
		}
	};
	document.onkeyup = function(event) {
		switch(event.keyCode) {
		case KeyCode.SHIFT:
			isSprinting = false;
			break;
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

function createPlayerHitBox() {
	playerBox = new THREE.BoxGeometry(playerSize, playerHeight, playerSize);
	var playerMaterial = new THREE.MeshPhongMaterial({color: 0x882288});
	playerMaterial.transparent = true;
	playerMaterial.opacity = 0.5;
	playerBoxMesh = new THREE.Mesh(playerBox, playerMaterial);
	scene.add(playerBoxMesh);
}

function initPhysics() {
    world.gravity.set(0, -9.82, 0);
	playerBody.fixedRotation = true;
	playerBody.addShape(playerShape);
	world.addBody(playerBody);
	
	const playerPhysicsMaterial = new CANNON.Material();
	const floorPhysicsMaterial = new CANNON.Material();
	const playerFloorContactMaterial = new CANNON.ContactMaterial(
		playerPhysicsMaterial,
		floorPhysicsMaterial,
		{
			friction: 0.1,
			restitution: 0
		}
	);

	world.addContactMaterial(playerFloorContactMaterial);
	playerBody.material = playerPhysicsMaterial;
	floorBodyList[0].material = floorPhysicsMaterial;
}

function playerPhysics() {
	player.position.set(
		playerBody.position.x,
		playerBody.position.y - playerHeight / 2,
		playerBody.position.z
	);
	player.quaternion.set(
		playerBody.quaternion.x,
		playerBody.quaternion.y,
		playerBody.quaternion.z,
		playerBody.quaternion.w
	);

	playerBoxMesh.position.set(
		playerBody.position.x,
		playerBody.position.y,
		playerBody.position.z
	);
	playerBoxMesh.quaternion.set(
		playerBody.quaternion.x,
		playerBody.quaternion.y,
		playerBody.quaternion.z,
		playerBody.quaternion.w
	);
}