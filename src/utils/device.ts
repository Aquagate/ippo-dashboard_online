// ===== Device ID Management =====
// Generates and stores a unique ID for this browser/device instance.

import { uuid } from './helpers';

const DEVICE_ID_KEY = "ippo_deviceId";

let cachedDeviceId: string | null = null;

export function getDeviceId(): string {
    if (cachedDeviceId) return cachedDeviceId;

    const stored = localStorage.getItem(DEVICE_ID_KEY);
    if (stored) {
        cachedDeviceId = stored;
        return stored;
    }

    const newId = uuid();
    localStorage.setItem(DEVICE_ID_KEY, newId);
    cachedDeviceId = newId;
    return newId;
}
