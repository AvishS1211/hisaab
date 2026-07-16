// Identity is local, not an account. A device remembers a random device_id and
// which person_id you tapped. No signup, no password — someone could tap the
// wrong name, same as someone could steal the physical notebook. (CLAUDE.md §2, §6.)

const DEVICE_KEY = "hisaab.device";
const PERSON_KEY = "hisaab.person";

/** A stable random id for this browser/device, created on first read. */
export function getDeviceId(): string {
  let id = localStorage.getItem(DEVICE_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(DEVICE_KEY, id);
  }
  return id;
}

/** The person this device is signed in as, or null if not chosen yet. */
export function getIdentity(): string | null {
  try {
    return localStorage.getItem(PERSON_KEY);
  } catch {
    return null;
  }
}

export function setIdentity(personId: string): void {
  try {
    getDeviceId();
    localStorage.setItem(PERSON_KEY, personId);
  } catch {
    // storage unavailable (private mode, etc.) — identity just won't persist
  }
}

export function clearIdentity(): void {
  try {
    localStorage.removeItem(PERSON_KEY);
  } catch {
    /* no-op */
  }
}
