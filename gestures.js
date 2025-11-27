/* gestures.js - Versión Completa: Rotar, Escalar y Mover */

// Componente 1: Detecta qué están haciendo los dedos
AFRAME.registerComponent("gesture-detector", {
  schema: { element: { default: "" } },
  init: function() {
    this.targetElement = this.data.element && document.querySelector(this.data.element);
    if (!this.targetElement) { this.targetElement = this.el; }
    this.internalState = { previousState: null };
    this.emitGestureEvent = this.emitGestureEvent.bind(this);
    this.targetElement.addEventListener("touchstart", this.emitGestureEvent);
    this.targetElement.addEventListener("touchend", this.emitGestureEvent);
    this.targetElement.addEventListener("touchmove", this.emitGestureEvent);
  },
  remove: function() {
    this.targetElement.removeEventListener("touchstart", this.emitGestureEvent);
    this.targetElement.removeEventListener("touchend", this.emitGestureEvent);
    this.targetElement.removeEventListener("touchmove", this.emitGestureEvent);
  },
  emitGestureEvent: function(event) {
    const currentState = this.getTouchState(event);
    const previousState = this.internalState.previousState;
    const gestureContinues = previousState && currentState && currentState.touchCount == previousState.touchCount;
    const gestureEnded = previousState && !gestureContinues;
    const gestureStarted = currentState && !gestureContinues;

    if (gestureEnded) { this.el.emit("gesture-end"); }
    if (gestureStarted) { this.el.emit("gesture-start"); }
    if (gestureContinues) {
      const eventDetail = {
        positionChange: { x: currentState.position.x - previousState.position.x, y: currentState.position.y - previousState.position.y },
        spreadChange: currentState.spread - previousState.spread,
        startPosition: currentState.position,
        position: currentState.position,
        touchCount: currentState.touchCount // Importante: enviamos cuántos dedos hay
      };
      this.el.emit("gesture-move", eventDetail);
    }
    this.internalState.previousState = currentState;
  },
  getTouchState: function(event) {
    if (event.touches.length === 0) return null;
    if (event.touches.length === 1) {
      return { touchCount: 1, position: { x: event.touches[0].pageX, y: event.touches[0].pageY }, spread: 0 };
    }
    const p1 = { x: event.touches[0].pageX, y: event.touches[0].pageY };
    const p2 = { x: event.touches[1].pageX, y: event.touches[1].pageY };
    const spread = Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
    const midPoint = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
    return { touchCount: 2, position: midPoint, spread: spread };
  }
});

// Componente 2: Reacciona a los gestos moviendo el objeto
AFRAME.registerComponent("gesture-handler", {
  schema: {
    enabled: { default: true },
    rotationFactor: { default: 5 }, // Velocidad de rotación
    minScale: { default: 0.05 },
    maxScale: { default: 8 },
    panningFactor: { default: 0.005 } // Velocidad de movimiento
  },
  init: function() {
    this.handleScale = this.handleScale.bind(this);
    this.handleRotation = this.handleRotation.bind(this);
    this.handlePan = this.handlePan.bind(this);
    
    this.isVisible = false;
    this.initialScale = this.el.object3D.scale.clone();
    this.scaleFactor = 1;

    this.el.sceneEl.addEventListener("markerFound", (e) => { this.isVisible = true; });
    this.el.sceneEl.addEventListener("markerLost", (e) => { this.isVisible = false; });
  },
  update: function() {
    if (this.data.enabled) {
      this.el.sceneEl.addEventListener("gesture-move", this.handleRotation);
      this.el.sceneEl.addEventListener("gesture-move", this.handleScale);
      this.el.sceneEl.addEventListener("gesture-move", this.handlePan);
    } else {
      this.el.sceneEl.removeEventListener("gesture-move", this.handleRotation);
      this.el.sceneEl.removeEventListener("gesture-move", this.handleScale);
      this.el.sceneEl.removeEventListener("gesture-move", this.handlePan);
    }
  },
  handleRotation: function(event) {
    // Solo rota si hay 1 dedo
    if (this.isVisible && event.detail.touchCount === 1) {
      this.el.object3D.rotation.y += event.detail.positionChange.x * this.data.rotationFactor * 2 * Math.PI / 1000;
      // Opcional: Descomenta si quieres rotar arriba/abajo también
      // this.el.object3D.rotation.x += event.detail.positionChange.y * this.data.rotationFactor * 2 * Math.PI / 1000;
    }
  },
  handleScale: function(event) {
    // Solo escala si hay 2 dedos y cambio de distancia
    if (this.isVisible && event.detail.touchCount === 2 && event.detail.spreadChange) {
      this.scaleFactor *= 1 + event.detail.spreadChange / 1000;
      this.scaleFactor = Math.min(Math.max(this.scaleFactor, this.data.minScale), this.data.maxScale);
      this.el.object3D.scale.x = this.scaleFactor * this.initialScale.x;
      this.el.object3D.scale.y = this.scaleFactor * this.initialScale.y;
      this.el.object3D.scale.z = this.scaleFactor * this.initialScale.z;
    }
  },
  handlePan: function(event) {
    // Solo mueve (pan) si hay 2 dedos
    if (this.isVisible && event.detail.touchCount === 2) {
      // FIX: Quitamos la división por escala para evitar saltos gigantes
      // Usamos un factor fijo para que el movimiento sea 1:1 con el dedo
      const factor = this.data.panningFactor; 

      this.el.object3D.position.x += event.detail.positionChange.x * factor;
      
      // Invertimos Y para que el movimiento sea natural (dedo arriba = objeto arriba)
      this.el.object3D.position.y -= event.detail.positionChange.y * factor; 
    }
  }
});