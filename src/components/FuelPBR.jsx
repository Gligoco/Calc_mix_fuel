import React, { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js'

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
    renderer.toneMappingExposure = 1.05
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(mount.clientWidth, mount.clientHeight)
    mount.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    scene.background = null

    const camera = new THREE.PerspectiveCamera(35, mount.clientWidth / mount.clientHeight, 0.1, 100)
    camera.position.set(0.75, 0.95, 2.35)
    camera.lookAt(0, 0.9, 0)

    const hemi = new THREE.HemisphereLight(0xffffff, 0x202020, 0.9)
    scene.add(hemi)
    const key = new THREE.DirectionalLight(0xffffff, 0.9)
    key.position.set(3, 5, 4)
    scene.add(key)

    // Environment (HDR) CC0 from Poly Haven, with local fallback
    const pmrem = new THREE.PMREMGenerator(renderer)
    const rgbe = new RGBELoader()
    const applyHDR = (hdr) => {
      const env = pmrem.fromEquirectangular(hdr).texture
      scene.environment = env
      hdr.dispose?.()
      pmrem.dispose()
    }
    rgbe.load('https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/2k/studio_small_08_2k.hdr', applyHDR, undefined, () => {
      new RGBELoader().setPath('/assets/hdr/').load('studio_2k.hdr', applyHDR, undefined, () => {/* ignore if missing */})
    })

    // Materials
    const canMat = new THREE.MeshStandardMaterial({ color: 0x262a2f, metalness: 0.6, roughness: 0.35 })
    const hoseMat = new THREE.MeshStandardMaterial({ color: 0x151515, metalness: 0.2, roughness: 0.9 })
    const metalMat = new THREE.MeshStandardMaterial({ color: 0xbfc5cc, metalness: 0.9, roughness: 0.25 })
    const gasMat = new THREE.MeshPhysicalMaterial({ color: new THREE.Color('#1A1A1A'), metalness: 0, roughness: 0.7, transmission: 0.05, clearcoat: 0.2, envMapIntensity: 0.6 })
    const ethanolMat = new THREE.MeshPhysicalMaterial({ color: new THREE.Color('#E10600'), metalness: 0, roughness: 0.6, transmission: 0.1, clearcoat: 0.25, envMapIntensity: 0.8 })

    const root = new THREE.Group()
    scene.add(root)

    // Defaults (proxy) inner fluid volume
    let innerWidth = 1.0
    let innerHeight = 1.3
    let innerDepth = 0.36
    let innerY = 0.25 + innerHeight / 2

    const canGroup = new THREE.Group()
    root.add(canGroup)

    // Try load GLB jerrycan
    const gltfLoader = new GLTFLoader()
    gltfLoader.load('/assets/models/jerrycan.glb', (gltf) => {
      const model = gltf.scene
      model.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false } })
      model.scale.set(1, 1, 1)
      model.position.y = 0
      canGroup.add(model)

      const bbox = new THREE.Box3().setFromObject(model)
      const size = new THREE.Vector3(); bbox.getSize(size)
      innerWidth = Math.max(0.6, size.x * 0.7)
      innerHeight = Math.max(0.9, size.y * 0.75)
      innerDepth = Math.max(0.25, size.z * 0.7)
      innerY = bbox.min.y + (size.y * 0.2) + innerHeight / 2
    }, undefined, () => {
      const canGeo = new THREE.BoxGeometry(1.2, 1.6, 0.5)
      const canMesh = new THREE.Mesh(canGeo, canMat)
      canMesh.position.y = 0.8
      canGroup.add(canMesh)
    })

    // Hose + nozzle: try GLB, fall back to parametric
    gltfLoader.load('/assets/models/nozzle.glb', (gltf) => {
      const nz = gltf.scene
      nz.scale.set(1, 1, 1)
      nz.position.set(0.25, 1.52, 0)
      root.add(nz)
    }, undefined, () => {
      const start = new THREE.Vector3(1.3, 1.6, 0.2)
      const end = new THREE.Vector3(0.25, 1.52, 0.0)
      const mid = new THREE.Vector3(0.9, 1.85, 0.25)
      const curve = new THREE.QuadraticBezierCurve3(start, mid, end)
      const tube = new THREE.TubeGeometry(curve, 32, 0.03, 12, false)
      root.add(new THREE.Mesh(tube, hoseMat))
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.15, 20), metalMat)
      barrel.rotation.z = Math.PI / 2; barrel.position.set(0.37, 1.52, 0)
      root.add(barrel)
    })

    // Fluids
    const gasGeo = new THREE.BoxGeometry(innerWidth, innerHeight, innerDepth)
    const ethGeo = new THREE.BoxGeometry(innerWidth, innerHeight, innerDepth)
    const gasMesh = new THREE.Mesh(gasGeo, gasMat)
    const ethMesh = new THREE.Mesh(ethGeo, ethanolMat)
    gasMesh.position.set(0, innerY - innerHeight / 2, 0)
    ethMesh.position.set(0, innerY - innerHeight / 2, 0)
    gasMesh.scale.set(1, 0.0001, 1)
    ethMesh.scale.set(1, 0.0001, 1)
    root.add(gasMesh)
    root.add(ethMesh)

    // Stream
    const stream = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.001, 12), new THREE.MeshStandardMaterial({ color: 0xE10600, emissive: 0x180000 }))
    stream.position.set(0.37, 1.52, 0)
    stream.rotation.z = Math.PI / 2
    root.add(stream)

    // Animate fill
    let startTs = null
    const duration = reducedMotion ? 0 : 2000
    const targetGas = Math.max(0, Math.min(1, 1 - ethanolFraction))
    const targetEth = Math.max(0, Math.min(1, ethanolFraction))

    function animate(ts) {
      if (!startTs) startTs = ts
      const t = duration ? Math.min(1, (ts - startTs) / duration) : 1
      const ease = (x) => 1 - Math.pow(1 - x, 2)
      const f = ease(t)

      gasMesh.scale.y = Math.max(0.0001, targetGas * f)
      ethMesh.scale.y = Math.max(0.0001, targetEth * f)

      const streamLen = 0.55 * (1 - (t > 0.9 ? (t - 0.9) / 0.1 : 0))
      stream.scale.set(1, Math.max(0.001, streamLen), 1)
      stream.visible = t < 0.99

      renderer.render(scene, camera)
      if (t < 1) rafRef.current = requestAnimationFrame(animate)
    }

    function onResize() {
      const w = mount.clientWidth
      const h = Math.max(200, Math.floor((w * 9) / 16))
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

  return <div ref={mountRef} style={{ width: '100%', maxWidth: 360, height: 240, margin: '8px auto 0' }} />
}