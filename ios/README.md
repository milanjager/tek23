# VWTOBD — VW T5 OBD II Diagnostic App

A native iOS app for diagnosing VW T5 Transporter vehicles (2000+) via OBD II.

## Features

- **Live Gauges** — RPM, Speed, Coolant Temp, Engine Load with real-time sparklines
- **Fault Code Scanner** — Read and clear DTCs with VW T5-specific descriptions, probable causes, and fix hints
- **Live PID Data** — 12 monitored PIDs grouped by system (Engine, Fuel, Cooling, Timing) with history graphs
- **Diagnostic Templates** — 8 guided step-by-step flows for common T5 issues (turbo, EGR, DPF, glow plugs, ABS…)
- **Demo Mode** — Fully functional with simulated sensor data — no adapter needed to explore the app

## Requirements

- Xcode 15 or later
- iOS 16.0+ deployment target
- iPhone (iPad not supported)
- ELM327-compatible OBD II adapter (Bluetooth or Wi-Fi) for live vehicle data

## Opening in Xcode

```
open ios/VWTOBD.xcodeproj
```

Or in Finder: navigate to `ios/` and double-click `VWTOBD.xcodeproj`.

## Building to a Device

1. Open the project in Xcode
2. Select the `VWTOBD` target → **Signing & Capabilities**
3. Set your **Team** (Apple Developer account)
4. Plug in your iPhone, select it as the run destination
5. Press **⌘R** to build and run

No third-party dependencies — no CocoaPods, no Swift Package Manager packages required.

## Connecting an OBD Adapter

The app scaffolds CoreBluetooth and Network (Wi-Fi) permissions. Live adapter support is the next milestone. Until then, use **Demo Mode** (enabled by default) to explore all features.

Supported adapter types (settings screen):
- ELM327 Bluetooth
- ELM327 Wi-Fi
- OBDLink MX+
- Veepeak

## Diagnostic Templates

Predefined guided flows for beginners:

| Template | Target Issue |
|---|---|
| Cold Start Check | Rough startup, white smoke |
| Rough Idle / Misfire | Uneven idle, P030x codes |
| Turbo / No Power | VNT actuator, boost leak, P0299 |
| EGR System | EGR valve stuck, cooler leak |
| Fuel System | Trim drift, injector wear |
| ABS / Brakes | Wheel speed sensor, C00xx codes |
| Glow Plugs | Cold start fail, P0380 |
| DPF / Emissions | Regeneration cycle, P2002 |

## Project Structure

```
ios/
├── VWTOBD.xcodeproj/
└── VWTOBD/
    ├── Extensions/          Color helpers
    ├── Models/              FaultCode, LiveDataPID, DiagnosticTemplate
    ├── Data/                VWT5-specific DTCs and template definitions
    ├── ViewModels/          OBDViewModel (Combine-powered simulation engine)
    └── Views/
        ├── Components/      GaugeCard, SparklineView, VWT5CarView
        ├── HomeView.swift
        ├── FaultCodesView.swift
        ├── LiveDataView.swift
        ├── TemplatesView.swift
        └── SettingsView.swift
```
