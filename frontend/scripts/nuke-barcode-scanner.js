#!/usr/bin/env node
/*
 * Nuclear cache-buster for the deprecated `expo-barcode-scanner` module.
 *
 * Why this exists:
 * -----------------
 * Expo SDK 54 removed the native header `ExpoModulesCore/EXBarcodeScannerInterface.h`,
 * so any remnants of `expo-barcode-scanner` in node_modules will break the iOS
 * CocoaPods install phase on EAS Build with:
 *   "'ExpoModulesCore/EXBarcodeScannerInterface.h' file not found"
 *
 * We have removed the package from `dependencies` and `yarn.lock`, excluded it via
 * `expo.autolinking.exclude`, and blocked it in `react-native.config.js`. However
 * EAS Build's remote workers aggressively cache the node_modules / Pods state
 * between builds, so a stale folder can still ship to the pod-install phase.
 *
 * This script physically deletes any `expo-barcode-scanner` directory (top-level
 * or nested / hoisted) after every `yarn install`, guaranteeing Expo prebuild
 * cannot discover it and will NOT generate an iOS Pod for it.
 *
 * This is intentionally belt-and-suspenders. It is a no-op in 99% of runs.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const NODE_MODULES = path.join(ROOT, 'node_modules');

function rmrf(target) {
  try {
    if (fs.existsSync(target)) {
      fs.rmSync(target, { recursive: true, force: true });
      console.log(`[nuke-barcode-scanner] Removed: ${target}`);
      return true;
    }
  } catch (err) {
    console.warn(`[nuke-barcode-scanner] Failed to remove ${target}:`, err.message);
  }
  return false;
}

function walk(dir, depth = 0) {
  if (depth > 6) return; // safety: don't recurse forever
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const full = path.join(dir, entry.name);
    if (entry.name === 'expo-barcode-scanner') {
      rmrf(full);
      continue;
    }
    // Only descend into nested node_modules to catch hoisted/nested installs
    if (entry.name === 'node_modules' || depth === 0) {
      walk(full, depth + 1);
    }
  }
}

if (!fs.existsSync(NODE_MODULES)) {
  // Nothing to clean — e.g. first install or CI cache miss
  process.exit(0);
}

console.log('[nuke-barcode-scanner] Scanning node_modules for expo-barcode-scanner...');
walk(NODE_MODULES);
console.log('[nuke-barcode-scanner] Done.');
