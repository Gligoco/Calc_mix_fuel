import React, { useEffect, useRef } from 'react'
import * as THREE from 'three'

export default function FuelPBR({ ethanolFraction = 0.5, playKey = 0, reducedMotion = false }) {
  const mountRef = useRef(null)
  const rafRef = useRef(0)

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    const canvas = document.createElement('canvas')
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl')
    if (!gl) {
      mount.innerHTML = '<div style="color:#aaa">Seu dispositivo não suporta WebGL.</div>'
      return
    }

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.0
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(mount.clientWidth, mount.clientHeight)
    mount.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    scene.background = null

    const camera = new THREE.PerspectiveCamera(35, mount.clientWidth / mount.clientHeight, 0.1, 100)
    camera.position.set(0.7, 0.9, 2.3)
    camera.lookAt(0, 0.9, 0)

    const hemi = new THREE.HemisphereLight(0xffffff, 0x202020, 0.85)
    scene.add(hemi)
    const key = new THREE.DirectionalLight(0xffffff, 0.9)
    key.position.set(3, 5, 4)
    scene.add(key)

    // Jerrycan proxy
    const canGroup = new THREE.Group()
    scene.add(canGroup)

    const canMat = new THREE.MeshStandardMaterial({ color: 0x262a2f, metalness: 0.5, roughness: 0.35 })
    const canGeo = new THREE.BoxGeometry(1.2, 1.6, 0.5)
    const canMesh = new THREE.Mesh(canGeo, canMat)
    canMesh.position.y = 0.8
    canGroup.add(canMesh)

    // Inner fluid bounds
    const innerWidth = 1.0
    const innerHeight = 1.3
    const innerDepth = 0.36
    const innerY = 0.25 + innerHeight / 2

    // Fluids
    const gasMat = new THREE.MeshPhysicalMaterial({ color: new THREE.Color('#1A1A1A'), metalness: 0, roughness: 0.7, transmission: 0.05, clearcoat: 0.2, envMapIntensity: 0.5 })
    const ethanolMat = new THREE.MeshPhysicalMaterial({ color: new THREE.Color('#E10600'), metalness: 0, roughness: 0.6, transmission: 0.1, clearcoat: 0.25, envMapIntensity: 0.7 })
    const gasGeo = new THREE.BoxGeometry(innerWidth, innerHeight, innerDepth)
    const ethGeo = new THREE.BoxGeometry(innerWidth, innerHeight, innerDepth)
    const gasMesh = new THREE.Mesh(gasGeo, gasMat)
    const ethMesh = new THREE.Mesh(ethGeo, ethanolMat)
    gasMesh.position.set(0, innerY - innerHeight / 2, 0)
    ethMesh.position.set(0, innerY - innerHeight / 2, 0)
    gasMesh.scale.set(1, 0.0001, 1)
    ethMesh.scale.set(1, 0.0001, 1)
    canGroup.add(gasMesh)
    canGroup.add(ethMesh)

    // Hose + nozzle
    const hoseMat = new THREE.MeshStandardMaterial({ color: 0x151515, metalness: 0.2, roughness: 0.9 })
    const start = new THREE.Vector3(1.3, 1.6, 0.2)
    const end = new THREE.Vector3(0.25, 1.52, 0.0)
    const mid = new THREE.Vector3(0.9, 1.85, 0.25)
    const curve = new THREE.QuadraticBezierCurve3(start, mid, end)
    const tube = new THREE.TubeGeometry(curve, 32, 0.03, 12, false)
    const hose = new THREE.Mesh(tube, hoseMat)
    scene.add(hose)

    const nozzleGroup = new THREE.Group()
    nozzleGroup.position.copy(end)
    scene.add(nozzleGroup)
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.08, 0.06), new THREE.MeshStandardMaterial({ color: 0x3a3f45, metalness: 0.6, roughness: 0.4 }))
    grip.rotation.z = -0.3
    nozzleGroup.add(grip)
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.15, 16), new THREE.MeshStandardMaterial({ color: 0xbfc5cc, metalness: 0.9, roughness: 0.2 }))
    barrel.rotation.z = Math.PI / 2
    barrel.position.x = 0.12
    nozzleGroup.add(barrel)
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.06, 16), new THREE.MeshStandardMaterial({ color: 0xdde2e7, metalness: 0.9, roughness: 0.2 }))
    tip.rotation.z = Math.PI / 2
    tip.position.x = 0.2
    nozzleGroup.add(tip)

    // Stream
    const streamMat = new THREE.MeshStandardMaterial({ color: 0xE10600, emissive: 0x190000, metalness: 0, roughness: 0.4 })
    const streamGeo = new THREE.CylinderGeometry(0.01, 0.01, 0.001, 10)
    const stream = new THREE.Mesh(streamGeo, streamMat)
    stream.position.copy(end.clone().add(new THREE.Vector3(0.11, -0.06, 0)))
    stream.rotation.z = Math.PI / 2
    scene.add(stream)

    // Animate fill
    let startTs = null
    const duration = reducedMotion ? 0 : 1800
    const targetGas = Math.max(0, Math.min(1, 1 - ethanolFraction))
    const targetEth = Math.max(0, Math.min(1, ethanolFraction))

    function animate(ts) {
      if (!startTs) startTs = ts
      const t = duration ? Math.min(1, (ts - startTs) / duration) : 1
      const ease = (x) => 1 - Math.pow(1 - x, 2)
      const f = ease(t)

      gasMesh.scale.y = Math.max(0.0001, targetGas * f)
      ethMesh.scale.y = Math.max(0.0001, targetEth * f)

      // Stream grows then hides near the end
      const streamLen = 0.5 * (1 - (t > 0.85 ? (t - 0.85) / 0.15 : 0))
      stream.scale.set(1, Math.max(0.001, streamLen), 1)
      stream.visible = t < 0.98

      renderer.render(scene, camera)
      if (t < 1) rafRef.current = requestAnimationFrame(animate)
    }

    function onResize() {
      const w = mount.clientWidth
      const h = Math.max(180, Math.floor((w * 9) / 16))
      renderer.setSize(w, h)
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      renderer.render(scene, camera)
    }

    window.addEventListener('resize', onResize)
    onResize()
    rafRef.current = requestAnimationFrame(animate)

    return () => {
      cancelAnimationFrame(rafRef.current)
      window.removeEventListener('resize', onResize)
      renderer.dispose()
      mount.removeChild(renderer.domElement)
    }
  }, [playKey, ethanolFraction, reducedMotion])

  return <div ref={mountRef} style={{ width: '100%', maxWidth: 360, height: 220, margin: '8px auto 0' }} />
}