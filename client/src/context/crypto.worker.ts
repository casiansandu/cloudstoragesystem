import config from "../../config/config";
import srp from "secure-remote-password/client";
import type {
  SrpLoginStartResponse,
  SrpLoginVerifyResponse,
  GetUserKeysResponse,
  UserFile,
  ManifestData,
} from "../utils/apiTypes";
import {
  bufferToHex,
  deriveKEK,
  hexToBuffer,
  decrypt,
  decryptRSA,
  generateMasterKey,
  encrypt,
  encryptRSA,
  deriveChunkKey,
  generateAsymKeyPair,
} from "../../utils/crypto";
import { concatUint8, gen_uuidv5 } from "../utils/funcs";
import { sha256 } from "js-sha256";
import shareFile from "../components/ShareFileFeature/shareFile";
import { fetchChunk } from "../components/DownloadFileFeature/downloadFile";
import {
  startUpload,
  uploadManifest,
  handleChunkEncryption,
  uploadChunk,
  encryptManifest,
} from "../components/UploadFileFeature/uploadFile";
import post_register from "../Register/registerUser";

let userPrivateKey: CryptoKey | null = null;
let userPublicKey: CryptoKey | null = null;

type keysData = {
  encrypted_file_key: string;
  encrypted_manifest_key: string;
  temp_decrypted_file_key: BufferSource | null;
};

const sessionFileKeys = new Map<string, keysData>();

export const getManifestData = async (
  file_id: string
): Promise<ManifestData> => {
  if (!userPrivateKey) {
    throw new Error("User private key not initialized");
  }

  const manifest_name = sha256(file_id + "manifest");

  const manifest_data = await fetchChunk(file_id, gen_uuidv5(manifest_name));

  const wrapped_key = sessionFileKeys.get(file_id)?.encrypted_manifest_key;

  if (!wrapped_key) {
    throw new Error("Manifest key not found in session for file: " + file_id);
  }

  const enc_manifest_nonce = manifest_data.slice(0, 12);
  const enc_manifest_ciphertext = manifest_data.slice(12);

  const manifest_key = await decryptRSA(
    hexToBuffer(wrapped_key) as BufferSource,
    userPrivateKey
  );

  const manifest = await decrypt(
    enc_manifest_ciphertext,
    manifest_key as BufferSource,
    enc_manifest_nonce
  );

  const manifest_json: ManifestData = JSON.parse(
    new TextDecoder().decode(manifest)
  );

  return manifest_json;
};

globalThis.onmessage = async (e: MessageEvent) => {
  const { id, type, payload } = e.data;

  try {
    let result;

    switch (type) {
      case "PERFORM_FULL_LOGIN": {
        const username = payload.username;
        const password = payload.password;

        const { public: client_public, secret: client_secret } =
          srp.generateEphemeral();

        const startRes = await fetch(`${config.BACKENDURL}/auth/login/start`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ username, client_public }),
        });

        const startData: SrpLoginStartResponse = await startRes.json();
        if (!startData.success) throw new Error(startData.message);

        const loginSessionId = startData.data.loginSessionId;

        const privateKey = srp.derivePrivateKey(
          startData.data.salt,
          username,
          password
        );

        const clientSession = srp.deriveSession(
          client_secret,
          startData.data.server_public,
          startData.data.salt,
          username,
          privateKey
        );

        const verifyRes = await fetch(
          `${config.BACKENDURL}/auth/login/verify`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
              client_session_proof: clientSession.proof,
              loginSessionId,
            }),
          }
        );

        const verifyData: SrpLoginVerifyResponse = await verifyRes.json();
        if (!verifyData.success) throw new Error(verifyData.message);

        srp.verifySession(
          client_public,
          clientSession,
          verifyData.data.server_session_proof
        );

        await fetch(`${config.BACKENDURL}/users/keys`, {
          method: "GET",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
        })
          .then((res) => res.json() as Promise<GetUserKeysResponse>)
          .then(async (data) => {
            if (!data.success) {
              throw new Error(data.message);
            }
            console.log("Fetched user keys:", data);

            const kek = await deriveKEK(
              password,
              Uint8Array.from(hexToBuffer(data.data.encryption_salt))
            );

            const private_key_data = new Uint8Array(
              hexToBuffer(data.data.encrypted_private_key)
            );
            const private_key_nonce = private_key_data.slice(0, 12);
            const private_key_ciphertext = private_key_data.slice(12);

            const decryptedPrivateKey = await decrypt(
              private_key_ciphertext,
              kek,
              private_key_nonce
            );

            userPrivateKey = await crypto.subtle.importKey(
              "pkcs8",
              decryptedPrivateKey as BufferSource,
              {
                name: "RSA-OAEP",
                hash: { name: "SHA-256" },
              },
              false,
              ["decrypt"]
            );

            userPublicKey = await crypto.subtle.importKey(
              "spki",
              hexToBuffer(data.data.encryption_public_key) as BufferSource,
              {
                name: "RSA-OAEP",
                hash: { name: "SHA-256" },
              },
              false,
              ["encrypt"]
            );

            console.log("User keys initialized in worker.");
          });

        result = { success: true };

        break;
      }

      case "REGISTER_USER": {
        const username = payload.username;
        const password = payload.password;
        const email = payload.email;

        const salt = srp.generateSalt();
        const _privateKey = srp.derivePrivateKey(salt, username, password);
        const verifier = srp.deriveVerifier(_privateKey);

        const { publicKey, privateKey } = await generateAsymKeyPair();
        console.log("Generated key pair for user");
        //A, a

        const encryptionSalt = globalThis.crypto.getRandomValues(
          new Uint8Array(16)
        );
        //salt for KEK derivation

        const kek = await deriveKEK(password, encryptionSalt);
        //key encryption key

        const encryptedPrivateKey = await encrypt(privateKey, kek);
        //encrypted private key with kek

        //server stores enc_kek(a), A, encryption salt, and nonce
        await post_register(
          username,
          email,
          salt,
          verifier,
          encryptionSalt,
          concatUint8(
            encryptedPrivateKey.nonce,
            encryptedPrivateKey.ciphertext
          ),
          new Uint8Array(publicKey)
        );

        result = { success: true };

        break;
      }

      case "GET_FILE_KEYS": {
        if (!userPrivateKey) {
          throw new Error("User private key not initialized");
        }

        const user_file_keys = await fetch(
          `${config.BACKENDURL}/users/file-keys`,
          {
            method: "GET",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
          }
        )
          .then((res) => res.json())
          .then((data) => {
            if (!data.success) {
              throw new Error("Failed to fetch user file keys");
            }
            return data.data.fileKeysData as {
              file_id: string;
              encrypted_file_key: string;
              encrypted_manifest_key: string;
            }[];
          });

        for (const {
          file_id,
          encrypted_file_key,
          encrypted_manifest_key,
        } of user_file_keys) {
          sessionFileKeys.set(file_id, {
            encrypted_file_key,
            encrypted_manifest_key,
            temp_decrypted_file_key: null,
          });
        }
        result = { success: true };
        break;
      }

      case "GET_FILE_NAMES": {
        if (!userPrivateKey) {
          throw new Error("User private key not initialized");
        }

        const files = payload.files as UserFile[];

        const decryptedFilesPromise = files.map(async (file) => {
          try {
            const file_master_key = sessionFileKeys.get(
              file.id
            )?.encrypted_file_key;

            if (!file_master_key) {
              throw new Error(
                "File master key not found in session for file: " + file.id
              );
            }

            const decrypted_file_master_key = (await decryptRSA(
              hexToBuffer(file_master_key) as BufferSource,
              userPrivateKey as CryptoKey
            )) as BufferSource;

            const enc_name_data = hexToBuffer(file.name);
            const nonce = enc_name_data.slice(0, 12);
            const ciphertext = enc_name_data.slice(12);

            const decrypted_name_buffer = await decrypt(
              ciphertext,
              decrypted_file_master_key,
              nonce
            );

            const decryptedName = new TextDecoder().decode(
              decrypted_name_buffer
            );

            return { ...file, id: file.id, name: decryptedName };
          } catch (error) {
            console.error("Decryption failed for:", file.name, error);
            return file;
          }
        });

        result = { files: await Promise.all(decryptedFilesPromise) };

        break;
      }

      case "UPLOAD_FILE": {
        const selectedFile: File = payload.file;
        let file_id = "";
        if (!userPrivateKey) {
          throw new Error("User private key not initialized");
        }
        if (!userPublicKey) {
          throw new Error("No public key found in session storage");
        }
        const file_size_bytes = selectedFile.size;

        const chunk_size = 5 * 1024 * 1024; // 5 MB
        const chunk_number = Math.ceil(file_size_bytes / chunk_size);

        const file_key = await generateMasterKey(); // BufferSource
        const enc_file_key = bufferToHex(
          (await encryptRSA(file_key, userPublicKey)) as BufferSource
        ); //string

        const enc_file_name_data = await encrypt(selectedFile.name, file_key);

        file_id = await startUpload(
          enc_file_name_data,
          selectedFile,
          file_id,
          enc_file_key,
          userPublicKey
        );

        const manifest: ManifestData = {
          file_id: file_id,
          totalChunks: chunk_number,
          uploadedAt: new Date().toISOString(),
          encryptedFileKey: enc_file_key,
          file_size: file_size_bytes,
          chunkInfos: [],
        };

        let chunk_index = 0;

        while (chunk_index < chunk_number) {
          const { chunk_data_buffer, chunk_id } = await handleChunkEncryption(
            file_key,
            chunk_index,
            file_id,
            chunk_size,
            selectedFile,
            chunk_number
          );

          await uploadChunk(chunk_data_buffer, file_id, chunk_id);

          manifest.chunkInfos.push({
            index: chunk_index,
            id: chunk_id,
            ciphertextLength: chunk_data_buffer.byteLength,
          });

          chunk_index += 1;
        }

        // const { manifest_uuid, wrapped_manifest_key } = await uploadManifest(
        //   file_id,
        //   manifest,
        //   userPublicKey,
        //   userPrivateKey
        // );

        const { encrypted_manifest_buffer, manifest_uuid, wrapped_manifest_key } =
          await encryptManifest(file_id, manifest, userPrivateKey, userPublicKey);

        await uploadChunk(
          encrypted_manifest_buffer,
          file_id,
          manifest_uuid
        );

        //console.log("manifest uploaded: ", manifest_uuid)

        sessionFileKeys.set(file_id, {
          encrypted_file_key: enc_file_key,
          encrypted_manifest_key: wrapped_manifest_key,
          temp_decrypted_file_key: null,
        });

        result = { success: true, fileId: file_id };
        break;
      }

      case "GET_CHUNK_INFOS": {
        const file_id: string = payload.fileId;
        const manifest_json = await getManifestData(file_id);
        const file_size = manifest_json.file_size;

        result = { fileSize: file_size, chunks: manifest_json.chunkInfos };
        break;
      }

      case "GET_AND_DECRYPT_CHUNK": {
        if (!userPrivateKey) {
          throw new Error("User private key not initialized");
        }

        const file_id: string = payload.fileId;
        const chunk_id: string = payload.chunkId;
        const chunk_index = payload.chunkIndex;

        const chunk_data = await fetchChunk(file_id, chunk_id);

        if (!sessionFileKeys.get(file_id)) {
          throw new Error("File session data not found for file: " + file_id);
        }

        const file_master_key_encrypted =
          sessionFileKeys.get(file_id)?.encrypted_file_key;

        if (!file_master_key_encrypted) {
          throw new Error(
            "File master key not found in session for file: " + file_id
          );
        }

        let file_master_key =
          sessionFileKeys.get(file_id)!.temp_decrypted_file_key;

        if (!file_master_key) {
          file_master_key = (await decryptRSA(
            hexToBuffer(file_master_key_encrypted) as BufferSource,
            userPrivateKey
          )) as BufferSource;
          sessionFileKeys.get(file_id)!.temp_decrypted_file_key =
            file_master_key;
        }

        const chunk_key = await deriveChunkKey(
          file_master_key,
          chunk_index,
          file_id
        );

        const chunk_nonce = chunk_data.slice(0, 12);
        const chunk_ciphertext = chunk_data.slice(12);

        const decrypted_chunk = await decrypt(
          chunk_ciphertext,
          chunk_key,
          chunk_nonce
        );

        result = { decryptedChunk: decrypted_chunk };

        self.postMessage(
          {
            id,
            type: "SUCCESS",
            result,
          },
          {
            transfer: [decrypted_chunk.buffer],
          }
        );
        console.log("decrypted chunk", chunk_index);
        //console.log(decrypted_chunk.byteLength);// prevent double, hand over memory to main thread -> len 0
        return;
      }

      case "SHARE_FILE": {
        if (!userPrivateKey) {
          throw new Error("User private key not initialized");
        }

        const file_id: string = payload.fileId;
        const recipient_username: string = payload.recipientUsername;

        const encrypted_manifest_key = sessionFileKeys.get(
          payload.fileId
        )?.encrypted_manifest_key;
        if (!encrypted_manifest_key) {
          throw new Error(
            "File session data not found for file: " + payload.fileId
          );
        }

        const encrypted_file_key = sessionFileKeys.get(
          payload.fileId
        )?.encrypted_file_key;
        if (!encrypted_file_key) {
          throw new Error(
            "File session data not found for file: " + payload.fileId
          );
        }

        await shareFile(
          file_id,
          recipient_username,
          encrypted_file_key,
          encrypted_manifest_key,
          userPrivateKey
        );
        result = { success: true };
        break;
      }

      case "CLOSE_FILE": {
        const file_id = payload.fileId;

        const entry = sessionFileKeys.get(file_id);
        if (entry) {
          entry.temp_decrypted_file_key = null;
        }

        result = { success: true };
        break;
      }

      default:
        throw new Error(`Unknown command: ${type}`);
    }

    self.postMessage({ id, type: "SUCCESS", result });
  } catch (err: any) {
    self.postMessage({ id, type: "ERROR", error: err.message });
  }
};

export {};
