import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { makeNoise4D } from "open-simplex-noise";

const Sphere = () => {
  const mountRef = useRef(null);

  useEffect(() => {
    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    camera.position.set(1.5, -0.5, 6);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    mountRef.current.appendChild(renderer.domElement);

    let controls = new OrbitControls(camera, renderer.domElement);
    controls.enableZoom = false;

    const sphereGeometry = new THREE.SphereGeometry(1.5, 100, 100);
    sphereGeometry.positionData = [];
    const v3 = new THREE.Vector3();

    for (let i = 0; i < sphereGeometry.attributes.position.count; i++) {
      v3.fromBufferAttribute(sphereGeometry.attributes.position, i);
      sphereGeometry.positionData.push(v3.clone());
    }

    const vertexShader = `
      varying vec3 vNormal;
      varying vec3 vPosition;

      void main() {
        vNormal = normalize(normalMatrix * normal);
        vPosition = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `;

    const fragmentShader = `
      varying vec3 vNormal;
      varying vec3 vPosition;

      void main() {
        float scale = 10.0;
        float u = mod(vPosition.x * scale, 1.0);
        float v = mod(vPosition.y * scale, 1.0);
        float radius = 0.15;

        float distanceToCenter = sqrt((u - 0.5) * (u - 0.5) + (v - 0.5) * (v - 0.5));
        if (distanceToCenter > radius) {
          discard;
        }

        vec3 baseColor = vec3(1.0, 0.84, 0.0);
        float intensity = dot(normalize(vNormal), vec3(1.0,0.0,0.0));
        vec3 color = mix(vec3(0.149,0.141,0.912), vec3(1.000,0.833,0.224) , intensity);

        gl_FragColor = vec4(color, 1.0);
      }
    `;

    const sphereMaterial = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      transparent: true,
    });

    const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
    scene.add(sphere);

    const noise = makeNoise4D(Date.now());

    const audioContext = new (window.AudioContext ||
      window.webkitAudioContext)();
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    const dataArray = new Uint8Array(analyser.frequencyBinCount);

    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((stream) => {
        const source = audioContext.createMediaStreamSource(stream);
        source.connect(analyser);
      })

      .catch((err) => {
        alert("Microphone access denied or unavailable.");
      });

    const onWindowResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };

    window.addEventListener("resize", onWindowResize);

    const animate = () => {
      analyser.getByteFrequencyData(dataArray);
      const intensity =
        dataArray.reduce((sum, value) => sum + value, 0) /
        dataArray.length /
        256;

      sphereGeometry.positionData.forEach((p, idx) => {
        const setNoise = noise(
          p.x * 1,
          p.y * 3,
          p.z * 0,
          performance.now() * 0.001
        );
        v3.copy(p).addScaledVector(p, setNoise * intensity * 1.5);
        sphereGeometry.attributes.position.setXYZ(idx, v3.x, v3.y, v3.z);
      });
      sphereGeometry.computeVertexNormals();
      sphereGeometry.attributes.position.needsUpdate = true;

      renderer.render(scene, camera);
      requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener("resize", onWindowResize);
      mountRef.current.removeChild(renderer.domElement);
    };
  }, []);

  return (
    <>
      <div className="canvas-container" ref={mountRef}></div>
    </>
  );
};

export default Sphere;
