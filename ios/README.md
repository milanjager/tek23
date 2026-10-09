# VWTOBD — VW T5 OBD II Diagnostic App

A native iOS app for diagnosing VW T5 Transporter vehicles (2000+) via OBD II.

## Quick Install (Mac + iPhone)

```bash
cd ios
chmod +x install.sh
./install.sh
```

The script will:
1. Check Xcode 15+ is installed
2. Detect your connected iPhone automatically
3. Ask for your Apple Team ID (free Apple ID works — no paid membership needed)
4. Build and install directly to your phone

**Simulator instead:**
```bash
./install.sh --simulator
# or
make sim
```

**With Team ID pre-set (skip the prompt):**
```bash
export DEVELOPMENT_TEAM=XXXXXXXXXX   # your 10-char Team ID
./install.sh
# or
make device
```

Find your Team ID at [developer.apple.com/account](https://developer.apple.com/account) → Membership → Team ID.

---

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

## Manual Xcode Setup

```
open ios/VWTOBD.xcodeproj
```

1. Select the `VWTOBD` target → **Signing & Capabilities**
2. Set your **Team** (free Apple ID works)
3. Plug in your iPhone, select it as the run destination
4. Press **⌘R**

No third-party dependencies — no CocoaPods, no SPM packages.

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
