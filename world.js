import * as three from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { GUI } from "dat.gui";
import Maze3D from "maze3d/maze3d-es-node";
import { AmbientLight, BoxGeometry, MeshPhongMaterial } from "three";

/* 
Credit where credit is due:
https://discoverthreejs.com/ content helped me to strucutre this code
https://discourse.threejs.org/ helped to debug the code
*/

class renderClock {
  constructor(camera, scene, renderer) {
    this._camera = camera;
    this._scene = scene;
    this._renderer = renderer;
    // Contains a list of all items that need to be animated each render
    this.updateables = [];
    this.clock = new three.Clock();
  }
  start() {
    // Use setAnimationLoop instead of requestAnimationFrame to deal with WebXR Device API
    this._renderer.setAnimationLoop(() => {
      this._tickManager();
      this._renderer.render(this._scene, this._camera);
    });
  }
  stop() {
    this._renderer.setAnimationLoop(null);
  }
  _tickManager() {
    const delta = this.clock.getDelta();
    const elapsedTime = this.clock.elapsedTime;
    for (let obj of this.updateables) {
      obj.tick(delta, elapsedTime);
    }
  }
}
export default class WorldTemplate {
  constructor(container) {
    const ref = this;
    // Basic scene setup
    this._volLimit = 2000;
    this._maxX = 100;
    this._maxY = 100;
    this._maxZ = 100;
    this._container = container;
    this._scene = new three.Scene();
    this._renderer = this._createRenderer();
    this._container.append(this._renderer.domElement);
    this._camera = this._createCamera();
    this._renderClock = new renderClock(this._camera, this._scene, this._renderer);
    this._controls = this._createOrbitControls();
    this._renderClock.updateables.push(this._controls);
    this._GUI = new GUI();
    this._clientMaze = new Maze3D();
    this._camera.position.set(
      this._clientMaze.constraints.width * 2,
      this._clientMaze.constraints.depth * 2,
      this._clientMaze.constraints.height * 2
    );
    this._clientMaze.constraints.sliceOffVoid = true;
    this._clientMaze.setDefaultSpotLightOptions();
    this._guiLightOptions = JSON.parse(JSON.stringify(this._clientMaze._lightOptions));
    this._clientMaze.setDefaultAnimationOptions();
    this._clientMaze.setDefaultModelOptions();
    this._guiSolve = {
      startX: 1,
      startY: 0,
      startZ: 0,
      endX: this._clientMaze.constraints.width - 2,
      endY: this._clientMaze.constraints.height - 1,
      endZ: this._clientMaze.constraints.depth - 1
    };
    this._completeModelLoadFromTemplate();
    this._clientMaze.generateSpotLights(
      this._renderer,
      Object.assign(this._guiLightOptions, this._clientMaze.getCornerSpotLightData())
    );
    this._clientMaze.modelAPI("addLights", this._scene);
    // Start and End boxes
    this._startBox = new three.Mesh(
      new BoxGeometry(1.1, 1.1, 1.1),
      new MeshPhongMaterial({
        color: this._clientMaze._modelOptions.path.color,
        opacity: this._clientMaze._modelOptions.path.opacity
      })
    );
    this._scene.add(this._startBox);
    this._endBox = new three.Mesh(
      new BoxGeometry(1.1, 1.1, 1.1),
      new MeshPhongMaterial({
        color: 0xff0000,
        opacity: this._clientMaze._modelOptions.path.opacity
      })
    );
    this._scene.add(this._endBox);
    this._positionSolveBoxes();
    this._guiHelpers = {
      showLightHelpers: false,
      showShadowHelpers: false
    };
    let renderClockTickController = {
      tick: (d) => {
        if (this._guiHelpers.showLightHelpers) {
          ref._clientMaze.modelAPI("updateLightHelpers");
        }
        if (this._guiHelpers.showShadowHelpers) {
          ref._clientMaze.modelAPI("updateShadowHelpers");
        }
        if (ref._currentShowing === "playAnimation") {
          ref._clientMaze.animationMixersAPI("update", d);
        }
      }
    };
    this._renderClock.updateables.push(renderClockTickController);
    this._AxesHelper = new three.AxesHelper(this._getLargetLimitAxis());
    this._GridHelper = new three.GridHelper(500, this._getLargetLimitAxis());
    this._ambientLightSettings = {
      intensity: 0,
      light: new AmbientLight(0xffffff, 0)
    };
    this._scene.add(this._ambientLightSettings.light);
    this._backDropBuffer = 20;
    this._guiBackDrop = {
      enabled: false
    };
    this._guiAnimationMixerSettings = {
      timeScale: 1
    };
    this._generateGUI();
    this._generateBackDrop();
  }
  _generateBackDrop() {
    const { constraints } = this._clientMaze;

    this._backDropY = new three.Mesh(
      new three.BoxGeometry(
        constraints.width + this._backDropBuffer * 2,
        1,
        constraints.depth + this._backDropBuffer * 2
      ),
      new three.MeshPhongMaterial()
    );
    this._backDropY.rotation.Y = Math.PI / 2;
    this._backDropY.position.y = constraints.height + this._backDropBuffer;
    this._backDropY.position.x = constraints.width / 2;
    this._backDropY.position.z = constraints.depth / 2;
    this._backDropY.receiveShadow = true;
    this._backDropY.visible = false;
    this._scene.add(this._backDropY);

    this._backDropZ = new three.Mesh(
      new three.BoxGeometry(
        constraints.width + this._backDropBuffer * 2,
        constraints.height + this._backDropBuffer * 2,
        1
      ),
      new three.MeshPhongMaterial()
    );
    this._backDropZ.position.y = constraints.height / 2;
    this._backDropZ.position.x = constraints.width / 2;
    this._backDropZ.position.z = constraints.depth + this._backDropBuffer;
    this._backDropZ.receiveShadow = true;
    this._backDropZ.visible = false;
    this._scene.add(this._backDropZ);

    this._backDropX = new three.Mesh(
      new three.BoxGeometry(
        1,
        constraints.depth + this._backDropBuffer * 2,
        constraints.height + this._backDropBuffer * 2
      ),
      new three.MeshPhongMaterial()
    );
    this._backDropX.rotation.x = Math.PI / 2;
    this._backDropX.position.y = constraints.height / 2;
    this._backDropX.position.x = constraints.width + this._backDropBuffer;
    this._backDropX.position.z = constraints.depth / 2;
    this._backDropX.receiveShadow = true;
    this._backDropX.visible = false;
    this._scene.add(this._backDropX);
  }
  _updateBackDrop() {
    this._backDropY.visible = this._guiBackDrop.enabled;
    this._backDropZ.visible = this._guiBackDrop.enabled;
    this._backDropX.visible = this._guiBackDrop.enabled;
    // Only update when they are visible
    if (this._guiBackDrop.enabled) {
      const { constraints } = this._clientMaze;
      this._backDropY.geometry.dispose();
      this._backDropY.geometry = new three.BoxGeometry(
        constraints.width + this._backDropBuffer * 2,
        1,
        constraints.depth + this._backDropBuffer * 2
      );
      this._backDropY.position.x = constraints.width / 2;
      this._backDropY.position.z = constraints.depth / 2;
      this._backDropY.position.y = constraints.height + this._backDropBuffer;

      this._backDropZ.geometry.dispose();
      this._backDropZ.geometry = new three.BoxGeometry(
        constraints.width + this._backDropBuffer * 2,
        constraints.height + this._backDropBuffer * 2,
        1
      );
      this._backDropZ.position.y = constraints.height / 2;
      this._backDropZ.position.x = constraints.width / 2;
      this._backDropZ.position.z = constraints.depth + this._backDropBuffer;

      this._backDropX.geometry.dispose();
      this._backDropX.geometry = new three.BoxGeometry(
        1,
        constraints.depth + this._backDropBuffer * 2,
        constraints.height + this._backDropBuffer * 2
      );
      this._backDropX.position.y = constraints.height / 2;
      this._backDropX.position.x = constraints.width + this._backDropBuffer;
      this._backDropX.position.z = constraints.depth / 2;
    }
  }
  _getLargetLimitAxis() {
    if (this._maxX > this._maxY) {
      if (this._maxX > this._maxZ) {
        return this._maxX;
      }
      return this._maxZ;
    } else {
      if (this._maxY > this._maxZ) {
        return this._maxY;
      }
      return this._maxZ;
    }
  }
  _positionSolveBoxes() {
    if (this._currentShowing !== "playAnimation" && this._currentShowing !== "solve") {
      this._startBox.position.x = this._guiSolve.startX;
      this._startBox.position.y = this._guiSolve.startY;
      this._startBox.position.z = this._guiSolve.startZ;
      this._endBox.position.x = this._guiSolve.endX;
      this._endBox.position.y = this._guiSolve.endY;
      this._endBox.position.z = this._guiSolve.endZ;
      return;
    }
    if (this._currentShowing === "playAnimation") {
      this._clientMaze.animationMixersAPI("stopAllAction");
      this._clientMaze.animationMixersAPI("removeModel", this._scene);
    }
    this._currentShowing = "barrier";
    this._decideModelLoad(false);
    this._decideShowSolveBoxesVis();
  }
  // Clear scenes
  _clearScene() {
    this._clientMaze.modelAPI("removeModel", this._scene);
    this._clientMaze.animationMixersAPI("stopAllAction");
    this._clientMaze.animationMixersAPI("removeModel", this._scene);
  }
  _completeModelLoadFromTemplate(bool) {
    this._clearScene();
    if (!bool) {
      this._clientMaze.generateMazeTemplate();
    }
    this._clientMaze.generateModel();
    this._threeModel = Object.assign({}, this._clientMaze.threeModel);
    this._clientMaze.modelAPI("addModel", this._scene);
    this._clientMaze.modelAPI("lookAtCenter", this._controls);
    this._currentShowing = "template";
  }
  _completeModelLoadFromBarrier(bool) {
    this._clearScene();
    this._currentShowing = "barrier";
    if (bool) {
      this._clientMaze.generateMazeBarriers();
    }
    this._clientMaze.generateModel();
    this._threeModel = Object.assign({}, this._clientMaze.threeModel);
    this._clientMaze.modelAPI("addModel", this._scene);
  }
  _decideModelLoad(bool = true) {
    if (this._clientMaze.path.length > 0) {
      this._clientMaze.path = [];
      this._clientMaze.mappedNumberMaze = [];
      this._clientMaze.tracedBarrierMaze = [];
    }
    if (this._currentShowing === "template") {
      this._completeModelLoadFromTemplate(bool);
    } else {
      this._completeModelLoadFromBarrier(bool);
    }
  }
  _decideModelLoadFromVolume() {
    if (
      this._clientMaze.constraints.width *
        this._clientMaze.constraints.height *
        this._clientMaze.constraints.depth <=
      this._volLimit
    ) {
      this._completeModelLoadFromBarrier(true);
    } else {
      this._completeModelLoadFromTemplate();
    }
  }
  _updateSolveMax() {
    const { __controllers } = this._GUI.__folders["Start and End"];
    __controllers["0"].__max = this._clientMaze.constraints.width - 1;
    __controllers["1"].__max = this._clientMaze.constraints.height - 1;
    __controllers["2"].__max = this._clientMaze.constraints.depth - 1;
    __controllers["3"].__max = this._clientMaze.constraints.width - 1;
    __controllers["4"].__max = this._clientMaze.constraints.height - 1;
    __controllers["5"].__max = this._clientMaze.constraints.depth - 1;
    if (this._guiSolve.startX > __controllers["0"].__max) {
      this._guiSolve.startX = __controllers["0"].__max;
    }
    if (this._guiSolve.startY > __controllers["1"].__max) {
      this._guiSolve.startY = __controllers["1"].__max;
    }
    if (this._guiSolve.startZ > __controllers["2"].__max) {
      this._guiSolve.startZ = __controllers["2"].__max;
    }
    if (this._guiSolve.endX > __controllers["3"].__max) {
      this._guiSolve.endX = __controllers["3"].__max;
    }
    if (this._guiSolve.endY > __controllers["4"].__max) {
      this._guiSolve.endY = __controllers["4"].__max;
    }
    if (this._guiSolve.endZ > __controllers["5"].__max) {
      this._guiSolve.endZ = __controllers["5"].__max;
    }
  }
  _decideShowSolveBoxesVis() {
    if (this._currentShowing !== "playAnimation" && this._currentShowing !== "solve") {
      this._startBox.visible = true;
      this._endBox.visible = true;
    } else {
      this._startBox.visible = false;
      this._endBox.visible = false;
    }
  }
  _generateLightsAndHelpersDynamically() {
    if (this._guiHelpers.showLightHelpers) {
      this._clientMaze.modelAPI("removeLightHelpers", this._scene);
    }
    if (this._guiHelpers.showShadowHelpers) {
      this._clientMaze.modelAPI("removeShadowHelpers", this._scene);
    }
    this._clientMaze.modelAPI("removeLights", this._scene);
    this._clientMaze.generateSpotLights(this._renderer);
    this._clientMaze.modelAPI("addLights", this._scene);
    if (this._guiHelpers.showLightHelpers) {
      this._clientMaze.modelAPI("addLightHelpers", this._scene);
    }
    if (this._guiHelpers.showShadowHelpers) {
      this._clientMaze.modelAPI("addShadowHelpers", this._scene);
    }
  }
  _generateGUI() {
    const guiButtonDir = {
      generateBarriers: () => {
        this._completeModelLoadFromBarrier(true);
        this._decideShowSolveBoxesVis();
      },
      solveMaze: () => {
        this._clearScene();
        this._currentShowing = "solve";
        this._decideShowSolveBoxesVis();
        let start = [this._guiSolve.startZ, this._guiSolve.startY, this._guiSolve.startX];
        let end = [this._guiSolve.endZ, this._guiSolve.endY, this._guiSolve.endX];
        while (this._clientMaze.path.length === 0) {
          try {
            this._clientMaze.solveMaze(start, end);
          } catch (e) {
            if (e.message.startsWith("solveMaze Error 4")) {
              this._clientMaze.generateMazeBarriers();
            } else {
              window.prompt(e);
              console.warn(e);
              return;
            }
          }
        }
        this._clientMaze.generateModel(this._clientMaze._modelOptions);
        this._clientMaze.modelAPI("addModel", this._scene);
      },
      generateAnimation: () => {
        if (this._clientMaze.path.length > 0) {
          this._clearScene();
          this._clientMaze.generateAnimation();
          this._clientMaze.animationMixersAPI("addModel", this._scene);
          this._currentShowing = "playAnimation";
          this._clientMaze.animationMixersAPI(
            "changeTimeScale",
            this._guiAnimationMixerSettings.timeScale
          );
        }
      },
      playAnimation: () => {
        this._clientMaze.animationMixersAPI("play");
      },
      resetAnimation: () => {
        this._clientMaze.animationMixersAPI("stopAllAction");
      },
      clearAnimation: () => {
        this._clientMaze.animationMixersAPI("stopAllAction");
        this._clientMaze.animationMixersAPI("removeModel", this._scene);
        this._clientMaze.modelAPI("addModel", this._scene);
        this._currentShowing = "solve";
      },
      addVoidSpace: () => {
        try {
          this._clientMaze.constraints.voidSpace = JSON.parse(
            this._guiMazeConstraintsVoid.voidSpace
          );
        } catch (e) {
          console.error(
            "WorldTemplate._guiButtonDir.addVoidSpace error: The voidSpace input on the dat.gui is incorrectly formatted and cannot be parsed properly."
          );
          this._guiMazeConstraintsVoid.voidSpace = "[]";
          this._clientMaze.constraints.voidSpace = [];
          window.alert(`WorldTemplate._guiButtonDir.addVoidSpace incorrect format error: ${e}`)
        }
        this._currentShowing = "template";
        this._completeModelLoadFromTemplate();
      }
    };
    const updateLightPos = () => {
      Object.assign(this._guiLightOptions, this._clientMaze.getCornerSpotLightData());
      Object.assign(this._clientMaze._lightOptions, this._guiLightOptions);
      this._clientMaze.modelAPI("updateLightPos");
    };
    const mazeSize = this._GUI.addFolder("Maze Size");
    mazeSize
      .add(this._clientMaze.constraints, "width", 1, 100, 1)
      .listen()
      .onChange(() => {
        this._completeModelLoadFromTemplate();
        this._updateSolveMax();
        this._positionSolveBoxes();
        updateLightPos();
        this._decideShowSolveBoxesVis();
        this._updateBackDrop();
      });
    mazeSize
      .add(this._clientMaze.constraints, "height", 1, 100, 1)
      .listen()
      .onChange(() => {
        this._completeModelLoadFromTemplate();
        this._updateSolveMax();
        this._positionSolveBoxes();
        updateLightPos();
        this._decideShowSolveBoxesVis();
        this._updateBackDrop();
      });
    mazeSize
      .add(this._clientMaze.constraints, "depth", 1, 100, 1)
      .listen()
      .onChange(() => {
        this._completeModelLoadFromTemplate();
        this._updateSolveMax();
        this._positionSolveBoxes();
        updateLightPos();
        this._decideShowSolveBoxesVis();
        this._updateBackDrop();
      });
    this._guiMazeConstraintsVoid = {
      voidSpace: "[]"
    };
    mazeSize
      .add(this._guiMazeConstraintsVoid, "voidSpace")
      .listen()
      .onChange((v) => {
        this._guiMazeConstraintsVoid.voidSpace = v;
      });
    mazeSize.add(guiButtonDir, "addVoidSpace").name("Add Void Space");
    mazeSize.open();
    const chanceOptions = this._GUI.addFolder("Maze Chance");
    chanceOptions.open();
    chanceOptions
      .add(this._clientMaze.constraints, "xChance", 0, 10, 1)
      .listen()
      .onChange(() => {
        this._clientMaze.constraints.xChance = this._clientMaze.constraints.xChance;
        this._decideModelLoadFromVolume();
        this._updateSolveMax();
        this._positionSolveBoxes();
        this._decideShowSolveBoxesVis();
      });
    chanceOptions
      .add(this._clientMaze.constraints, "yChance", 0, 10, 1)
      .listen()
      .onChange(() => {
        this._clientMaze.constraints.yChance = this._clientMaze.constraints.yChance;
        this._decideModelLoadFromVolume();
        this._updateSolveMax();
        this._positionSolveBoxes();
        this._decideShowSolveBoxesVis();
      });
    chanceOptions
      .add(this._clientMaze.constraints, "zChance", 0, 10, 1)
      .listen()
      .onChange(() => {
        this._clientMaze.constraints.zChance = this._clientMaze.constraints.zChance;
        this._decideModelLoadFromVolume();
        this._updateSolveMax();
        this._positionSolveBoxes();
        this._decideShowSolveBoxesVis();
      });
    chanceOptions
      .add(this._clientMaze.constraints, "diagChance", 0, 10, 1)
      .listen()
      .onChange(() => {
        this._clientMaze.constraints.diagChance = this._clientMaze.constraints.diagChance;
        this._decideModelLoadFromVolume();
        this._updateSolveMax();
        this._positionSolveBoxes();
        this._decideShowSolveBoxesVis();
      });
    chanceOptions
      .add(
        this,
        "_volLimit",
        1000,
        this._maxX * this._maxZ * this._maxY,
        Math.cbrt(this._maxX * this._maxZ * this._maxY)
      )
      .name("DB Vol Lim");
    chanceOptions.add(guiButtonDir, "generateBarriers").name("Generate Barriers");
    const mazeSolve = this._GUI.addFolder("Start and End");
    mazeSolve
      .add(this._guiSolve, "startX", 0, this._clientMaze.constraints.width - 1, 1)
      .listen()
      .onChange(() => {
        this._positionSolveBoxes();
      });
    mazeSolve
      .add(this._guiSolve, "startY", 0, this._clientMaze.constraints.height - 1, 1)
      .listen()
      .onChange(() => {
        this._positionSolveBoxes();
      });
    mazeSolve
      .add(this._guiSolve, "startZ", 0, this._clientMaze.constraints.depth - 1, 1)
      .listen()
      .onChange(() => {
        this._positionSolveBoxes();
      });
    mazeSolve
      .add(this._guiSolve, "endX", 0, this._clientMaze.constraints.width - 1, 1)
      .listen()
      .onChange(() => {
        this._positionSolveBoxes();
      });
    mazeSolve
      .add(this._guiSolve, "endY", 0, this._clientMaze.constraints.height - 1, 1)
      .listen()
      .onChange(() => {
        this._positionSolveBoxes();
      });
    mazeSolve
      .add(this._guiSolve, "endZ", 0, this._clientMaze.constraints.depth - 1, 1)
      .listen()
      .onChange(() => {
        this._positionSolveBoxes();
      });
    mazeSolve.add(guiButtonDir, "solveMaze").name("Solve Maze");
    mazeSolve.open();
    this._threeHelperOptions = {
      AxesHelper: false,
      GridHelper: false
    };
    const helperSettings = this._GUI.addFolder("Light & Helper Settings");
    helperSettings
      .add(this._ambientLightSettings, "intensity", 0, 1, 0.1)
      .listen()
      .onChange((v) => {
        this._ambientLightSettings.light.intensity = v;
      })
      .name("Ambient Intensity");
    helperSettings
      .add(this._guiLightOptions, "intensity", 0, 1, 0.1)
      .listen()
      .onChange(() => {
        this._clientMaze.modelAPI("updateLightIntensity", this._guiLightOptions.intensity);
      })
      .name("Spot Intensity");
    helperSettings
      .add(this._threeHelperOptions, "AxesHelper")
      .listen()
      .onChange(() => {
        if (this._threeHelperOptions.AxesHelper) {
          this._scene.add(this._AxesHelper);
        } else {
          this._scene.remove(this._AxesHelper);
          this._AxesHelper.dispose();
        }
      });
    helperSettings
      .add(this._threeHelperOptions, "GridHelper")
      .listen()
      .onChange(() => {
        if (this._threeHelperOptions.GridHelper) {
          this._scene.add(this._GridHelper);
        } else {
          this._scene.remove(this._GridHelper);
        }
      });
    helperSettings
      .add(this._clientMaze._lightOptions, "showTargetObj")
      .listen()
      .onChange((v) => {
        this._clientMaze.modelAPI("updateTargetObj", v);
      })
      .name("Light Targets");
    helperSettings
      .add(this._guiHelpers, "showLightHelpers")
      .listen()
      .onChange((v) => {
        v
          ? this._clientMaze.modelAPI("addLightHelpers", this._scene)
          : this._clientMaze.modelAPI("removeLightHelpers", this._scene);
      })
      .name("Light Helpers");
    helperSettings
      .add(this._guiHelpers, "showShadowHelpers")
      .listen()
      .onChange((v) => {
        v
          ? this._clientMaze.modelAPI("addShadowHelpers", this._scene)
          : this._clientMaze.modelAPI("removeShadowHelpers", this._scene);
      })
      .name("Shadow Helpers");
    const { shadow } = this._clientMaze._lightOptions;
    helperSettings
      .add(shadow, "enabled")
      .listen()
      .onChange((v) => {
        this._clientMaze.modelAPI("toggleShadow", v);
        this._clientMaze.modelAPI("updateShadowHelpers", this._scene);
        this._clientMaze.modelAPI("updateLightHelpers", this._scene);
      })
      .name("Enable Shadows");
    console.warn(
      "Warning for modelSettings opacity GUI: Three.js does not support Order-Independent-Transparency. So opacity will preform unexpectally."
    );
    helperSettings
      .add(this._guiBackDrop, "enabled")
      .setValue(this._guiBackDrop.enabled)
      .name("Enable Backdrop")
      .listen()
      .onChange((v) => {
        this._updateBackDrop();
      });
    let ref = this;
    helperSettings
      .add(ref, "_backDropBuffer", 20, 100, 1)
      .listen()
      .onChange(() => {
        this._updateBackDrop();
      })
      .name("Back Drop Buffer");
    helperSettings
      .add(shadow, "type", {
        BasicShadowMap: 0,
        PCFShadowMap: 1,
        PCFSoftShadowMap: 2,
        VSMShadowMap: 3
      })
      .setValue(shadow.type)
      .name("Shadow Map")
      .listen()
      .onChange((v) => {
        shadow.type = v;
        this._generateLightsAndHelpersDynamically();
      });
    this._guiDistanceMultXYZ = {
      x: this._clientMaze._lightOptions.distanceMultXYZ[0],
      y: this._clientMaze._lightOptions.distanceMultXYZ[1],
      z: this._clientMaze._lightOptions.distanceMultXYZ[2]
    };
    helperSettings
      .add(this._guiDistanceMultXYZ, "x", 0, 20, 1)
      .listen()
      .onChange((v) => {
        this._clientMaze._lightOptions.distanceMultXYZ[0] = v;
        this._generateLightsAndHelpersDynamically();
      })
      .name("Light X Multipler");
    helperSettings
      .add(this._guiDistanceMultXYZ, "y", 0, 20, 1)
      .listen()
      .onChange((v) => {
        this._clientMaze._lightOptions.distanceMultXYZ[1] = v;
        this._generateLightsAndHelpersDynamically();
      })
      .name("Light Y Multipler");
    helperSettings
      .add(this._guiDistanceMultXYZ, "z", 0, 20, 1)
      .listen()
      .onChange((v) => {
        this._clientMaze._lightOptions.distanceMultXYZ[2] = v;
        this._generateLightsAndHelpersDynamically();
      })
      .name("Light Z Multipler");

    helperSettings
      .add(shadow, "mapWidth", 0, 3000, 100)
      .setValue(shadow.mapWidth)
      .listen()
      .onChange(() => {
        this._generateLightsAndHelpersDynamically();
      });
    helperSettings
      .add(shadow, "mapHeight", 0, 3000, 100)
      .setValue(shadow.mapHeight)
      .listen()
      .onChange(() => {
        this._generateLightsAndHelpersDynamically();
      });
    helperSettings
      .add(shadow, "penumbra", 0.25, 1, 0.25)
      .setValue(shadow.penumbra)
      .listen()
      .onChange(() => {
        this._generateLightsAndHelpersDynamically();
      });
    this._guiLightOptionsLightLocation = {
      location: "midPointData"
    };
    helperSettings
      .add(this._guiLightOptionsLightLocation, "location", {
        midPointData: "midPointData",
        cornerPointData: "cornerPointData"
      })
      .setValue(this._guiLightOptionsLightLocation.location)
      .name("Light Location")
      .setValue("cornerPointData")
      .listen()
      .onChange((v) => {
        if (v === "midPointData") {
          Object.assign(
            this._clientMaze._lightOptions,
            this._clientMaze.getMidpointSpotLightData()
          );
        } else if (v === "cornerPointData") {
          Object.assign(this._clientMaze._lightOptions, this._clientMaze.getCornerSpotLightData());
        }
        this._guiLightOptions = JSON.parse(JSON.stringify(this._clientMaze._lightOptions));
        this._generateLightsAndHelpersDynamically();
      });

    const modelSettings = this._GUI.addFolder("Model Settings");
    modelSettings
      .add(this._clientMaze._modelOptions, "instance")
      .listen()
      .onChange(() => {
        this._decideModelLoad();
      })
      .name("Instance Mesh");

    /* the const {barrier} was alrady used in the aniamte settings folder, so I decided to just use a ref here */

    let barrierModelRef = this._clientMaze._modelOptions.barrier;
    let spaceModelRef = this._clientMaze._modelOptions.space;
    let voidModelRef = this._clientMaze._modelOptions.void;
    let mapModelRef = this._clientMaze._modelOptions.map;
    let pathModelRef = this._clientMaze._modelOptions.path;
    const { custom } = this._clientMaze._animationOptions.animationMesh;

    /* Barrier */

    modelSettings
      .add(barrierModelRef, "generate")
      .listen()
      .onChange(() => {
        this._decideModelLoad(false);
      })
      .name("Generate Barrier");
    modelSettings
      .add(barrierModelRef, "opacity", 0, 1, 0.1)
      .listen()
      .onChange((v) => {
        custom.barrier.opacity = v;
        this._decideModelLoad(false);
      })
      .name("Barrier Opacity");
    modelSettings
      .addColor(barrierModelRef, "color")
      .listen()
      .onChange((v) => {
        custom.barrier.color = v;
        this._decideModelLoad(false);
      })
      .name("Barrier Color");

    /* space */

    modelSettings
      .add(spaceModelRef, "generate")
      .listen()
      .onChange(() => {
        this._decideModelLoad(false);
      })
      .name("Generate Space");
    modelSettings
      .add(spaceModelRef, "opacity", 0, 1, 0.1)
      .listen()
      .onChange((v) => {
        custom.space.opacity = v;
        this._decideModelLoad(false);
      })
      .name("Space Opacity");
    modelSettings
      .addColor(spaceModelRef, "color")
      .listen()
      .onChange((v) => {
        custom.space.color = v;
        this._decideModelLoad(false);
      })
      .name("Space Color");

    /* Void */

    modelSettings
      .add(voidModelRef, "generate")
      .listen()
      .onChange(() => {
        this._decideModelLoad(false);
      })
      .name("Generate Void");
    modelSettings
      .add(voidModelRef, "opacity", 0, 1, 0.1)
      .listen()
      .onChange((v) => {
        custom.void.opacity = v;
        this._decideModelLoad(false);
      })
      .name("Void Opacity");
    modelSettings
      .addColor(voidModelRef, "color")
      .listen()
      .onChange((v) => {
        custom.void.color = v;
        this._decideModelLoad(false);
      })
      .name("Void Color");

    /* Map */

    modelSettings
      .add(mapModelRef, "generate")
      .listen()
      .onChange(() => {
        this._decideModelLoad(false);
      })
      .name("Generate Map");
    modelSettings
      .add(mapModelRef, "opacity", 0, 1, 0.1)
      .listen()
      .onChange((v) => {
        custom.map.opacity = v;
        this._decideModelLoad(false);
      })
      .name("Map Opacity");
    modelSettings
      .addColor(mapModelRef, "color")
      .listen()
      .onChange((v) => {
        custom.map.color = v;
        this._decideModelLoad(false);
      })
      .name("Map Color");

    /* Path */

    modelSettings
      .add(pathModelRef, "generate")
      .listen()
      .onChange(() => {
        this._decideModelLoad(false);
      })
      .name("Generate Path");
    modelSettings
      .add(pathModelRef, "opacity", 0, 1, 0.1)
      .listen()
      .onChange((v) => {
        custom.path.opacity = v;
        this._decideModelLoad(false);
      })
      .name("Path Opacity");
    modelSettings
      .addColor(pathModelRef, "color")
      .listen()
      .onChange((v) => {
        custom.path.color = v;
        this._decideModelLoad(false);
      })
      .name("Path Color");

    /* Animation Settings Folder */

    const animateSettingsFolder = this._GUI.addFolder("Animate Settings");
    const { _animationOptions } = this._clientMaze;
    const { barrier } = _animationOptions;
    const { space } = _animationOptions;
    // void is a JS keyword
    const voidRef = _animationOptions.void;
    const { map } = _animationOptions;
    const { path } = _animationOptions;
    const guiAnimateSettingsENTVector = `[${this._maxX}, ${this._maxY}, ${this._maxZ}]`;
    const guiAnimateSettingsEXIVector = `[${-this._maxX}, ${-this._maxY}, ${-this._maxZ}]`;
    this._guiAnimateSettings = {
      groupOrder: JSON.stringify(_animationOptions.groupOrder),
      BEXIV: guiAnimateSettingsEXIVector,
      BENTV: guiAnimateSettingsENTVector,
      SEXIV: guiAnimateSettingsEXIVector,
      SENTV: guiAnimateSettingsENTVector,
      VEXIV: guiAnimateSettingsEXIVector,
      VENTV: guiAnimateSettingsENTVector,
      MEXIV: guiAnimateSettingsEXIVector,
      MENTV: guiAnimateSettingsENTVector,
      PEXIV: guiAnimateSettingsEXIVector,
      PENTV: guiAnimateSettingsENTVector
    };

    animateSettingsFolder
      .add(this._guiAnimateSettings, "groupOrder")
      .listen()
      .onChange(() => {
        try {
          _animationOptions.groupOrder = JSON.parse(this._guiAnimateSettings.groupOrder);
        } catch (e) {}
      });
    animateSettingsFolder
      .add(_animationOptions, "groupDelay", 0, 5, 0.1)
      .listen()
      .onChange((v) => {
        _animationOptions.groupDelay = v;
      });
    const barrierSettingsFolder = animateSettingsFolder.addFolder("/ Barrier Group");
    const spaceSettingsFolder = animateSettingsFolder.addFolder("/ Space Group");
    const voidSettingsFolder = animateSettingsFolder.addFolder("/ Void Group");
    const mapSettingsFolder = animateSettingsFolder.addFolder("/ Map Group");
    const pathSettingsFolder = animateSettingsFolder.addFolder("/ Path Group");

    /* Barrier */
    // let { entrence } = barrier;
    // let { exit } = barrier;

    barrierSettingsFolder
      .add(barrier, "animationSlice", {
        "height-layer": "height-layer",
        "width-layer": "width-layer",
        "depth-layer": "depth-layer"
      })
      .setValue(barrier.animationSlice);
    barrierSettingsFolder.add(barrier, "animationSliceOffset", 0, 5, 0.1).name("Slice Offset");
    barrierSettingsFolder.add(barrier, "animationSliceDuration", 0, 5, 0.1).name("Slice Duration");
    barrierSettingsFolder
      .add(barrier.entrence, "type", {
        visible: "visible",
        slide: "slide"
      })
      .setValue(barrier.entrence.type)
      .name("Entrence Type")
      .listen()
      .onChange((e) => {
        barrier.entrence.type = e;
      });
    barrierSettingsFolder
      .add(this._guiAnimateSettings, "BENTV")
      .listen()
      .onChange((v) => {
        v = JSON.parse(v);
        barrier.entrence.distance.x = v[0];
        barrier.entrence.distance.y = v[0];
        barrier.entrence.distance.z = v[0];
      })
      .name("Ent Slide XYZ");
    barrierSettingsFolder
      .add(this._guiAnimateSettings, "BEXIV")
      .listen()
      .onChange((v) => {
        v = JSON.parse(v);
        barrier.exit.distance.x = v[0];
        barrier.exit.distance.y = v[0];
        barrier.exit.distance.z = v[0];
      })
      .name("Exi Slide XYZ");
    barrierSettingsFolder
      .add(barrier.exit, "type", {
        invisible: "invisible",
        visible: "visible",
        slide: "slide"
      })
      .setValue(barrier.exit.type)
      .name("Exit Type")
      .listen()
      .onChange((e) => {
        barrier.exit.type = e;
      });
    barrierSettingsFolder
      .add(barrier.exit, "order", {
        normal: "normal",
        reverse: "reverse",
        instant: "instant"
      })
      .setValue(barrier.exit.order)
      .name("Exit Order")
      .listen()
      .onChange((e) => {
        barrier.exit.order = e;
      });
    barrierSettingsFolder.add(barrier.exit, "exitDelay", 0, 5, 0.1).name("Exit Delay");

    /* Space */

    spaceSettingsFolder
      .add(space, "animationSlice", {
        "height-layer": "height-layer",
        "width-layer": "width-layer",
        "depth-layer": "depth-layer"
      })
      .setValue(space.animationSlice);
    spaceSettingsFolder.add(space, "animationSliceOffset", 0, 5, 0.1).name("Slice Offset");
    spaceSettingsFolder.add(space, "animationSliceDuration", 0, 5, 0.1).name("Slice Duration");
    spaceSettingsFolder
      .add(space.entrence, "type", {
        visible: "visible",
        slide: "slide"
      })
      .setValue(space.entrence.type)
      .name("Entrence Type")
      .listen()
      .onChange((e) => {
        space.entrence.type = e;
      });
    spaceSettingsFolder
      .add(this._guiAnimateSettings, "SENTV")
      .listen()
      .onChange((v) => {
        v = JSON.parse(v);
        space.entrence.distance.x = v[0];
        space.entrence.distance.y = v[0];
        space.entrence.distance.z = v[0];
      })
      .name("Ent Slide XYZ");
    spaceSettingsFolder
      .add(this._guiAnimateSettings, "SEXIV")
      .listen()
      .onChange((v) => {
        v = JSON.parse(v);
        space.exit.distance.x = v[0];
        space.exit.distance.y = v[0];
        space.exit.distance.z = v[0];
      })
      .name("Exi Slide XYZ");
    spaceSettingsFolder
      .add(space.exit, "type", {
        invisible: "invisible",
        visible: "visible",
        slide: "slide"
      })
      .setValue(space.exit.type)
      .name("Exit Type")
      .listen()
      .onChange((e) => {
        space.exit.type = e;
      });
    spaceSettingsFolder
      .add(space.exit, "order", {
        normal: "normal",
        reverse: "reverse",
        instant: "instant"
      })
      .setValue(space.exit.order)
      .name("Exit Order")
      .listen()
      .onChange((e) => {
        space.exit.order = e;
      });
    spaceSettingsFolder.add(space.exit, "exitDelay", 0, 5, 0.1).name("Exit Delay");

    /* Void */

    voidSettingsFolder
      .add(voidRef, "animationSlice", {
        "height-layer": "height-layer",
        "width-layer": "width-layer",
        "depth-layer": "depth-layer"
      })
      .setValue(voidRef.animationSlice);
    voidSettingsFolder.add(voidRef, "animationSliceOffset", 0, 5, 0.1).name("Slice Offset");
    voidSettingsFolder.add(voidRef, "animationSliceDuration", 0, 5, 0.1).name("Slice Duration");
    voidSettingsFolder
      .add(voidRef.entrence, "type", {
        visible: "visible",
        slide: "slide"
      })
      .setValue(voidRef.entrence.type)
      .name("Entrence Type")
      .listen()
      .onChange((e) => {
        voidRef.entrence.type = e;
      });
    voidSettingsFolder
      .add(this._guiAnimateSettings, "VENTV")
      .listen()
      .onChange((v) => {
        v = JSON.parse(v);
        voidRef.entrence.distance.x = v[0];
        voidRef.entrence.distance.y = v[0];
        voidRef.entrence.distance.z = v[0];
      })
      .name("Ent Slide XYZ");
    voidSettingsFolder
      .add(this._guiAnimateSettings, "VEXIV")
      .listen()
      .onChange((v) => {
        v = JSON.parse(v);
        voidRef.exit.distance.x = v[0];
        voidRef.exit.distance.y = v[0];
        voidRef.exit.distance.z = v[0];
      })
      .name("Exi Slide XYZ");
    voidSettingsFolder
      .add(voidRef.exit, "type", {
        invisible: "invisible",
        visible: "visible",
        slide: "slide"
      })
      .setValue(voidRef.exit.type)
      .name("Exit Type")
      .listen()
      .onChange((e) => {
        voidRef.exit.type = e;
      });
    voidSettingsFolder
      .add(voidRef.exit, "order", {
        normal: "normal",
        reverse: "reverse",
        instant: "instant"
      })
      .setValue(voidRef.exit.order)
      .name("Exit Order")
      .listen()
      .onChange((e) => {
        voidRef.exit.order = e;
      });
    voidSettingsFolder.add(voidRef.exit, "exitDelay", 0, 5, 0.1).name("Exit Delay");

    /* Map */

    mapSettingsFolder
      .add(map, "animationSlice", {
        "map-distance": "map-distance",
        "height-layer": "height-layer",
        "width-layer": "width-layer",
        "depth-layer": "depth-layer"
      })
      .setValue(map.animationSlice);
    mapSettingsFolder.add(map, "animationSliceOffset", 0, 5, 0.1).name("Slice Offset");
    mapSettingsFolder.add(map, "animationSliceDuration", 0, 5, 0.1).name("Slice Duration");
    mapSettingsFolder
      .add(map.entrence, "type", {
        visible: "visible",
        slide: "slide"
      })
      .setValue(map.entrence.type)
      .name("Entrence Type")
      .listen()
      .onChange((e) => {
        map.entrence.type = e;
      });
    mapSettingsFolder
      .add(this._guiAnimateSettings, "MENTV")
      .listen()
      .onChange((v) => {
        v = JSON.parse(v);
        map.entrence.distance.x = v[0];
        map.entrence.distance.y = v[0];
        map.entrence.distance.z = v[0];
      })
      .name("Ent Slide XYZ");
    mapSettingsFolder
      .add(this._guiAnimateSettings, "MEXIV")
      .listen()
      .onChange((v) => {
        v = JSON.parse(v);
        map.exit.distance.x = v[0];
        map.exit.distance.y = v[0];
        map.exit.distance.z = v[0];
      })
      .name("Exi Slide XYZ");
    mapSettingsFolder
      .add(map.exit, "type", {
        invisible: "invisible",
        visible: "visible",
        slide: "slide"
      })
      .setValue(map.exit.type)
      .name("Exit Type")
      .listen()
      .onChange((e) => {
        map.exit.type = e;
      });
    mapSettingsFolder
      .add(map.exit, "order", {
        normal: "normal",
        reverse: "reverse",
        instant: "instant"
      })
      .setValue(map.exit.order)
      .name("Exit Order")
      .listen()
      .onChange((e) => {
        map.exit.order = e;
      });
    mapSettingsFolder.add(map.exit, "exitDelay", 0, 5, 0.1).name("Exit Delay");

    /* Path */
    pathSettingsFolder
      .add(path, "animationSlice", {
        "solve-path": "solve-path",
        "height-layer": "height-layer",
        "width-layer": "width-layer",
        "depth-layer": "depth-layer"
      })
      .setValue(path.animationSlice);
    pathSettingsFolder.add(path, "animationSliceOffset", 0, 5, 0.1).name("Slice Offset");
    pathSettingsFolder.add(path, "animationSliceDuration", 0, 5, 0.1).name("Slice Duration");
    pathSettingsFolder
      .add(path.entrence, "type", {
        visible: "visible",
        slide: "slide"
      })
      .setValue(path.entrence.type)
      .name("Entrence Type")
      .listen()
      .onChange((e) => {
        path.entrence.type = e;
      });
    pathSettingsFolder
      .add(this._guiAnimateSettings, "PENTV")
      .listen()
      .onChange((v) => {
        v = JSON.parse(v);
        path.entrence.distance.x = v[0];
        path.entrence.distance.y = v[0];
        path.entrence.distance.z = v[0];
      })
      .name("Ent Slide XYZ");
    pathSettingsFolder
      .add(this._guiAnimateSettings, "PEXIV")
      .listen()
      .onChange((v) => {
        v = JSON.parse(v);
        path.exit.distance.x = v[0];
        path.exit.distance.y = v[0];
        path.exit.distance.z = v[0];
      })
      .name("Exi Slide XYZ");
    pathSettingsFolder
      .add(path.exit, "type", {
        invisible: "invisible",
        visible: "visible",
        slide: "slide"
      })
      .setValue(path.exit.type)
      .name("Exit Type")
      .listen()
      .onChange((e) => {
        path.exit.type = e;
      });
    pathSettingsFolder
      .add(path.exit, "order", {
        normal: "normal",
        reverse: "reverse",
        instant: "instant"
      })
      .setValue(path.exit.order)
      .name("Exit Order")
      .listen()
      .onChange((e) => {
        path.exit.order = e;
      });
    pathSettingsFolder.add(path.exit, "exitDelay", 0, 5, 0.1).name("Exit Delay");

    const animationFolder = this._GUI.addFolder("Animate Functions");
    animationFolder.add(guiButtonDir, "generateAnimation").name("Generate Animation");
    animationFolder.add(guiButtonDir, "playAnimation").name("Play Animation");
    animationFolder.add(guiButtonDir, "resetAnimation").name("Reset Animation To Start");
    animationFolder.add(guiButtonDir, "clearAnimation").name("Clear Animation");

    /* Animation Functions Folder */

    animationFolder
      .add(this._guiAnimationMixerSettings, "timeScale", 0.1, 10, 0.1)
      .listen()
      .onChange(() => {
        this._clientMaze.animationMixersAPI(
          "changeTimeScale",
          this._guiAnimationMixerSettings.timeScale
        );
      });
    animationFolder.open();
  }
  _createCamera() {
    return new three.PerspectiveCamera(
      75,
      this._container.clientWidth / this._container.clientHeight,
      0.1,
      1000
    );
  }
  _createOrbitControls() {
    const controls = new OrbitControls(this._camera, this._container);
    controls.enableDamping = true;
    // Enable the dampening requires update each frame
    controls.tick = () => controls.update();
    return controls;
  }
  _createRenderer() {
    const renderer = new three.WebGL1Renderer({
      antialias: true,
      physicallyCorrectLights: true
    });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(this._container.clientWidth, this._container.clientHeight);
    return renderer;
  }
  start() {
    this._renderClock.start();
  }
  stop() {
    this._renderClock.stop();
  }
}
