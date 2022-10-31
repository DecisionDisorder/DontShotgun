var debug = false;

let container, clock, mixer, actions, activeAction, previousAction, isJumping = false;
var keypressed = [false, false, false, false] // w, a, s, d
var jumpSpeed = 0.5;
var moveSpeed = 0.1;
var moveForce = 10;
var jumpForce = 10;
var sprintRatio = 2;
var isSprinting = false;
var isPointerLocked = false;
var player;
const initRespawnPosition = {x: 0, y: 2, z: 0};
var respawnPosition = {x: initRespawnPosition.x, y: initRespawnPosition.y, z: initRespawnPosition.z};

var deathCount = 0;
var isPlayerAlive = true;

var playerSize = 3;
var playerHeight = 4.5;

var pause = false;
const gravity = 25;
const deathDepth = -20;

const world = new CANNON.World();
const playerShape = new CANNON.Box(new CANNON.Vec3(playerSize / 2, playerHeight / 2, playerSize / 2));
const playerBody = new CANNON.Body({
	mass:1,
	position: new CANNON.Vec3(0, 2, 0)
});
const scene = new THREE.Scene();
var renderer;

var stepBodyList = [];
var stepObjList = [];

const KeyCode = {
	SHIFT: 16,
	SPACE: 32,
	ESC: 27,
	TAB: 9,
	W: 87,
	A: 65,
	S: 83,
	D: 68,
	E: 69,
	Q: 81
}

const initSuperJumpCoolTime = 10;
var superJumpForce = 50;
var superJumpCoolTime = 0;

const init_theta = 0;
const init_phi = 3.14;
var theta = init_theta;
var phi = init_phi;

const api = {state: 'Idle'};

const states = [ 'Idle', 'Walking', 'Running', 'Dance', 'Death', 'Sitting', 'Standing' ];
const emotes = [ 'Jump', 'Yes', 'No', 'Wave', 'Punch', 'ThumbsUp' ];

var renderAnim = null;
var jumpIntervalId = null;

window.onload = function init()
{
	const canvas = document.getElementById("gl-canvas");
	canvas.width = window.innerWidth;
	canvas.height = window.innerHeight;

	renderer = new THREE.WebGLRenderer({canvas});
	renderer.setSize(canvas.width,canvas.height);

	camera = new THREE.PerspectiveCamera(75, canvas.width / canvas.height, 0.1, 1000);
	camera.rotation.y = 45 / 180 * Math.PI;
	camera.position.x = 10;
	camera.position.y = 10;
	camera.position.z = 10;

	clock = new THREE.Clock();

	initStageSelection();
	loadTutorialMap();

	setKeyboardInput();
	setMousePointerLock();
	
}

function loadLights() {
	const hemiLight = new THREE.HemisphereLight( 0xffffff, 0x444444 );
	hemiLight.position.set( 0, 20, 0 );
	scene.add( hemiLight );

	const dirLight = new THREE.DirectionalLight( 0xffffff );
	dirLight.position.set( 0, 20, 10 );
	scene.add( dirLight );
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

// Jump the player
function jump() {
	if(isPlayerAlive && !isJumping) {
		executeEmote("Jump", restoreState);
		setTimeout(jumpOnPhysics, 400);
	}
}

function jumpOnPhysics() {
	isJumping = true;
	var jumpDirection = getMovingDirection() * getCalculatedSpeed(moveForce);
	playerBody.applyLocalImpulse(new CANNON.Vec3(jumpDirection.x, jumpForce, jumpDirection.z), new CANNON.Vec3(0, 0, 0));
	playerBody.addEventListener("collide", disableJump);
}

function restoreState() {
	mixer.removeEventListener('finished', restoreState);
	fadeToAction(api.state, 0.2);
}

function walk() {
	if(activeAction == actions["Idle"] && isPlayerAlive)
		executeEmote("Walking", restoreState);
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
			//console.log("x: " + event.movementX + ", y: " + event.movementY);
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
function getCalculatedSpeed(speed, deltaTime) {
	if(isSprinting) 
		return sprintRatio * speed * (deltaTime / (1 / 60));
	else
		return speed * (deltaTime / (1 / 60));
}

function movePlayer(deltaTime) {
	if(isPlayerAlive) {
		var movingDirection = getMovingDirection();
		var calculatedMoveForce = getCalculatedSpeed(moveForce, deltaTime);
		var calculatedMoveSpeed = getCalculatedSpeed(moveSpeed, deltaTime);
		if(isJumping) {
			playerBody.applyLocalForce(new CANNON.Vec3(movingDirection.x * calculatedMoveForce, 0, movingDirection.z * calculatedMoveForce), new CANNON.Vec3(0, 0, 0));
		}
		else {
			let relativeVector = new CANNON.Vec3(movingDirection.x * calculatedMoveSpeed, 0, movingDirection.z * calculatedMoveSpeed);

			// Use quaternion to rotate the relative vector, store result in same vector
			playerBody.quaternion.vmult(relativeVector, relativeVector);

			// Add position and relative vector, store in body.position
			playerBody.position.vadd(relativeVector, playerBody.position);
		}
		
		if(isNaN(playerBody.position.x))
			console.log("NaN Occured!");
	}
}

function getMovingDirection() {
	var direction = new THREE.Vector3(0, 0, 0);
	direction.z = (keypressed[0] ? 1 : 0) + (keypressed[2] ? -1 : 0);
	direction.x = (keypressed[1] ? 1 : 0) + (keypressed[3] ? -1 : 0);
	return direction;
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
	if(isPlayerAlive)
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
		case KeyCode.SPACE:
			respawn();
			break;
		case KeyCode.TAB:
			activeStageSelection(true);
			break;
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
		case KeyCode.E:
			superJumpSkill();
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

function disableKeyInput() {
	for (var i = 0; i < keypressed.length; i++)
		keypressed[i] = false;
}

function createPlayerHitBox() {
	playerBox = new THREE.BoxGeometry(playerSize, playerHeight, playerSize);
	var playerMaterial = new THREE.MeshPhongMaterial({color: 0x882288});
	playerMaterial.transparent = true;
	if(debug)
		playerMaterial.opacity = 0.5;
	else
		playerMaterial.opacity = 0.0;
	playerBoxMesh = new THREE.Mesh(playerBox, playerMaterial);
	scene.add(playerBoxMesh);
}

function initPhysics() {
    world.gravity.set(0, -gravity, 0);
	playerBody.fixedRotation = true;
	playerBody.addShape(playerShape);
	playerBody.position.set(respawnPosition.x, respawnPosition.y, respawnPosition.z);
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
	//floorBodyList[0].material = floorPhysicsMaterial;
	stepObjList[0].body.material = floorPhysicsMaterial;
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

	checkGameOver();
}

function checkGameOver() {
	if(playerBody.position.y < deathDepth && isPlayerAlive) {
		isPlayerAlive = false;
		deathCount++;
		restoreState();
		fadeToAction("Death", 0.5);
		document.getElementById('ui-game-over').style.visibility = "visible";
	}
}

function respawn() {
	if(!isPlayerAlive) {
		playerBody.position.set(respawnPosition.x, respawnPosition.y, respawnPosition.z);
		isPlayerAlive = true;
		fadeToAction("Idle", 0.5);
		document.getElementById('ui-game-over').style.visibility = "hidden";
		phi = init_phi;
		theta = init_theta;
	}
}

function loadModelMap() {
	let mapData = JSON.parse(JSON.stringify(model_map));

	for(var i = 0; i < mapData.model.length; i++) {
		var modelPos = mapData.model[i].position;
		var modelScale = mapData.model[i].scale;
		var modelPath = mapData.model[i].path;

		const loader = new THREE.GLTFLoader();
		loader.load(modelPath, function(gltf){
			var mapModel = gltf.scene;
			mapModel.position.set(modelPos.x, modelPos.y, modelPos.z);
			mapModel.scale.set(modelScale.x, modelScale.y, modelScale.z);
			scene.add(gltf.scene);

			//three to cannon이 안될때 최후의 보루
			var modelShape = new CANNON.Box(new CANNON.Vec3(modelScale.x / 2, modelScale.y / 2, modelScale.z / 2))
			var modelBody = new CANNON.Body({mass: 0});
			modelBody.addShape(modelShape);
			modelBody.position.copy(mapModel.position);
			world.addBody(modelBody);
		}, undefined, function (error) {
			console.error(error);
		});
	}
}

function loadMapTexture(mapCategory) {
	let mapTextureData;
	if(mapCategory == "Tutorial")
		mapTextureData = JSON.parse(JSON.stringify(map_texture_tutorial));
	else if(mapCategory = "Main")
		mapTextureData = JSON.parse(JSON.stringify(map_texture_main));

	for(var i = 0; i < mapTextureData.data.length; i++) {
		var targetIndex = mapTextureData.data[i].target_index;
		var texturePath = mapTextureData.data[i].path;

		const texture = new THREE.TextureLoader().load(texturePath);
		const material = new THREE.MeshBasicMaterial({map: texture});
		stepObjList[targetIndex].mesh.material = material;
	}
}

function superJumpCoolDown(deltaTime) {
	if(superJumpCoolTime > 0) {
		superJumpCoolTime -= deltaTime;
		if(superJumpCoolTime < 0) {
			superJumpCoolTime = 0;
			document.getElementById("cool-down-timer-0").style.visibility = "hidden";
			document.getElementById("cool-time-text-0").style.visibility = "hidden";
			document.getElementById("skill-key-guide-0").style.visibility = "visible";
		}
		
		document.getElementById("cool-time-text-0").innerText = Math.ceil(superJumpCoolTime);
		document.getElementById("cool-down-timer-0").style.height = (superJumpCoolTime / initSuperJumpCoolTime * 100);
	}
}

function superJumpSkill() {
	if(isPlayerAlive && superJumpCoolTime == 0) {
		executeEmote("Jump", restoreState);
		setTimeout(superJumpOnPhysics, 400);
		document.getElementById("cool-down-timer-0").style.visibility = "visible";
		document.getElementById("cool-time-text-0").style.visibility = "visible";
		document.getElementById("skill-key-guide-0").style.visibility = "hidden";
		superJumpCoolTime = initSuperJumpCoolTime;
	}
}

function disableJump() {
	isJumping = false;
	playerBody.removeEventListener("collide", disableJump);
}

function superJumpOnPhysics() {
	isJumping = true;
	var jumpDirection = getMovingDirection() * getCalculatedSpeed(moveForce);
	playerBody.applyLocalImpulse(new CANNON.Vec3(jumpDirection.x, superJumpForce, jumpDirection.z), new CANNON.Vec3(0, 0, 0));
	playerBody.addEventListener("collide", disableJump);
}

function checkpoint(checkPointBody, type) {
	checkPointBody.addEventListener("collide", function(e) {
		if(type == "SaveBox") {
			respawnPosition.x = e.target.position.x;
			respawnPosition.y = e.target.position.y + 3;
			respawnPosition.z = e.target.position.z;
			console.log("Respawn position saved.");
		}
		else if(type == "EndBox") {
			console.log("Clear Event");
		}
		console.log("Collide with check point!");
	})
}

function initStageSelection() {
	var tutorialButton = document.getElementById("button-stage-tutorial");
	var mainStageButton = document.getElementById("button-stage-main");
	var closeStage = document.getElementById("button-close-stage");
	
	tutorialButton.addEventListener("click", function() {
		activeStageSelection(false);
		loadTutorialMap();
	});
	mainStageButton.addEventListener("click", function() {
		activeStageSelection(false);
		loadMainStageMap();
	});
	closeStage.addEventListener("click", function() {
		activeStageSelection(false);
	});
}

function activeStageSelection(active) {
	var stageContainer = document.getElementById("ui-select-stage");
	
	if(active) {
		pause = true;
		stageContainer.style.visibility = "visible";
		disableKeyInput();
		document.exitPointerLock();
	}
	else {
		pause = false;
		stageContainer.style.visibility = "hidden";
	}
}

function clearScene() {
	scene.remove.apply(scene, scene.children);
}

function resetRespawn() {
	respawnPosition.x = initRespawnPosition.x;
	respawnPosition.y = initRespawnPosition.y; 
	respawnPosition.z = initRespawnPosition.z;
}

function resetOthers() {
	superJumpCoolDown(initSuperJumpCoolTime);

	phi = init_phi;
	theta = init_theta;

	stepObjList = [];
	floorBodyList = [];
}

function loadPlayer() {
	if(renderAnim != null)
		cancelAnimationFrame(renderAnim);

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
}

function loadTutorialMap() {
	clearScene();
	resetOthers();
	resetRespawn();
	loadPlayer();

	scene.background = new THREE.CubeTextureLoader()
	.setPath('BG/')
	.load([
		'right.jpg',
		'left.jpg',
		'top.jpg',
		'bottom.jpg',
		'front.jpg',
		'back.jpg'
	]);
	
	const map_loader = new THREE.ObjectLoader();
	map_loader.load(
		// resource URL
		"model/test.json",
		// onLoad callback
		// Here the loaded data is assumed to be an object
		function ( obj ) {
			// Add the loaded object to the scene
			for(i=0;i<obj.children.length;i++){
				createStep(obj.children[i]);
			}
			
			loadMapTexture("Tutorial");
		},
		// onProgress callback
		function ( xhr ) {
			console.log( (xhr.loaded / xhr.total * 100) + '% loaded' );
		},

		// onError callback
		function ( err ) {
			console.error( 'An error happened' );
		}
	);

	if(jumpIntervalId != null)
		clearInterval(jumpIntervalId);
	jumpIntervalId = setInterval(jump, 1000/jumpSpeed);
	
	loadLights();
	createPlayerHitBox();
	createFloor();
	initPhysics();
	loadModelMap();	
	// TODO: tutorial 맵을 불러오는 함수들 모두 여기에 모아보기.
}

function loadMainStageMap() {
	clearScene();
    resetOthers();
    resetRespawn();
    loadPlayer();

    scene.background = new THREE.CubeTextureLoader()
    .setPath('space/')
    .load([
        'px.png',
        'nx.png',
        'py.png',
        'ny.png',
        'pz.png',
        'nz.png'
    ]);
    
    const map_loader = new THREE.ObjectLoader();
    map_loader.load(
        // resource URL
        "model/main.json",
        // onLoad callback
        // Here the loaded data is assumed to be an object
        function ( obj ) {
            // Add the loaded object to the scene
            for(i=0;i<obj.children.length;i++){
                createStep(obj.children[i]);
            }
            
            loadMapTexture("Main");
        },
        // onProgress callback
        function ( xhr ) {
            console.log( (xhr.loaded / xhr.total * 100) + '% loaded' );
        },

        // onError callback
        function ( err ) {
            console.error( 'An error happened' );
        }
    );

    if(jumpIntervalId != null)
        clearInterval(jumpIntervalId);
    jumpIntervalId = setInterval(jump, 1000/jumpSpeed);
    
    loadLights();
    createPlayerHitBox();
    createFloor();
    initPhysics();
    loadModelMap(); 

}

function render() {
	const dt = clock.getDelta();

	if(!pause) {
		if(mixer) mixer.update(dt);
		world.step(1/60, dt, 3);
	}
	movePlayer(dt);
	playerPhysics();
	setCameraPosition();
	superJumpCoolDown(dt);
	renderAnim = requestAnimationFrame(render);

	renderer.render(scene, camera);
}

function createFloor() {
	const floorGeometry = new THREE.BoxGeometry(20, 0.1, 20);
	const floorMesh = new THREE.Mesh(floorGeometry, new THREE.MeshPhongMaterial());
	floorMesh.receiveShadow = true;
	scene.add(floorMesh);
	const floorShape = new CANNON.Box(new CANNON.Vec3(10, 0.05, 10));
	const floorBody = new CANNON.Body({mass: 0});
	floorBody.addShape(floorShape);
	
	const deathFloorShape = new CANNON.Plane();
	const deathFloorBody = new CANNON.Body({mass: 0});
	deathFloorBody.addShape(deathFloorShape);
	deathFloorBody.quaternion.setFromAxisAngle(new CANNON.Vec3(-1, 0, 0), Math.PI / 2);
	deathFloorBody.position.y = deathDepth - 5;

	world.addBody(floorBody);
	world.addBody(deathFloorBody);

	stepObjList.push(new StepObject("", floorMesh, floorBody));

}

function createStep(obj) {
	console.log(obj)
	const BoxGeometry = new THREE.BoxGeometry(obj.scale.x,obj.scale.y,obj.scale.z);
	const BoxMesh = new THREE.Mesh(BoxGeometry, new THREE.MeshPhongMaterial());
	BoxMesh.receiveShadow = true;
	BoxMesh.position.copy(obj.position)
	BoxMesh.quaternion.set(obj.quaternion.x, obj.quaternion.y, obj.quaternion.z,obj.quaternion.w)
	scene.add(BoxMesh)
	const defaultMaterial = new CANNON.Material('default')
	const BoxShape = new CANNON.Box(new CANNON.Vec3(obj.scale.x*0.5,obj.scale.y*0.5,obj.scale.z*0.5))
	const body = new CANNON.Body({
		mass: 0,
		position: new CANNON.Vec3(obj.position.x,obj.position.y,obj.position.z),
		shape: BoxShape,
		material: defaultMaterial
	})
	body.position.copy(obj.position)
	body.quaternion.set(obj.quaternion.x, obj.quaternion.y, obj.quaternion.z,obj.quaternion.w)
	world.addBody(body);
	stepObjList.push(new StepObject(obj.uuid, BoxMesh, body));

	addObsctacleEvent(obj, body);
	
	let name = obj.name;
	if(name == "EndBox" || name == "SaveBox")
		checkpoint(body, name);
}

function addObsctacleEvent(obj, body) {
	let index = getEventObstacleIndex(obj);
	if(index >= 0) {
		let eventObstacle = JSON.parse(JSON.stringify(event_obstacle));

		body.addEventListener("collide", function() {	
			setInterval(function() {fallObstacle(index)}, eventObstacle.set[index].obstacle.delay);
		});
	}
}

function fallObstacle(obstacleIndex) {
	let eventObstacle = JSON.parse(JSON.stringify(event_obstacle));
	for(var j = 0; j < stepObjList.length; j++) {
		if(stepObjList[j].uuid == eventObstacle.set[obstacleIndex].obstacle.uuid) {
			stepObjList[j].body.mass = 1;
			break;
		}
	}
}

function getEventObstacleIndex(obj) {
	let eventObstacle = JSON.parse(JSON.stringify(event_obstacle));
	for(var i = 0; i < eventObstacle.set.length; i++) {
		if(obj.uuid == eventObstacle.set[i].step.uuid)
			return i;
	}

	return -1;
}

class StepObject {
	constructor (uuid, mesh, body) {
		this.uuid = uuid;
		this.mesh = mesh;
		this.body = body;
	}
}