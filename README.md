# DontShotgun
Term project for Computer Graphics lecture

[Team member emails]
- 김현종 (guswhd5738@gachon.ac.kr)
- 류상연 (teryas@gachon.ac.kr)
- 이준희 (ljntiger325@naver.com)
- 한성구 (skwms1223@gachon.ac.kr)

[Trailer Video]
- https://youtu.be/pOLX3nZ9XK0

## Introduction
A jump action game in which the user does not have the initiative to jump.
- The goal is to reach the destination by manipulating the character according to the timing of jumping at regular intervals.
- It consists of two maps: a tutorial and a main stage.
- The super jump skill can be properly utilized to correct the timing mistakes of character movement, or to reach the high area at once.
- Since the death count is recorded and displayed, reaching the destination with a minimum death count can be a criterion for proficiency.

## Screenshots
<img src="/screenshots/StageSelection.png" width="960" height="540" title="Main Screen" alt="Stage Selection"></img>
<img src="/screenshots/Tutorial0.png" width="960" height="540" title="Main Screen" alt="Stage Selection"></img>
<img src="/screenshots/Tutorial1.png" width="960" height="540" title="Main Screen" alt="Stage Selection"></img>
<img src="/screenshots/Tutorial2.png" width="960" height="540" title="Main Screen" alt="Stage Selection"></img>
<img src="/screenshots/MainStage0.png" width="960" height="540" title="Main Screen" alt="Stage Selection"></img>
<img src="/screenshots/MainStage1.png" width="960" height="540" title="Main Screen" alt="Stage Selection"></img>

## How to play
[Playing game]

There are two ways to play the game.
1. Add "--disable-web-security --user-data-dir=%LOCALAPPDATA%\Google\chromeTemp-–allow-file-access-from-files" as the execution option for the Chrome browser
2. Either build your own web server, or build a simple web server with an extension program such as "Web Server for Chrome" to specify a folder for the game and connect it to a local host.


[Controll buttons]
- W: Move forward
- A: Move left
- S: Move backward
- D: Move right
- E: Super jump
- Shift: Sprint
- Tab: Stage selection menu

## Development Environment
- Web Application: HTML5 + CSS + Javascript
- THREE.js
- CANNON.js

## External Resource Source
- [THREE.js]                  https://github.com/mrdoob/three.js
- [CANNON.js]                 https://github.com/schteppe/cannon.js
- [RobotExpressive.glb]       https://github.com/mrdoob/three.js/tree/master/examples/models/gltf/RobotExpressive
- [SheenChair.glb]            https://github.com/mrdoob/three.js/blob/master/examples/models/gltf/SheenChair.glb
- [crate.gif]                 https://github.com/mrdoob/three.js/blob/master/examples/textures/crate.gif
- [asteroid.png]              https://blog.naver.com/foxmann/90150373730
- [Space background images]   https://www.eso.org/public/images/
