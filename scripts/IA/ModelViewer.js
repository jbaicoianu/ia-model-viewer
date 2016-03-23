IA = window.IA || {};
/** 
 * Internet Archive Model Viewer
 *
 * @class IA.ModelViewer
 *
 */
IA.ModelViewer = function() {
  this.canvassize = [640, 480];

  this.models = {};

  this.settings = {
    model: '',
    material: '',
    controls: 'view',
    fullsize: false,
    damping: 0.001,
  };

  // Create THREE.js objects
  this.renderer = new THREE.WebGLRenderer({antialias: true, alpha: true});
  this.renderer.autoClear = false;
  this.canvas = this.renderer.domElement;

  this.stats = new Stats();
  this.stats.domElement.style.position = 'absolute';
  this.stats.domElement.style.bottom = '0px';
  this.stats.domElement.style.right = '0px';
  //document.body.appendChild( this.stats.domElement );

  this.scene    = new THREE.Scene();

  this.objectcontainer = new THREE.Object3D();
  this.objectcontainer.position.z = 1;
  this.scene.add(this.objectcontainer);

  this.camera   = new THREE.PerspectiveCamera(60, 4/3, .01, 12000);
  this.camera.position.z = 120;
  this.scene.add(this.camera);
  this.lights   = this.setupLights();
  this.controls = this.setupControls();
  this.setActiveControls(Object.keys(this.controls)[0]); // Set first control as active

  this.initSkybox();
  this.materials = {};

  this.initGUI();
  this.loader = this.createLoader();

  this.model    = false;

  // If the canvas has no parent node, add it to the document
  if (!this.renderer.domElement.parentNode) {
    document.body.appendChild(this.renderer.domElement);
  }
  this.updateSize();
  window.addEventListener('resize', this.updateSize.bind(this));
  window.addEventListener('orientationchange', this.updateSize.bind(this));

  setTimeout(function() {
    var modelfile = (document.location.hash.length > 0 ? document.location.hash.substring(1) : Object.keys(this.models)[0]);
    this.setModel(modelfile); 
  }.bind(this), 10);


  this.renderloop();

  //this.impartSpin();
}

/** static member variable **/
IA.ModelViewer.loaders = {
  'stl': THREE.STLLoader,
  'wrl': THREE.VRMLLoader
};

/**
 * Figure out the current size of this canvas, based on current state
 * @function updateSize
 * @memberof IA.ModelViewer
 */
IA.ModelViewer.prototype.updateSize = function() {
  if (this.settings.fullsize) {
    var size = [window.innerWidth, window.innerHeight];
  } else {
    var size = [this.canvassize[0], this.canvassize[1]];
  }
  size[0] = Math.min(window.innerWidth, size[0]);
  size[1] = Math.min(window.innerHeight, size[1]);
  if (this.renderer) {
    this.renderer.setSize(size[0], size[1]);
    this.renderer.setPixelRatio( window.devicePixelRatio );

  }
  if (this.camera) {
    this.camera.aspect = size[0] / size[1];
    this.camera.updateProjectionMatrix();
    this.update();
  }
  if (this.controls) {
    this.controls.object.handleResize();
  }
}

/**
 * Set up initial light stage
 * @function setupLights
 * @memberof IA.ModelViewer
 */
IA.ModelViewer.prototype.setupLights = function() {

  var lights = {};

  lights.ambient = new THREE.AmbientLight(0x333333);
  this.scene.add(lights.ambient);

  // key light
  lights.keylight = new THREE.PointLight(0xffffff, .8, 5000);
  lights.keylight.position.set(-320, 80, 400);
  this.scene.add(lights.keylight);

  // fill light
  lights.filllight = new THREE.PointLight(0xffffff, .4, 5000);
  lights.filllight.position.set(480, -80, 320);
  this.scene.add(lights.filllight);

  // rim light
  lights.rimlight = new THREE.SpotLight(0xffffff, .4, 1000, Math.PI/8);
  lights.rimlight.position.set(40, 0, -200);
  this.scene.add(lights.rimlight);

  /*
  lights.keylight.add(new THREE.PointLightHelper(lights.keylight));
  lights.filllight.add(new THREE.PointLightHelper(lights.filllight));
  lights.rimlight.add(new THREE.SpotLightHelper(lights.rimlight));
  */

  return lights;
}
/**
 * Set up controls and associated events
 * @function setupControls
 * @memberof IA.ModelViewer
 */
IA.ModelViewer.prototype.setupControls = function() {
  var controls = {
    view: new THREE.OrbitControls(this.camera, this.canvas),
    object: new THREE.TrackballControls(this.objectcontainer, this.canvas)
  };
  //controls.object.enabled = false;
  controls.object.dynamicDampingFactor = this.settings.damping;
  controls.object.noRoll = true;
  controls.object.noZoom = true;

  controls.object.addEventListener("change", this.update.bind(this));
  controls.view.addEventListener("change", this.update.bind(this));

  return controls;
}

/**
 * Update values for active controls
 * @function updateControls
 * @memberof IA.ModelViewer
 */
IA.ModelViewer.prototype.updateControls = function(controlname) {
  this.controls.object.dynamicDampingFactor = this.settings.damping;
}
/**
 * Change which control is active for this viewer instance
 * @function setActiveControls
 * @memberof IA.ModelViewer
 * @param {Array} models
 */
IA.ModelViewer.prototype.setActiveControls = function(controlname) {
  if (this.controls[controlname]) {
    // If this control exists, enable it and disable all other controls
    for (var k in this.controls) {
      this.controls[k].enabled = (k == controlname);
    }
    this.activecontrols = this.controls[controlname];
    if (controlname == 'object') {
      this.settings.damping = .1;
      this.updateControls();
    }
  } else {
    console.log("ERROR: couldn't set controls to " + controlname, this.controls);
  }
}

/**
 * Add a list of models to the viewer, optionally with a path
 * @function addModels
 * @memberof IA.ModelViewer
 * @param {Array} models
 * @param {string} baseurl
 */
IA.ModelViewer.prototype.addModels = function(models, baseurl) {
  if (typeof baseurl == 'undefined') baseurl = '';
  if (models instanceof Array) {
    // If models is a flat array, it's probably just a list of URLS and we should infer the name
    for (var i = 0; i < models.length; i++) {
      var model = new IA.ModelFile(baseurl + models[i]);
      (function(m) {
        m.addEventListener('load', function() { this.clearModel(m); }.bind(this));
      }).bind(this)(model);
      this.addModel(model.name, model);
    }
  } else {
    for (var k in models) {
      if (models.hasOwnProperty[k]) {
        
        this.addModel(models[k], baseurl);
      }
    }
  }
  console.log('Added models:', this.models);
  //this.initGUI();
}

/**
 * Add a new IA.ModelFile object to the list
 * @function addModel
 * @memberof IA.ModelViewer
 * @param {string} modelname
 * @param {IA.ModelFile} model
 */
IA.ModelViewer.prototype.addModel = function(modelname, model) {
  this.models[modelname] = model;
}
/**
 * Set the active rendered model
 * @function setModel
 * @memberof IA.ModelViewer
 * @param {string} modelname
 * @param {IA.ModelFile} model
 */
IA.ModelViewer.prototype.setModel = function(name) {
  //this.models[modelname] = model;
  var model = this.models[name] || false;
  if (model) {
    if (!model.loaded) {
      this.clearModel(this.loader);
      model.load();
    } else {
      this.objectcontainer.add(model.object);
      this.model = model;
      this.clearModel(model);
    }
    model.setMaterial(this.materials[this.material]);

    this.settings.model = model;
    document.location.hash = '#' + name;
  }
}
/**
 * If there's a model already in the scene, clear it
 * @function clearModel
 * @memberof IA.ModelViewer
 */
IA.ModelViewer.prototype.clearModel = function(newmodel) {
console.log('clear', newmodel);
  if (this.model && this.model.object && this.model.object.parent == this.objectcontainer) {
    this.objectcontainer.remove(this.model.object);
  }
  this.model = newmodel || false;
  this.update()
}

/**
 * Create the dat.GUI
 * @function initGUI
 * @memberof IA.ModelViewer
 */
IA.ModelViewer.prototype.initGUI = function() {
  if (!this.gui) {
    this.gui = new dat.GUI();
  } else {
    // If gui already exists, remove all the controls and re-add them
    // FIXME - this is inefficient but the easiest way to refresh all new values
    for (var i = 0; i < this.gui.__controllers.length; i++) {
      this.gui.__controllers[i].remove();
    }
  }
  //this.gui.add(this.settings, 'spinspeed', 0, 100); 
  this.gui.add(this.settings, 'model', Object.keys(this.models)).onChange(this.setModel.bind(this));
  this.gui.add(this.settings, 'material', Object.keys(this.materials)).onChange(this.updateMaterial.bind(this));
  this.gui.add(this.settings, 'controls', Object.keys(this.controls)).onChange(this.setActiveControls.bind(this));
  this.gui.add(this.settings, 'damping', 0, .2).listen().onChange(this.updateControls.bind(this));
  this.gui.add(this.settings, 'fullsize').onChange(this.updateSize.bind(this));
}

/**
 * Calls the update function on a loop, for full-speed rendering
 * @function renderloop
 * @memberof IA.ModelViewer
 */
IA.ModelViewer.prototype.renderloop = function() {
  if (this.activecontrols) {
    this.controls.view.update();
    this.controls.object.update();
    //this.activecontrols.update();
  }
  if (this.dirty) {
    this.dirty = false;
    this.render();
  }
  requestAnimationFrame(this.renderloop.bind(this));
}

/**
 * Mark the canvas as dirty, and update object parents if necessary
 * @function update
 * @memberof IA.ModelViewer
 */
IA.ModelViewer.prototype.update = function() {
  if (this.model && this.model.object) {
    if (!this.model.object.parent) {
      this.objectcontainer.add(this.model.object);
    }
  }

  this.dirty = true;
}

/**
 * Render the scene to the canvas
 * @function render
 * @memberof IA.ModelViewer
 */
IA.ModelViewer.prototype.render = function() {
  this.cameraCube.rotation.copy( this.camera.rotation );

  var now = new Date().getTime();
  this.renderer.clear();
  this.renderer.render(this.sceneCube, this.cameraCube);
  this.renderer.render(this.scene, this.camera);
  this.stats.update();
  
  this.lasttime = now;
}

/**
 * Add materials
 * @function addMaterials
 * @memberof IA.ModelViewer
 */
IA.ModelViewer.prototype.addMaterials = function(materials) {
  for (var k in materials) {
    var material = new THREE.MeshPhongMaterial(materials[k]);
    if (material.reflectivity > 0 || material.refractivity > 0) {
      material.envMap = this.skyboxTexture;
    }
    this.materials[k] = material;
  }
  if (!this.material) {
    this.material = Object.keys(this.materials)[0];
  }
  this.initGUI();
}

/**
 * Update current material
 * @function updateMaterial
 * @memberof IA.ModelViewer
 */
IA.ModelViewer.prototype.updateMaterial = function(name) {
  if (this.model && this.materials[name]) {
    this.model.setMaterial(this.materials[name]);
    this.material = name;
    this.update();
  }
}

/**
 * Create a loading spinner
 * @function createLoader
 * @memberof IA.ModelViewer
 */
IA.ModelViewer.prototype.createLoader = function() {
  var geo = new THREE.TextGeometry('Loading...', {size: 12, height: 4, font: 'droid sans'});
  var mat = this.materials['Gold'];
  
  geo.computeBoundingBox();
  var halfsize = new THREE.Vector3().subVectors(geo.boundingBox.max, geo.boundingBox.min).multiplyScalar(0.5);
  geo.applyMatrix(new THREE.Matrix4().makeTranslation(-halfsize.x, -halfsize.y, -halfsize.z));

  var mesh = new THREE.Mesh(geo, mat);
  var model = new IA.ModelFile('loader', mesh);
  return model;
}

/**
 * Create the skybox scene and camera
 * @function updateCameraZoom
 * @memberof IA.ModelViewer
 */
IA.ModelViewer.prototype.initSkybox = function() {
  this.cameraCube = this.camera.clone();
  this.sceneCube = new THREE.Scene();

  var path = "scenes/park/skybox/";
  var format = '.jpg';
  var urls = [
      path + 'posx' + format, path + 'negx' + format,
      path + 'posy' + format, path + 'negy' + format,
      path + 'posz' + format, path + 'negz' + format
    ];


  this.skyboxTexture = THREE.ImageUtils.loadTextureCube( urls, undefined, this.update.bind(this) );
  this.skyboxTexture.format = THREE.RGBFormat;

  var shader = THREE.ShaderLib[ "cube" ];
  shader.uniforms[ "tCube" ].value = this.skyboxTexture;

  var material = new THREE.ShaderMaterial( {

    fragmentShader: shader.fragmentShader,
    vertexShader: shader.vertexShader,
    uniforms: shader.uniforms,
    side: THREE.BackSide
  } );

  var mesh = new THREE.Mesh( new THREE.BoxGeometry( 10000, 10000, 10000 ), material );
  this.sceneCube.add( mesh );
}

/**
 * Fake some mouse events to impart spin to the object
 * @function impartSpin
 * @memberof IA.ModelViewer
 */

IA.ModelViewer.prototype.impartSpin = function() {
  var controls = this.controls.object;
  controls.enabled = true;
  var screen = controls.screen;
  var pageX = screen.left + (screen.width / 2);
  var pageY = screen.top + (screen.height / 2);
  controls.mousedown({ type: 'mousedown', button: 0, pageX: pageX, pageY: pageY, preventDefault: function() {}, stopPropagation: function() {} });
  controls.mousemove({ type: 'mousemove', button: 0, pageX: pageX + 5, pageY: pageY, preventDefault: function() {}, stopPropagation: function() {} });
  controls.mouseup({ type: 'mouseup', button: 0, pageX: pageX + 10, pageY: pageY, preventDefault: function() {}, stopPropagation: function() {} });
  controls.enabled = false;
}
