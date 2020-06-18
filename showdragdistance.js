Hooks.once('init', function(){
	
	game.settings.register('ShowDragDistance', 'enabled', {
      name: "ShowDragDistance.enable-s",
      hint: "ShowDragDistance.enable-l",
      scope: "world",
      config: true,
      default: true,
      type: Boolean
      //onChange: x => window.location.reload()
    });
  game.settings.register('ShowDragDistance', 'showPathDefault', {
      name: "ShowDragDistance.showPath-s",
      hint: "ShowDragDistance.showPath-l",
      scope: "world",
      config: true,
      default: true,
      type: Boolean
     // onChange: x => window.location.reload()
    });
  game.settings.register('ShowDragDistance', 'rangeFinder', {
      name: "ShowDragDistance.rangeFinder-s",
      hint: "ShowDragDistance.rangeFinder-l",
      scope: "world",
      config: true,
      default: true,
      type: Boolean
     // onChange: x => window.location.reload()
    });
})

/***************************************************************************************************************/
/*


SHOW MEASURED DISTANCE ON TOKEN DRAG

/**
/***************************************************************************************************************/
class DragRuler extends Ruler {
  constructor(user, {color=null}={}){
    super();
    this.dragRuler = this.addChild(new PIXI.Graphics());
    this.ruler = null;
    this.name = `DragRuler.${user._id}`;
    canvas.grid.addHighlightLayer(this.name);
   
  }
   clear() {
    this._state = Ruler.STATES.INACTIVE;
    this.waypoints = [];
    this.dragRuler.clear();
    this.labels.removeChildren().forEach(c => c.destroy());
    canvas.grid.clearHighlightLayer(this.name);
  }
  _onClickLeft(event) {


    if ( (this._state === 2) ) this._addWaypoint(event.data.origin);
  }
  _onDragStart(event) {
    
    this.clear();
    this._state = Ruler.STATES.STARTING;
    this._addWaypoint(event.data.origin);
  }
 _onMouseMove(event,rangeFinder=false,instant= false) {
  
    if ( this._state === Ruler.STATES.MOVING ) return;

    // Extract event data
    const mt = event._measureTime || 0;
    const {origin, destination, originalEvent} = event.data;

    // Check measurement distance
    let dx = destination.x - origin.x,
        dy = destination.y - origin.y;
    if ( Math.hypot(dy, dx) >= canvas.dimensions.size / 2 ) {

      // Hide any existing Token HUD
      canvas.hud.token.clear();
      delete event.data.hudState;

      //If Show Path by Default is set, path is shown and ctrl hides.
      let showPath = true;
      let isCtrl = game.keyboard._downKeys.has('Control'); 
      if(game.settings.get('ShowDragDistance','showPathDefault')==false){
        if(isCtrl)
          showPath= true;
        else
          showPath = false;
      }else{
        if(isCtrl)
          showPath= false;
        else
          showPath = true;
      }
      if(rangeFinder)
        showPath = true;
     
      // Draw measurement updates
      if ( Date.now() - mt > 50  || instant) {
        this.measure(destination, {gridSpaces: !originalEvent.shiftKey},showPath);
        event._measureTime = Date.now();
        this._state = Ruler.STATES.MEASURING;
      }
    }
  }
  _onMouseUp(event) {
   const oe = event.data.originalEvent;
   const isCtrl = oe.ctrlKey || oe.metaKey;
   if ( !isCtrl ) 
      this._endMeasurement();
  }
  measure(destination, {gridSpaces=true}={},showPath=true) {
    destination = new PIXI.Point(...canvas.grid.getCenter(destination.x, destination.y));
    const waypoints = this.waypoints.concat([destination]);
    const r = this.dragRuler;
    this.destination = destination;

    // Iterate over waypoints and construct segment rays
    const segments = [];
    for ( let [i, dest] of waypoints.slice(1).entries() ) {
      const origin = waypoints[i];
      const label = this.labels.children[i];
      const ray = new Ray(origin, dest);
      if ( ray.distance < (0.2 * canvas.grid.size) ) {
        if ( label ) label.visible = false;
        continue;
      }
      segments.push({ray, label});
    }

    // Compute measured distance
    const distances = canvas.grid.measureDistances(segments, {gridSpaces});
    let totalDistance = 0;
    for ( let [i, d] of distances.entries() ) {
      totalDistance += d;
      let s = segments[i];
      s.last = i === (segments.length - 1);
      s.distance = d;
      if(this.waypoints.length > 1)
        s.text = this._getSegmentLabel(d, totalDistance, s.last);
      else
        s.text = this._getSegmentLabel(d, s.last);
    }

   
    // Clear the grid highlight layer
    const hlt = canvas.grid.highlightLayers[this.name];
    hlt.clear();
	

    // Draw measured path
    r.clear();
    for ( let s of segments ) {
      const {ray, label, text, last} = s;

      // Draw line segment
      if(showPath){
	      r.lineStyle(6, 0x000000, 0.5).moveTo(ray.A.x, ray.A.y).lineTo(ray.B.x, ray.B.y)
	       .lineStyle(4, this.color, 0.25).moveTo(ray.A.x, ray.A.y).lineTo(ray.B.x, ray.B.y);
   	   }
      // Draw the distance label just after the endpoint of the segment
      if ( label && game.settings.get('ShowDragDistance','enabled')) {
        label.text = text;
        label.alpha = last ? 1.0 : 0.5;
        label.visible = true;
        let labelPosition = ray.project((ray.distance + 50) / ray.distance);
        label.position.set(labelPosition.x, labelPosition.y);
      }

      // Highlight grid positions
      if(showPath)
     	 this._highlightMeasurement(ray);
    }
    if(showPath){
      // Draw endpoints
	    for ( let p of waypoints ) {
	      r.lineStyle(2, 0x000000, 0.5).beginFill(this.color, 0.25).drawCircle(p.x, p.y, 8);
	    }
	  }

    // Return the measured segments
    return segments;
  }
  _highlightMeasurement(ray) {
    const spacer = canvas.scene.data.gridType === CONST.GRID_TYPES.SQUARE ? 1.41 : 1;
    const nMax = Math.max(Math.floor(ray.distance / (spacer * Math.min(canvas.grid.w, canvas.grid.h))), 1);
    const tMax = Array.fromRange(nMax+1).map(t => t / nMax);

    // Track prior position
    let prior = null;

    // Iterate over ray portions
    for ( let [i, t] of tMax.entries() ) {
      let {x, y} = ray.project(t);

      // Get grid position
      let [x0, y0] = (i === 0) ? [null, null] : prior;
      let [x1, y1] = canvas.grid.grid.getGridPositionFromPixels(x, y);
      if ( x0 === x1 && y0 === y1 ) continue;

      // Highlight the grid position
      let [xg, yg] = canvas.grid.grid.getPixelsFromGridPosition(x1, y1);
      canvas.grid.highlightPosition(this.name, {x: xg, y: yg, color: this.color});

      // Skip the first one
      prior = [x1, y1];
      if ( i === 0 ) continue;

      // If the positions are not neighbors, also highlight their halfway point
      if ( !canvas.grid.isNeighbor(x0, y0, x1, y1) ) {
        let th = tMax[i - 1] + (0.5 / nMax);
        let {x, y} = ray.project(th);
        let [x1h, y1h] = canvas.grid.grid.getGridPositionFromPixels(x, y);
        let [xgh, ygh] = canvas.grid.grid.getPixelsFromGridPosition(x1h, y1h);
        canvas.grid.highlightPosition(this.name, {x: xgh, y: ygh, color: this.color});
      }
    }
  }
  _endMeasurement() {
  	console.log('_endMeasurement')
    this.clear();
    canvas.controls.ruler.clear();
    game.user.broadcastActivity({dragRuler: null});
    tokenDrag = false;
    canvas.mouseInteractionManager.state = MouseInteractionManager.INTERACTION_STATES.HOVER;
  }
  toJSON() {
    return {
      class: "DragRuler",
      name: `DragRuler.${game.user._id}`,
      waypoints: this.waypoints,
      destination: this.destination,
      _state: this._state
    }
  }
  update(data) {
    if ( data.class !== "DragRuler" ) throw new Error("Unable to recreate DragRuler instance from provided data");
   
    // Populate data
    this.waypoints = data.waypoints;
    this.destination = data.destination;
    this._state = data._state;

    // Ensure labels are created
    for ( let i=0; i<this.waypoints.length - this.labels.children.length; i++) {
      this.labels.addChild(new PIXI.Text("", CONFIG.canvasTextStyle));
    }

    // Measure current distance
    if ( data.destination ) this.measure(data.destination);
  }
  _onKeyDown(e) {
  
  }
}
var tokenDrag = false;
var defaultDrag = false;
var rangeFinder = false;
ControlsLayer.prototype.drawDragRulers = function() {
    this.dragRulers = this.addChild(new PIXI.Container());
    for (let u of game.users.entities) {
      let dragRuler = new DragRuler(u);
      this._dragRulers[u._id] = this.dragRulers.addChild(dragRuler);
    }
}


/* Hook fires on control AND release for some reason so we have to check if it's controlled */


Hooks.on('hoverToken', (token,hover)=>{
  if(hover){
    console.log('hover')
    let token2 = token;
     if(canvas.stage.children.last().name == 'Tooltip')
       canvas.stage.children.last().visible = true;
     if(token.mouseDownEvent === false){
      token.mouseDownEvent = true;
      token.on('mousedown',function(event){
        console.log('mousedown')
         //event.data.originalEvent.ctrlKey = true;
         let isCtrl = game.keyboard.isCtrl(event);
    
          if(!isCtrl){
            event.data.origin = token.center;
            if(token._controlled){
              tokenDrag = true;
              canvas.controls.dragRuler._onDragStart(event);
            }
          }else{
           // canvas.controls.dragRuler._endMeasurement();
            //token2._onClickLeft(event);
            defaultDrag = true;
          }
      });
    }
  }else{
    //TOKEN HOVEROUT
    //VTTA-Party fix
    if(canvas.stage.children.last().name == 'Tooltip')
       canvas.stage.children.last().visible = true;
     
      //token.off('mousedown');
      
    
    
     if(token == canvas.tokens.controlled[0] && !game.keyboard.isCtrl(event))
      canvas.controls.dragRuler._endMeasurement();
  }
})

ControlsLayer.prototype.getDragRulerForUser = function(userId) {
	return this._dragRulers[userId] || null;
}
/***************************************************************************************************************/

Token.prototype.mouseDownEvent = false;

Hooks.on('ready', function (){

	canvas.controls.dragRulers = null;
	canvas.controls._dragRulers = {};
	canvas.controls.drawDragRulers();
	Object.defineProperty(canvas.controls,'dragRuler',  {
		get() {
	  		return canvas.controls.getDragRulerForUser(game.user._id);
	}});

})
Hooks.on('preUpdateToken', function(){
  console.log('UpdateToken')
  if(tokenDrag){
    tokenDrag = false;
    rangeFinder = false;
   
   // canvas.controls.dragRuler._endMeasurement();
  }else{
    defaultDrag = false;
  }
})
Hooks.on('updateToken', function(){
  console.log('UpdateToken')
  if(tokenDrag){
    tokenDrag = false;
    rangeFinder = false;
   
   // canvas.controls.dragRuler._endMeasurement();
  }else{
    defaultDrag = false;
  }
})

Hooks.on('canvasReady',function(){

	canvas.controls.dragRulers = null;
	canvas.controls._dragRulers = {};
	canvas.controls.drawDragRulers();;
	canvas.stage.on('mousemove', function(e){
		//console.log('canvas mousemove')
    console.log('tokenDrag',tokenDrag)
    //DRAGGING TOKEN
		if(tokenDrag){
      //HIDES TOKEN TOOLTIP FROM VTTA-PARTY module
      if(canvas.stage.children.last().name == 'Tooltip')
			 canvas.stage.children.last().visible = false;
			e.data.destination = e.data.getLocalPosition(canvas.activeLayer);
			canvas.controls.dragRuler._onMouseMove(e,false);
		
		}
   if(dragOverride){
      e.data.destination = e.data.getLocalPosition(canvas.activeLayer);
     e.data.origin = canvas.tokens.controlled['0'].center;
     canvas.controls.ruler._onMouseMove(e);
   }
    if(game.keyboard.isDown('Control') && canvas.tokens.controlled.length == 1 && !defaultDrag){
    //  rangeFinder = true;
      
       e.data.origin = canvas.tokens.controlled['0'].center;
      if(canvas.controls.dragRuler._state == 0) {
       canvas.controls.dragRuler._onDragStart(e);
      }
       
      e.data.destination = e.data.getLocalPosition(canvas.activeLayer);
      canvas.controls.dragRuler._onMouseMove(e,rangeFinder);
    }
    if(game.keyboard.isDown('Control') == false && !canvas.controls.dragRuler._state == 0 && tokenDrag == false){
       canvas.controls.dragRuler._endMeasurement();
    }
		
	});
var dragOverride = false;
  window.addEventListener('keydown', (e)=>{
    if(e.which == 17  && canvas.tokens.controlled.length == 1 && !tokenDrag){
      e.data = {origin:{},destination:{},originalEvent:e}
      e.data.destination = canvas.app.renderer.plugins.interaction.mouse.getLocalPosition(canvas.tokens);
      e.data.origin = canvas.tokens.controlled['0'].center;
      if(canvas.controls.ruler._state == 0) {
        canvas.controls.ruler._onDragStart(e);
        canvas.controls.ruler._onMouseMove(e);
        console.log(canvas.controls.ruler._state)
      }
      dragOverride = true;
   
   }

    // // IF CTRL IS PRESSED AND A SINGLE TOKEN IS SELECTED
    //  if(e.which == 17  && !defaultDrag && canvas.tokens.controlled.length == 1 && !canvas.tokens.controlled[0]._hover){
    //   rangeFinder = true;
    //   e.data = {origin:{},destination:{},originalEvent:e}
    //   if(canvas.controls.dragRuler._state == 0) {
    //    //SET ORIGIN AND FIRE METHOD TO START BUILDING THE RULER
    //     e.data.origin = canvas.tokens.controlled['0'].center;
    //     canvas.controls.dragRuler._onDragStart(e);
    //   }
    //   //SET DESTINATION AND THEN FIRE METHOD THAT DRAWS THE LINE ON CANVAS
    //   e.data.destination = canvas.app.renderer.plugins.interaction.mouse.getLocalPosition(canvas.tokens);
    //   canvas.controls.dragRuler._onMouseMove(e,rangeFinder,true);
    // }
  })

	window.addEventListener('keyup', (e)=>{

    if(rangeFinder && tokenDrag === false && e.which != 32){
      canvas.controls.ruler.active = false;
      rangeFinder = false;
      canvas.controls.dragRuler._endMeasurement();
      defaultDrag = false;
    }
    if(e.which == 32 && !defaultDrag && rangeFinder){
      e.stopPropagation();
      e.preventDefault();
     // game.togglePause(true,false);
     canvas.controls.ruler.waypoints.push({x:0,y:0})
      canvas.controls.dragRuler.moveToken();
    }
    if(dragOverride && e.which == 17){
      dragOverride = false;
      e.data = {}
      e.data.originalEvent = e;
      canvas.controls.ruler._onMouseUp(e);
      canvas.controls.ruler._state = 0;
    }
  
  })
  canvas.stage.on('click',function(e){
    if(rangeFinder)
      canvas.controls.dragRuler._onClickLeft(e);
  })
})

Hooks.on('init',()=>{
	
})
/*
displayObject.worldTransform.applyInverse(globalPos || this.global, point);

*/