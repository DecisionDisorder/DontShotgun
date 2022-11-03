// Debugging Mode
var debug = false;

// Variables for using animations in models
let container, clock, mixer, actions, activeAction, previousAction, isJumping = false;
var keypressed = [false, false, false, false] 	// The key currently being pressed [w, a, s, d]
var jumpSpeed = 0.5;							// Jump animation speed ratio
var moveSpeed = 0.1;							// Character moving speed on floor
var moveForce = 10;								// Character moving force when jumping
var jumpForce = 10;								// Impulse jump force
var sprintRatio = 2;							// Speed magnification when running
var isSprinting = false;						// Whether character is running
var isPointerLocked = false;					// Whether mouse pointer is locked
var player;										// Player object(THREE.js)
const initRespawnPosition = {x: 0, y: 2, z: 0};	// Initial respawn position
var respawnPosition = {							// Respawn position (can be changed) and initialize it
	x: initRespawnPosition.x, 
	y: initRespawnPosition.y, 
	z: initRespawnPosition.z
};

var currentStage = 0;		// Current stage (Tutorial: 0, Main stage: 1)

var deathCount = 0;			// Death count of player
var isPlayerAlive = true;	// Whether player is alive

const playerSize = 3;		// The length of the player
const playerHeight = 4.5;	// The height of the player

var pause = false;			// Whether the game is paused
const gravity = 25;			// Gravity of the world
const deathDepth = -20;		// The standard depth of death

// The world in which the laws of physics are to be calculated by cannon.js
const world = new CANNON.World();
// Physical appearance
const playerShape = new CANNON.Box(new CANNON.Vec3(playerSize / 2, playerHeight / 2, playerSize / 2));
// Rigidbody in cannon.js
const playerBody = new CANNON.Body({
	mass:1,
	position: new CANNON.Vec3(0, 2, 0)
});
const scene = new THREE.Scene(); 	// The scene where THREE.js will configure the screen
var renderer;						// Renderer of THREE in WebGL environment

var stepObjList = [];				// List of step objects

const KeyCode = {					// Key codes to be entered
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

const initSuperJumpCoolTime = 10;	// Super jump skill cool time
var superJumpForce = 50;			// Super Jumping Force
var superJumpCoolTime = 0;			// Current super jump skill cool time

const init_theta = 0;				// Initial camera height angle
const init_phi = 3.14;				// Initial camera rounding angle
var theta = init_theta;				// Camera height angle
var phi = init_phi;					// Camera rounding angle

const api = {state: 'Idle'};		// Default animation status

// Animation of models separated by status
const states = [ 'Idle', 'Walking', 'Running', 'Dance', 'Death', 'Sitting', 'Standing' ];
// Animation of models separated by emotes
const emotes = [ 'Jump', 'Yes', 'No', 'Wave', 'Punch', 'ThumbsUp' ];

var renderAnim = null;				// Render animation request id
var jumpIntervalId = null;			// Jump interval id

window.onload = function init()
{
	// Load and set canvas size
	const canvas = document.getElementById("gl-canvas");
	canvas.width = window.innerWidth;
	canvas.height = window.innerHeight;

	// Create THREE.js Renderer and set size
	renderer = new THREE.WebGLRenderer({canvas});
	renderer.setSize(canvas.width,canvas.height);

	// Create camera and set position
	camera = new THREE.PerspectiveCamera(75, canvas.width / canvas.height, 0.1, 1000);
	camera.rotation.y = 45 / 180 * Math.PI;
	camera.position.x = 10;
	camera.position.y = 10;
	camera.position.z = 10;

	// Create clock object
	clock = new THREE.Clock();

	// Initialize Stage selection UI
	initStageSelection();
	// Load tutorial map in basic
	loadTutorialMap();

	// Set keyboard input and mouse pointer lock event
	setKeyboardInput();
	setMousePointerLock();
	
	// Active Stage selection UI
	activeStageSelection(true);
}

// Create lights for the scene
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
	// Load animation mixer for the player model
	mixer = new THREE.AnimationMixer(model);
	// Animation actions
	actions = {};

	// Register animations 
	for (let i = 0; i < animations.length; i++) {

		const clip = animations[i];
		const action = mixer.clipAction(clip);
		actions[clip.name] = action;

		if (emotes.indexOf(clip.name) >= 0 || states.indexOf(clip.name) >= 4) {
			action.clampWhenFinished = true;
			action.loop = THREE.LoopOnce;
		}
	}
	// Initialize with 'Idle' animation motion
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
	// Check for jumping condition
	if(isPlayerAlive && !isJumping) {
		// Physically jump as start the jump animation
		executeEmote("Jump", restoreState);
		setTimeout(jumpOnPhysics, 400);
	}
}

// Physically jump the character.
function jumpOnPhysics() {
	// Apply force for jumping considering the direction in progress
	isJumping = true;
	var jumpDirection = getMovingDirection() * getCalculatedSpeed(moveForce);
	playerBody.applyLocalImpulse(new CANNON.Vec3(jumpDirection.x, jumpForce, jumpDirection.z), new CANNON.Vec3(0, 0, 0));
	playerBody.addEventListener("collide", disableJump);
}

// Restore the animation
function restoreState() {
	mixer.removeEventListener('finished', restoreState);
	fadeToAction(api.state, 0.2);
}

// Set walking animation
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
	// Lock the mouse pointer when click the web page
	document.addEventListener('click', function(event) {
		if(!pause)
			document.body.requestPointerLock();
	});

	// Mouse moving event when pointer is locked 
	document.addEventListener('mousemove', function(event) {
		if(isPointerLocked) {
			moveCamera(event.movementX, event.movementY);
		}
	});

	// Pointer lock change event
	document.addEventListener('pointerlockchange', function(event) {
		if(document.pointerLockElement === document.body) {
			isPointerLocked = true;
		}
		else {
			isPointerLocked = false;
		}
	});
}

// Speed calculation based on various conditions
function getCalculatedSpeed(speed, deltaTime) {
	if(isSprinting) 
		return sprintRatio * speed * (deltaTime / (1 / 60));
	else
		return speed * (deltaTime / (1 / 60));
}

// Move the character according to the user's keyboard input
function movePlayer(deltaTime) {
	// Check if player is alive
	if(isPlayerAlive) {
		// Calculate the direction, speed, and force according to the keyboard input
		var movingDirection = getMovingDirection();
		var calculatedMoveForce = getCalculatedSpeed(moveForce, deltaTime);
		var calculatedMoveSpeed = getCalculatedSpeed(moveSpeed, deltaTime);

		// When jumping, a physical force is applied in a certain direction in the air
		if(isJumping) {
			playerBody.applyLocalForce(new CANNON.Vec3(movingDirection.x * calculatedMoveForce, 0, movingDirection.z * calculatedMoveForce), new CANNON.Vec3(0, 0, 0));
		}
		else {
			// When the player is attached to the ground, it moves in the local coordinates.
			let relativeVector = new CANNON.Vec3(movingDirection.x * calculatedMoveSpeed, 0, movingDirection.z * calculatedMoveSpeed);

			// Use quaternion to rotate the relative vector, store result in same vector
			playerBody.quaternion.vmult(relativeVector, relativeVector);

			// Add position and relative vector, store in body.position
			playerBody.position.vadd(relativeVector, playerBody.position);
		}
	}
}

// Set direction according to keyboard
function getMovingDirection() {
	var direction = new THREE.Vector3(0, 0, 0);
	direction.z = (keypressed[0] ? 1 : 0) + (keypressed[2] ? -1 : 0);
	direction.x = (keypressed[1] ? 1 : 0) + (keypressed[3] ? -1 : 0);
	return direction;
}

// Convert angle to radian
function angleToRadian(angle) {
	return angle * Math.PI / 180;
}

// Move and rotate camera according to player's position and angles 
function moveCamera(moveX, moveY) {
	// Numerical calculations based on mouse movement
	var mouseSpeed = 2;
	phi -= moveX * 0.001 * mouseSpeed;
	theta += moveY * 0.001 * mouseSpeed;

	// Limit of camera angle
	if(theta > angleToRadian(80))
		theta = angleToRadian(80);
	else if(theta < angleToRadian(-60))
		theta =  angleToRadian(-60);

	// Apply camera position with player's position and angles
	setCameraPosition();
	if(isPlayerAlive)
		playerBody.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), phi + Math.PI);
}

// Calculate camera's position and angle
function setCameraPosition() {
	var cameraDistHeight = 10;	// Camera distance on height
	var modelHeight = 3;		// Model height
	var cameraDist = 10;		// A straight distance from the camera

	// Apply camera position with player's position and angles
	camera.position.x = player.position.x + cameraDist * Math.cos(theta) * Math.sin(phi);
	camera.position.y = player.position.y + modelHeight + cameraDistHeight * Math.sin(theta);
	camera.position.z = player.position.z + cameraDist * Math.cos(theta) * Math.cos(phi) ;
	camera.lookAt(player.position);
}

// Set keyboard input event
function setKeyboardInput() {
	document.onkeydown = function(event) {
		console.log(event.keyCode);
		switch(event.keyCode) {
		case KeyCode.SPACE:		// Respawn key
			respawn();
			break;
		case KeyCode.TAB:		// Stage selection key
			activeStageSelection(true);
			break;
		case KeyCode.SHIFT: 	// Sprint key
			isSprinting = true;
			break;
		case KeyCode.W: 		// Move forward key
			keypressed[0] = true;
			walk();
			break;
		case KeyCode.A: 		// Move left key
			keypressed[1] = true;
			walk();
			break;
		case KeyCode.S: 		// Move backward key
			keypressed[2] = true;
			walk();
			break;
		case KeyCode.D: 		// Move right key
			keypressed[3] = true;
			walk();
			break;
		case KeyCode.E:			// Super jump skill key
			superJumpSkill();
			break;
		case 13:
			stageClear();
			break;
		}
	};
	document.onkeyup = function(event) {
		switch(event.keyCode) {
		case KeyCode.SHIFT:	// Disable sprint
			isSprinting = false;
			break;
		case KeyCode.W: 	// Disable move forward
			keypressed[0] = false;
			break;
		case KeyCode.A: 	// Disable move left
			keypressed[1] = false;
			break;
		case KeyCode.S: 	// Disable move backward
			keypressed[2] = false;
			break;
		case KeyCode.D: 	// Disable move right
			keypressed[3] = false;
			break;
		}
	};
}

// Disable all moving key
function disableKeyInput() {
	for (var i = 0; i < keypressed.length; i++)
		keypressed[i] = false;
}

// Create the hit box of the player (For debugging)
function createPlayerHitBox() {
	// Create box geometry with player model size
	playerBox = new THREE.BoxGeometry(playerSize, playerHeight, playerSize);
	var playerMaterial = new THREE.MeshPhongMaterial({color: 0x882288});
	playerMaterial.transparent = true;
	if(debug)
		playerMaterial.opacity = 0.5;
	else
		playerMaterial.opacity = 0.0;
	
	// Create box mesh with player box and phong material
	playerBoxMesh = new THREE.Mesh(playerBox, playerMaterial);
	scene.add(playerBoxMesh);
}

// Initialize physics settings
function initPhysics() {
	// Set the gravity of the world
    world.gravity.set(0, -gravity, 0);
	// Disable rotation of player body and make physical body of player
	playerBody.fixedRotation = true;
	playerBody.addShape(playerShape);
	playerBody.position.set(respawnPosition.x, respawnPosition.y, respawnPosition.z);
	world.addBody(playerBody);
	
	// Generate the physical material of the floor and player
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

	// Set the physical material of the world
	world.addContactMaterial(playerFloorContactMaterial);
	playerBody.material = playerPhysicsMaterial;
	stepObjList[0].body.material = floorPhysicsMaterial;
}

// 
function playerPhysics() {
	// Sync the player mesh and physical body of the player
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

	// Player hit box follows the physical body of the player(For Debugging)
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

	// Verify that the player's current position corresponds to a game over
	checkGameOver();
}

// Checking if the position of the player is under the death zone
function checkGameOver() {
	if(playerBody.position.y < deathDepth && isPlayerAlive) {
		death();
	}
}

// Handling Player Deaths 
function death() {
	if(isPlayerAlive){
		isPlayerAlive = false;
		deathCount++;
		restoreState();
		fadeToAction("Death", 0.5);
		document.getElementById('ui-game-over').style.visibility = "visible";
	}
}

// Respawn player
function respawn() {
	if(!isPlayerAlive) {
		// Reposition to respawn position and reset some settings
		playerBody.position.set(respawnPosition.x, respawnPosition.y, respawnPosition.z);
		isPlayerAlive = true;
		fadeToAction("Idle", 0.5);
		document.getElementById('ui-game-over').style.visibility = "hidden";
		phi = init_phi;
		theta = init_theta;
	}
}

// Load model files to the map
function loadModelMap() {
	// Load and parse model json data
	let mapData = JSON.parse(JSON.stringify(model_map));

	// Repeat for all individual modeling data
	for(var i = 0; i < mapData.model.length; i++) {
		let modelPos = mapData.model[i].position;	// World position of the model
		let modelScale = mapData.model[i].scale;	// World scale of the model
		var modelPath = mapData.model[i].path;		// Path of the gltf file

		// Load model file by GLTFLoader
		const loader = new THREE.GLTFLoader();
		loader.load(modelPath, function(gltf){
			// Get model and set position & scale
			var mapModel = gltf.scene;
			mapModel.position.set(modelPos.x, modelPos.y, modelPos.z);
			mapModel.scale.set(modelScale.x, modelScale.y, modelScale.z);
			scene.add(gltf.scene);

			// Create the physical body of the model
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

// Load texture of the boxes on the world
function loadMapTexture(mapCategory) {
	// Load texture json data by map category
	let mapTextureData;
	if(mapCategory == "Tutorial")
		mapTextureData = JSON.parse(JSON.stringify(map_texture_tutorial));
	else if(mapCategory = "Main")
		mapTextureData = JSON.parse(JSON.stringify(map_texture_main));

	// Repeat for all texture data
	for(var i = 0; i < mapTextureData.data.length; i++) {
		var targetIndex = mapTextureData.data[i].target_index;  // Index of texture in step object list
		var texturePath = mapTextureData.data[i].path;			// Path of the texture image file 

		// Apply the texture of the box
		const texture = new THREE.TextureLoader().load(texturePath);
		const material = new THREE.MeshBasicMaterial({map: texture});
		stepObjList[targetIndex].mesh.material = material;
	}
}

// Manage super jump skill's cool time
function superJumpCoolDown(deltaTime) {
	// Check if cool down is needed
	if(superJumpCoolTime > 0) {
		// Deducted by the time passed
		superJumpCoolTime -= deltaTime;

		// Activate skill when cooldown is complete
		if(superJumpCoolTime < 0) {
			superJumpCoolTime = 0;
			document.getElementById("cool-down-timer-0").style.visibility = "hidden";
			document.getElementById("cool-time-text-0").style.visibility = "hidden";
			document.getElementById("skill-key-guide-0").style.visibility = "visible";
		}
		
		// UI update showing remaining cool time
		document.getElementById("cool-time-text-0").innerText = Math.ceil(superJumpCoolTime);
		document.getElementById("cool-down-timer-0").style.height = (superJumpCoolTime / initSuperJumpCoolTime * 100);
	}
}

// Invoke the super jump skill
function superJumpSkill() {
	// Skill is triggered only when the player is alive
	if(isPlayerAlive && superJumpCoolTime == 0) {
		// Physically jump as start the jump animation
		executeEmote("Jump", restoreState);
		setTimeout(superJumpOnPhysics, 400);

		// Active cool down UI
		document.getElementById("cool-down-timer-0").style.visibility = "visible";
		document.getElementById("cool-time-text-0").style.visibility = "visible";
		document.getElementById("skill-key-guide-0").style.visibility = "hidden";

		// Reset cool time
		superJumpCoolTime = initSuperJumpCoolTime;
	}
}

// Disable jump state
function disableJump() {
	isJumping = false;
	playerBody.removeEventListener("collide", disableJump);
}

// Physically super jump
function superJumpOnPhysics() {
	// Apply force for jumping considering the direction in progress
	isJumping = true;
	var jumpDirection = getMovingDirection() * getCalculatedSpeed(moveForce);
	playerBody.applyLocalImpulse(new CANNON.Vec3(jumpDirection.x, superJumpForce, jumpDirection.z), new CANNON.Vec3(0, 0, 0));
	playerBody.addEventListener("collide", disableJump);
}

// Set check point with checkPointBody according to specific type
function checkpoint(checkPointBody, type) {
	// Add collide event
	checkPointBody.addEventListener("collide", function(e) {
		// Update the respawn position
		if(type == "SaveBox") {
			respawnPosition.x = e.target.position.x;
			respawnPosition.y = e.target.position.y + 3;
			respawnPosition.z = e.target.position.z;
			console.log("Respawn position saved.");
		}
		// Stage clear 
		else if(type == "EndBox") {
			stageClear();
			console.log("Clear Event");
		}
		console.log("Collide with check point!");
	})
}

// Activate the stage clear GUI
function stageClear() {
	const gameClearUI = document.getElementById("ui-stage-clear");
	const gameClearText = document.getElementById("text-game-clear");
	gameClearUI.style.visibility = "visible";
	if(currentStage == 0) {
		gameClearText.innerText = "Tutuial Cleared!\nPress TAB to play main stage";
	}
	else {
		gameClearText.innerText = "Game Clear!";
	}
}

// Initialize Stage selection UI
function initStageSelection() {
	// Get elements from HTML (tutorial/main stage and close)
	var tutorialButton = document.getElementById("button-stage-tutorial");
	var mainStageButton = document.getElementById("button-stage-main");
	var closeStage = document.getElementById("button-close-stage");
	
	// Load tutorial map
	tutorialButton.addEventListener("click", function() {
		activeStageSelection(false);
		loadTutorialMap();
	});
	// Load main stage map
	mainStageButton.addEventListener("click", function() {
		activeStageSelection(false);
		loadMainStageMap();
	});
	// Close selection menu
	closeStage.addEventListener("click", function() {
		activeStageSelection(false);
	});
}

// Activate/Deactivate the stage selection menu
function activeStageSelection(active) {
	// Get stage selection menu
	var stageContainer = document.getElementById("ui-select-stage");
	
	// Activate the stage selection menu and release mouse pointer lock
	if(active) {
		pause = true;
		stageContainer.style.visibility = "visible";
		disableKeyInput();
		document.exitPointerLock();
	}
	// Deactivate the stage selection menu
	else {
		pause = false;
		stageContainer.style.visibility = "hidden";
	}
}

// Clear scene and world to change map
function clearScene() {
	scene.remove.apply(scene, scene.children);
	for (var i = 0; i < world.bodies.length; i++)
		world.remove(world.bodies[i]);
}

// Reset respawn position
function resetRespawn() {
	respawnPosition.x = initRespawnPosition.x;
	respawnPosition.y = initRespawnPosition.y; 
	respawnPosition.z = initRespawnPosition.z;
}

// Reset map settings
function resetOthers() {
	// Reset skill cool time
	superJumpCoolDown(initSuperJumpCoolTime);

	// Reset camera position
	phi = init_phi;
	theta = init_theta;

	// Reset step object list
	stepObjList = [];
}

// Load player model
function loadPlayer() {
	// Clear rendering iteration
	if(renderAnim != null)
		cancelAnimationFrame(renderAnim);

	// Load player gltf model, load animations, and start rendering
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

// Load tutorial map
function loadTutorialMap() {
	// Initialize tutorial map setting
	currentStage = 0;
	clearScene();
	resetOthers();
	resetRespawn();
	loadPlayer();

	// Load background of the map
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
	
	// Load step blocks from json data
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

	// Set the jumping interval
	if(jumpIntervalId != null)
		clearInterval(jumpIntervalId);
	jumpIntervalId = setInterval(jump, 1000/jumpSpeed);
	
	// Load and set map environments
	loadLights();
	createPlayerHitBox();
	createFloor();
	initPhysics();
	loadModelMap();	
	
	document.getElementById("ui-stage-clear").style.visibility = "hidden";
}

// Load main stage map
function loadMainStageMap() {
	// Initialize main stage map setting
	currentStage = 1;
	clearScene();
    resetOthers();
    resetRespawn();
    loadPlayer();

	// Load background of the map
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
    
	// Load step blocks from json data
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
	// Set the jumping interval
    if(jumpIntervalId != null)
        clearInterval(jumpIntervalId);
    jumpIntervalId = setInterval(jump, 1000/jumpSpeed);
    
	// Load and set map environments
    loadLights();
    createPlayerHitBox();
    createFloor();
    initPhysics();
    loadModelMap(); 
	
	document.getElementById("ui-stage-clear").style.visibility = "hidden";
}

// Render scene
function render() {
	// Get the delta time between the frame and the frame.
	const dt = clock.getDelta();

	// Update animation and physics world
	if(!pause) {
		if(mixer) mixer.update(dt);
		world.step(1/60, dt, 3);
	}

	// Update player's state
	movePlayer(dt);
	playerPhysics();
	setCameraPosition();
	superJumpCoolDown(dt);

	// Rendering of three.js and repeat in the next frame
	renderAnim = requestAnimationFrame(render);
	renderer.render(scene, camera);
}

// Create starting floor
function createFloor() {
	// Create starting point box
	const floorGeometry = new THREE.BoxGeometry(20, 0.1, 20);
	const floorMesh = new THREE.Mesh(floorGeometry, new THREE.MeshPhongMaterial());
	floorMesh.receiveShadow = true;
	scene.add(floorMesh);
	// Create starting point physical body
	const floorShape = new CANNON.Box(new CANNON.Vec3(10, 0.05, 10));
	const floorBody = new CANNON.Body({mass: 0});
	floorBody.addShape(floorShape);
	
	// Create death floor
	const deathFloorShape = new CANNON.Plane();
	const deathFloorBody = new CANNON.Body({mass: 0});
	deathFloorBody.addShape(deathFloorShape);
	deathFloorBody.quaternion.setFromAxisAngle(new CANNON.Vec3(-1, 0, 0), Math.PI / 2);
	deathFloorBody.position.y = deathDepth - 5;

	// Add bodies to the world
	world.addBody(floorBody);
	world.addBody(deathFloorBody);

	// Add starting point to step object list
	stepObjList.push(new StepObject("first_floor", floorMesh, floorBody));
}

// Create step boxes
function createStep(obj) {
	// Create box mesh
	const BoxGeometry = new THREE.BoxGeometry(obj.scale.x,obj.scale.y,obj.scale.z);
	const BoxMesh = new THREE.Mesh(BoxGeometry, new THREE.MeshPhongMaterial());
	BoxMesh.receiveShadow = true;
	BoxMesh.position.copy(obj.position)
	BoxMesh.quaternion.set(obj.quaternion.x, obj.quaternion.y, obj.quaternion.z,obj.quaternion.w)
	scene.add(BoxMesh)
	// Create step box's physical body
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

	// Add step to the step object list
	stepObjList.push(new StepObject(obj.uuid, BoxMesh, body));

	// Add obstacle event
	addObsctacleEvent(obj, body);
	
	// Set checkpoints according to the name of the box
	let name = obj.name;
	if(name == "EndBox" || name == "SaveBox")
		checkpoint(body, name);
}

// Add obstacle collision event
function addObsctacleEvent(obj, body) {
	// Get obstacle's index in json
	let index = getEventObstacleIndex(obj);
	if(index >= 0) {
		// Get obstacle data
		let eventObstacle = JSON.parse(JSON.stringify(event_obstacle));
		// Count of obstacle fall
		let count = {value: 0};

		// When a player steps on a particular box, 
		// the count increases and drops the obstacle after a certain period of time
		body.addEventListener("collide", function(e) {
			if(e.body.type == 1){
				if(count.value < 1) {
					count.value = 1;
					console.log("count: " + count.value);
					setTimeout(fallObstacle, Number(eventObstacle.set[index].obstacle.delay), index, body, count);
				}
			}
		});
	}
}

// Find an object that should fall and set it to fall
function fallObstacle(obstacleIndex, eventBody, count) {
	let eventObstacle = JSON.parse(JSON.stringify(event_obstacle));
	for(var j = 0; j < stepObjList.length; j++) {
		if(stepObjList[j].uuid == eventObstacle.set[obstacleIndex].obstacle.uuid) {
			// Set the original position of the obstacle
			const originalPosition = { x: stepObjList[j].body.position.x, y: stepObjList[j].body.position.y, z: stepObjList[j].body.position.z };
			stepObjList[j].body.force.set(0, 0, 0);
			stepObjList[j].body.velocity.set(0, 0, 0);
			stepObjList[j].body.type = CANNON.Body.DYNAMIC;
			stepObjList[j].body.mass = 10;
			stepObjList[j].body.updateMassProperties();

			// If a player collides with an obstacle, the player dies
			stepObjList[j].body.addEventListener("collide", function(e) {
				if(e.body.type == 1)
					death();
			});
			followFallingObstacle(stepObjList[j], eventBody, originalPosition, count);
			break;
		}
	}
}

// The body moved by the laws of physics is followed by the mesh
function syncObjects(stepObject) {
	stepObject.mesh.position.set(
		stepObject.body.position.x,
		stepObject.body.position.y,
		stepObject.body.position.z
	);

	stepObject.mesh.quaternion.set(
		stepObject.body.quaternion.x,
		stepObject.body.quaternion.y,
		stepObject.body.quaternion.z,
		stepObject.body.quaternion.w,
	);
}

// Management of falling obstacles
function followFallingObstacle(stepObject, eventBody, originalPosition, count) {
	syncObjects(stepObject);

	// If the obstacle falls down or does not move, reset it.
	if(eventBody.position.y - 10 <= stepObject.body.position.y && (stepObject.body.position.y > originalPosition.y - 10 || stepObject.body.velocity.y < -0.1))
		requestAnimationFrame(function() {followFallingObstacle(stepObject, eventBody, originalPosition, count);});
	else {
		stepObject.body.mass = 0;
		stepObject.body.type = CANNON.Body.STATIC;
		stepObject.body.velocity.set(0, 0, 0);
		stepObject.body.position.set(originalPosition.x, originalPosition.y, originalPosition.z);
		stepObject.body.quaternion.set(0, 0, 0, 0);
		stepObject.body.updateMassProperties();
		syncObjects(stepObject);
	}
		
}

// Find obstacle's index in the obstacle json data by uuid
function getEventObstacleIndex(obj) {
	let eventObstacle = JSON.parse(JSON.stringify(event_obstacle));
	for(var i = 0; i < eventObstacle.set.length; i++) {
		if(obj.uuid == eventObstacle.set[i].step.uuid)
			return i;
	}

	return -1;
}

// Class that contains uuid, mesh, and body of one staff object
class StepObject {
	constructor (uuid, mesh, body) {
		this.uuid = uuid;	// Object uuid on map json
		this.mesh = mesh;	// Mesh(THREE)
		this.body = body;	// Body(Cannon.js)
	}
}