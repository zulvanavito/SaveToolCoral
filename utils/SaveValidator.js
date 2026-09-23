import { CoralCompressor, PACKAGE_FILE_TAG } from "./CoralCompressor.js";
import { Gvas } from "../models/Gvas.js";
import * as zlib from "zlib";

export class SaveValidator {
  /**
   * Run full validation suite on a rebuilt save buffer before writing to disk
   * @param {Buffer} buffer The serialized .sav buffer
   * @param {object} [referenceGvas] The Gvas object prior to rebuild
   * @returns {{ valid: boolean, errors: string[] }}
   */
  static validate(buffer, referenceGvas = null) {
    let errors = [];

    // 1. Validate GVAS Header
    try {
      this.validateGvasHeader(buffer);
    } catch (err) {
      errors.push(`GVAS Header Validation Error: ${err.message}`);
    }

    // 2. Validate Compression Blocks if compressed
    if (CoralCompressor.isCoralCompressed(buffer)) {
      try {
        this.validateCompressionBlocks(buffer);
      } catch (err) {
        errors.push(`Compression Block Validation Error: ${err.message}`);
      }
    }

    // 3. Validate Parser Re-Read
    let reReadGvas = null;
    try {
      reReadGvas = new Gvas();
      reReadGvas.deserializeFromBuffer(buffer);
    } catch (err) {
      errors.push(
        `Parser Re-Read Error: File could not be re-parsed by GVAS deserializer: ${err.message}`,
      );
    }

    // 4. Validate Property Integrity & Count against reference
    if (referenceGvas && reReadGvas) {
      try {
        this.validatePropertyIntegrity(referenceGvas, reReadGvas);
      } catch (err) {
        errors.push(`Property Integrity Error: ${err.message}`);
      }
    }

    if (errors.length > 0) {
      let errorMsg =
        `Save Validation Failed with ${errors.length} error(s):\n` +
        errors.map((e) => ` - ${e}`).join("\n");
      let err = new Error(errorMsg);
      err.validationErrors = errors;
      throw err;
    }

    return { valid: true, errors: [] };
  }

  /**
   * Validate GVAS header magic, versions, and structure
   */
  static validateGvasHeader(buffer) {
    if (!buffer || buffer.length < 32) {
      throw new Error(
        "Save buffer is too small to contain a valid GVAS header",
      );
    }

    let magic = buffer.subarray(0, 4).toString("ascii");
    if (magic !== "GVAS") {
      throw new Error(`Invalid header magic: expected 'GVAS', got '${magic}'`);
    }

    let saveGameVersion = buffer.readInt32LE(4);
    if (saveGameVersion < 1 || saveGameVersion > 10) {
      throw new Error(`Invalid SaveGameVersion: ${saveGameVersion}`);
    }

    let packageVersion = buffer.readInt32LE(8);
    if (packageVersion < 100 || packageVersion > 1000) {
      throw new Error(`Invalid PackageVersion: ${packageVersion}`);
    }
  }

  /**
   * Validate Unreal package compression chunks (0x9E2A83C1, 128KB blocks, zlib inflate)
   */
  static validateCompressionBlocks(buffer) {
    let compPropIdx = buffer.indexOf(Buffer.from("compressedSaveData\0"));
    if (compPropIdx === -1) {
      throw new Error(
        "Missing 'compressedSaveData' property in compressed save",
      );
    }

    let off = compPropIdx + 19; // length of 'compressedSaveData\0'
    let typeLen = buffer.readInt32LE(off);
    off += 4;
    let type = buffer.subarray(off, off + typeLen).toString("utf8");
    off += typeLen;
    if (!type.startsWith("ArrayProperty")) {
      throw new Error(
        `Expected ArrayProperty for compressedSaveData, got ${type}`,
      );
    }

    let propSize = Number(buffer.readBigInt64LE(off));
    off += 8;
    let innerTypeLen = buffer.readInt32LE(off);
    off += 4;
    let innerType = buffer.subarray(off, off + innerTypeLen).toString("utf8");
    off += innerTypeLen;
    if (!innerType.startsWith("ByteProperty")) {
      throw new Error(`Expected ByteProperty inner type, got ${innerType}`);
    }

    let hasGuid = buffer.readUInt8(off);
    off += 1;
    let arrayCount = buffer.readInt32LE(off);
    off += 4;

    let rawChunkData = buffer.subarray(off, off + arrayCount);
    let chunkOffset = 0;
    let totalUncompressed = 0;
    let chunkIndex = 0;

    while (chunkOffset < rawChunkData.length) {
      if (chunkOffset + 48 > rawChunkData.length) break;
      let magic = rawChunkData.readBigUInt64LE(chunkOffset);
      let blockSize = Number(rawChunkData.readBigInt64LE(chunkOffset + 8));
      let compSize = Number(rawChunkData.readBigInt64LE(chunkOffset + 16));
      let uncompSize = Number(rawChunkData.readBigInt64LE(chunkOffset + 24));

      if (magic !== PACKAGE_FILE_TAG) {
        throw new Error(
          `Invalid chunk magic 0x${magic.toString(16)} at chunk index ${chunkIndex}`,
        );
      }
      if (blockSize !== 131072) {
        throw new Error(
          `Unexpected block size ${blockSize} at chunk index ${chunkIndex}`,
        );
      }
      if (compSize <= 0 || compSize > blockSize * 2) {
        throw new Error(
          `Invalid compressed chunk size ${compSize} at chunk index ${chunkIndex}`,
        );
      }

      let compData = rawChunkData.subarray(
        chunkOffset + 48,
        chunkOffset + 48 + compSize,
      );
      let inflated = zlib.inflateSync(compData);
      if (inflated.length !== uncompSize) {
        throw new Error(
          `Chunk ${chunkIndex} inflated size mismatch: expected ${uncompSize}, got ${inflated.length}`,
        );
      }

      totalUncompressed += inflated.length;
      chunkOffset += 48 + compSize;
      chunkIndex++;
    }

    if (chunkIndex === 0) {
      throw new Error("No compression chunks found");
    }
  }

  /**
   * Validate property count and structural integrity
   */
  static validatePropertyIntegrity(orig, rebuilt) {
    if (!orig.Properties || !rebuilt.Properties) return;

    let origTopCount = orig.Properties.Properties
      ? orig.Properties.Properties.length
      : 0;
    let rebuiltTopCount = rebuilt.Properties.Properties
      ? rebuilt.Properties.Properties.length
      : 0;

    if (origTopCount !== rebuiltTopCount) {
      throw new Error(
        `Top-level property count mismatch: expected ${origTopCount}, got ${rebuiltTopCount}`,
      );
    }

    // Check root saveData struct
    let origSaveData = orig.Properties.Properties[0];
    let rebuiltSaveData = rebuilt.Properties.Properties[0];
    if (origSaveData && rebuiltSaveData) {
      if (origSaveData.Name !== rebuiltSaveData.Name) {
        throw new Error(
          `Root property name mismatch: expected ${origSaveData.Name}, got ${rebuiltSaveData.Name}`,
        );
      }
      if (origSaveData.Properties && rebuiltSaveData.Properties) {
        if (
          origSaveData.Properties.length !== rebuiltSaveData.Properties.length
        ) {
          throw new Error(
            `saveData property count mismatch: expected ${origSaveData.Properties.length}, got ${rebuiltSaveData.Properties.length}`,
          );
        }
      }
    }
  }
}
