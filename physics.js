const world = new CANNON.World();

function physicsTest() {
    world.gravity.set(0, -9.82, 0);
    console.log("physics test");
}