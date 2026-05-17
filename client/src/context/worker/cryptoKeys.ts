import { sha3_256 } from "@noble/hashes/sha3.js";
import { hkdf } from "@noble/hashes/hkdf.js";

export const expandKeyForName = (key: Uint8Array) => {
  const usableKey = key instanceof Uint8Array ? key : new Uint8Array(key);

  const fileNameKey = hkdf(
    sha3_256,
    usableKey,
    undefined,
    new TextEncoder().encode("file-name-encryption"),
    32
  );

  return fileNameKey;
};

export const expandKeyForData = (key: Uint8Array) => {
  const usableKey = key instanceof Uint8Array ? key : new Uint8Array(key);

  const fileDataKey = hkdf(
    sha3_256,
    usableKey,
    undefined,
    new TextEncoder().encode("file-chunk-encryption"),
    32
  );

  return fileDataKey;
};

export const expandKeyForManifest = (key: Uint8Array) => {
  const usableKey = key instanceof Uint8Array ? key : new Uint8Array(key);
  const manifestKey = hkdf(
    sha3_256,
    usableKey,
    undefined,
    new TextEncoder().encode("file-manifest-encryption"),
    32
  );

  return manifestKey;
};
