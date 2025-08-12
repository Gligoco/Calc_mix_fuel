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
    camera.position.set(0.6, 0.7, 2.2)
    camera.lookAt(0, 0.3, 0)

    const hemi = new THREE.HemisphereLight(0xffffff, 0x202020, 0.8)
    scene.add(hemi)
    const key = new THREE.DirectionalLight(0xffffff, 0.9)
    key.position.set(3, 5, 4)
    scene.add(key)

    const canGroup = new THREE.Group()
    scene.add(canGroup)

    const canMat = new THREE.MeshStandardMaterial({ color: 0x262a2f, metalness: 0.5, roughness: 0.4 })
    const canGeo = new THREE.BoxGeometry(1.2, 1.6, 0.5)
    const canMesh = new THREE.Mesh(canGeo, canMat)
    canMesh.position.y = 0.8
    canGroup.add(canMesh)

    const innerWidth = 1.0
    const innerHeight = 1.3
    const innerDepth = 0.36
    const innerY = 0.25 + innerHeight / 2

    const fluidGroup = new THREE.Group()
    canGroup.add(fluidGroup)

    const gasColor = new THREE.Color('#1A1A1A')
    const ethanolColor = new THREE.Color('#E10600')

    const gasMat = new THREE.MeshPhysicalMaterial({ color: gasColor, metalness: 0, roughness: 0.7, transmission: 0.05, clearcoat: 0.2, envMapIntensity: 0.5 })
    const ethanolMat = new THREE.MeshPhysicalMaterial({ color: ethanolColor, metalness: 0, roughness: 0.6, transmission: 0.1, clearcoat: 0.25, envMapIntensity: 0.7 })

    const gasGeo = new THREE.BoxGeometry(innerWidth, innerHeight, innerDepth)
    const ethanolGeo = new THREE.BoxGeometry(innerWidth, innerHeight, innerDepth)

    const gasMesh = new THREE.Mesh(gasGeo, gasMat)
    const ethanolMesh = new THREE.Mesh(ethanolGeo, ethanolMat)

    gasMesh.position.set(0, innerY - innerHeight / 2, 0)
    ethanolMesh.position.set(0, innerY - innerHeight / 2, 0)

    gasMesh.scale.set(1, 0.0001, 1)
    ethanolMesh.scale.set(1, 0.0001, 1)

    fluidGroup.add(gasMesh)
    fluidGroup.add(ethanolMesh)

    let start = null
    const duration = reducedMotion ? 0 : 1800
    const targetGas = Math.max(0, Math.min(1, 1 - ethanolFraction))
    const targetEth = Math.max(0, Math.min(1, ethanolFraction))

    function animateFill(ts) {
      if (!start) start = ts
      const t = duration ? Math.min(1, (ts - start) / duration) : 1
      const ease = (x) => 1 - Math.pow(1 - x, 2)

      const f = ease(t)
      gasMesh.scale.y = Math.max(0.0001, targetGas * f)
      ethanolMesh.scale.y = Math.max(0.0001, targetEth * f)

      renderer.render(scene, camera)
      if (t < 1) rafRef.current = requestAnimationFrame(animateFill)
    }

    function onResize() {
      const w = mount.clientWidth
      const h = Math.max(160, Math.floor((w * 9) / 16))
      renderer.setSize(w, h)
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      renderer.render(scene, camera)
    }

    window.addEventListener('resize', onResize)
    onResize()
    rafRef.current = requestAnimationFrame(animateFill)

    return () => {
      cancelAnimationFrame(rafRef.current)
      window.removeEventListener('resize', onResize)
      renderer.dispose()
      mount.removeChild(renderer.domElement)
    }
  }, [playKey, ethanolFraction, reducedMotion])

  return <div ref={mountRef} style={{ width: '100%', maxWidth: 360, height: 200, margin: '8px auto 0' }} />
}