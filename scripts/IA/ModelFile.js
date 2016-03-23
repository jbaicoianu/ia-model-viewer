IA = window.IA || {};
/** 
 * Internet Archive Model File
 *
 * Represents a 3D model file.  Minimum properties are name and URL
 *
 * @class IA.ModelFile
 */

IA.ModelFile = function(name, url) {
  // If url is already a THREE.Object3D, just use it directly
  if (url instanceof THREE.Object3D) {
    this.name = name;
    this.object = url;
  } else {
    if (typeof url != 'undefined') {
      // Both parameters passed - assign them directly
      this.name = name;
      this.url = url;
    } else {
      // If only one parameter was passed, it's probably a URL, so extract the other info
      this.url = name;
      this.name = this.extractName(this.url);
    }
    this.type = this.extractType(this.url);
  }
}

IA.ModelFile.prototype = Object.create( THREE.EventDispatcher.prototype );
IA.ModelFile.prototype.constructor = IA.ModelFile;

/**
 * Determine the name of this model, given a URL
 * @function extractName
 * @memberof IA.ModelFile
 * @param {string} url
 * @returns {string} name
 */
IA.ModelFile.prototype.extractName = function(url) {
  var dotidx = url.lastIndexOf('.');
  var slashidx = url.lastIndexOf('/');
  // We can easily handle no slash, but we need special handling if we don't have a dot
  return (dotidx >= 0 ? url.substring(slashidx+1, dotidx) : url.substring(slashidx+1));
}

/**
 * Determine the type of this model, given a URL
 * @function extractType
 * @memberof IA.ModelFile
 * @param {string} url
 * @returns {string} type
 */
IA.ModelFile.prototype.extractType = function(url) {
  var idx = url.lastIndexOf('.');
  return (idx >= 0 ? url.substring(idx+1).toLowerCase() : null);
}

/**
 * Load the model file from the configured URL
 * @function load
 * @memberof IA.ModelFile
 * @param {string} url
 * @returns {string} type
 */
IA.ModelFile.prototype.load = function() {
    var loader = this.getLoader(this.type);
    if (loader) {
      loader.load(this.url, this.processModel.bind(this));
    } else {
      console.log('ERROR: no loader for type ' + this.type);
    }
}
/**
 * Load the model file from the configured URL
 * @function load
 * @memberof IA.ModelFile
 * @param {string} url
 * @returns {string} type
 */
IA.ModelFile.prototype.getLoader = function() {  
  if (typeof IA.ModelViewer.loaders[this.type] == 'function') {
    return new IA.ModelViewer.loaders[this.type]();
  }
  return false;
}
/**
 * Process an asynchronous load and prepare geometry for use
 * @function processModel
 * @memberof IA.ModelFile
 */
IA.ModelFile.prototype.processModel = function(geometry) {
  if (this.object && this.object.parent) {
    this.object.parent.remove(this.object);
  }

  if (geometry instanceof THREE.Geometry || geometry instanceof THREE.BufferGeometry) {
    geometry.computeBoundingSphere();
    geometry.computeBoundingBox();

    // Center geometry
    var offset = new THREE.Vector3();
    offset.addVectors( geometry.boundingBox.min, geometry.boundingBox.max );
    offset.multiplyScalar( -0.5 );
    geometry.applyMatrix( new THREE.Matrix4().makeTranslation( offset.x, offset.y, offset.z ) );
    geometry.computeBoundingSphere();
    geometry.computeBoundingBox();

    //geometry.computeVertexNormals();

    var model = new THREE.Mesh( geometry, this.getMaterial());
    model.castShadow = true;
    model.receiveShadow = true;

    this.object = model;
    this.updateObjectScale();
  } else {
    this.object = geometry;
  }

  setTimeout(function() {
    this.dispatchEvent({ type: 'load' });
  }.bind(this), 0);
}
/**
 * Set the material for this object to the specified THREE.Material
 * @function setMaterial
 * @memberof IA.ModelFile
 */
IA.ModelFile.prototype.setMaterial = function(material) {
  this.material = material;

  if (this.object) {
    this.object.material = this.material;
  }
}
/**
 * Figure out the appropriate material for this model.  Create one if none specified.
 * @function getMaterial
 * @memberof IA.ModelFile
 */
IA.ModelFile.prototype.getMaterial = function() {
  if (this.material) {
    return this.material;
  }
  return new THREE.MeshPhongMaterial({color: 0xff0000});
}
/**
 * Set scale to best fit for object
 * @function updateObjectScale
 * @memberof IA.ModelFile
 */
IA.ModelFile.prototype.updateObjectScale = function() {
  if (this.object) {
    var size = new THREE.Vector3().subVectors(this.object.geometry.boundingBox.max, this.object.geometry.boundingBox.min);
    var max = Math.max(size.x, size.y, size.z);
    this.object.scale.set(80 / max, 80 / max, 80 / max);
  }

}


