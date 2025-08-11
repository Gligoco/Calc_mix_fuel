# Fuel Mix Calculator

A modern, responsive calculator for building ethanol/gasoline fuel mixtures for performance cars. Built with React + Vite.

## Dev

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
npm run preview
```

## Features
- Real-time calculation as inputs change
- Unit switcher (L/gal)
- Save presets (stored in localStorage)
- Dynamic fuel tank visualization (red = ethanol, dark gray = gasoline)
- Responsive, mobile-friendly UI

## Math
Let:
- A = current volume in tank (liters)
- Ec = current ethanol fraction (0..1)
- Et = desired ethanol fraction (0..1)
- x_e = volume of pure ethanol (E100) to add (liters)
- x_g = volume of pure gasoline (E0) to add (liters)

If adding ethanol only:
```
(A * Ec + x_e) / (A + x_e) = Et → x_e = A * (Et - Ec) / (1 - Et)
```
If adding gasoline only:
```
(A * Ec) / (A + x_g) = Et → x_g = A * (Ec - Et) / Et
```
Values are clamped at 0 when the target is not reachable by the chosen add-mode.

## Branding
Replace `public/logo.svg` with your brand mark to customize the header and watermark.
