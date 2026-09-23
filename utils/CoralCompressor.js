import * as zlib from "zlib";

export const PACKAGE_FILE_TAG = BigInt("0x9E2A83C1");
export const DEFAULT_BLOCK_SIZE = 131072; // 128 KB

export class CoralCompressor {
  /**
   * Check if a buffer is a Coral Island compressed save file
   * @param {Buffer} buf
   * @returns {boolean}
   */
  static isCoralCompressed(buf) {
    if (!buf || buf.length < 32) return false;
    if (buf.subarray(0, 4).toString("ascii") !== "GVAS") return false;
    // Search first 2048 bytes for C_CompressedSaveGame or compressedSaveData
    let probe = buf.subarray(0, Math.min(buf.length, 2048)).toString("latin1");
    return (
      probe.includes("C_CompressedSaveGame") ||
      probe.includes("compressedSaveData")
    );
  }

  /**
   * Decompress the outer Coral Island GVAS save file into inner GVAS buffer and outer metadata
   * @param {Buffer} buf
   * @returns {{ innerBuffer: Buffer, outerMetadata: object }}
   */
  static decompress(buf) {
    if (!this.isCoralCompressed(buf)) {
      throw new Error("File is not a compressed Coral Island save file.");
    }

    // Find compressedSaveData property
    let compPropIdx = buf.indexOf(Buffer.from("compressedSaveData\0"));
    if (compPropIdx === -1) {
      throw new Error(
        "Could not find 'compressedSaveData' property in save file.",
      );
    }

    // Outer header is everything before the first property tag
    let headerEnd = compPropIdx - 4;
    let outerHeaderBuf = buf.subarray(0, headerEnd);

    // Read compressedSaveData tag
    let off = compPropIdx + 19; // length of 'compressedSaveData\0' is 19
    // Type
    let typeLen = buf.readInt32LE(off);
    off += 4;
    let type = buf.subarray(off, off + typeLen).toString("utf8");
    off += typeLen;
    let propSize = Number(buf.readBigInt64LE(off));
    off += 8;
    let innerTypeLen = buf.readInt32LE(off);
    off += 4;
    let innerType = buf.subarray(off, off + innerTypeLen).toString("utf8");
    off += innerTypeLen;
    let hasGuid = buf.readUInt8(off);
    off += 1;
    let arrayCount = buf.readInt32LE(off);
    off += 4;

    let rawChunkDataStart = off;
    let rawChunkDataEnd = off + arrayCount;
    let rawChunkData = buf.subarray(rawChunkDataStart, rawChunkDataEnd);

    // Decompress all chunks
    let chunkOffset = 0;
    let decompressedParts = [];
    let chunkCount = 0;

    while (chunkOffset < rawChunkData.length) {
      if (chunkOffset + 48 > rawChunkData.length) {
        break;
      }
      let magic = rawChunkData.readBigUInt64LE(chunkOffset);
      let blockSize = Number(rawChunkData.readBigInt64LE(chunkOffset + 8));
      let compSize = Number(rawChunkData.readBigInt64LE(chunkOffset + 16));
      let uncompSize = Number(rawChunkData.readBigInt64LE(chunkOffset + 24));

      if (magic !== PACKAGE_FILE_TAG) {
        throw new Error(
          `Invalid compression chunk magic: 0x${magic.toString(16)} at chunk ${chunkCount}`,
        );
      }

      let compData = rawChunkData.subarray(
        chunkOffset + 48,
        chunkOffset + 48 + compSize,
      );
      let decompressed = zlib.inflateSync(compData);
      if (decompressed.length !== uncompSize) {
        throw new Error(
          `Chunk ${chunkCount} uncompressed size mismatch: expected ${uncompSize}, got ${decompressed.length}`,
        );
      }

      decompressedParts.push(decompressed);
      chunkOffset += 48 + compSize;
      chunkCount++;
    }

    let fullUncompressed = Buffer.concat(decompressedParts);
    // The first 4 bytes of fullUncompressed is the payload size
    let payloadSize = fullUncompressed.readInt32LE(0);
    let innerGvasBuffer = fullUncompressed.subarray(4);

    if (innerGvasBuffer.length !== payloadSize) {
      // Some saves might have slight trailing padding, but let's take exact payloadSize if valid
      if (innerGvasBuffer.length >= payloadSize) {
        innerGvasBuffer = innerGvasBuffer.subarray(0, payloadSize);
      }
    }

    // Capture trailing bytes after compressedSaveData (e.g. Version property, None, EOF marker)
    let trailingBuf = buf.subarray(rawChunkDataEnd);

    let outerMetadata = {
      outerHeaderBuf,
      trailingBuf,
      chunkCount,
      blockSize: DEFAULT_BLOCK_SIZE,
    };

    return {
      innerBuffer: innerGvasBuffer,
      outerMetadata,
    };
  }

  /**
   * Compress the inner GVAS buffer and wrap it in the outer Coral Island GVAS container
   * @param {Buffer} innerBuffer
   * @param {object} outerMetadata
   * @returns {Buffer}
   */
  static compress(innerBuffer, outerMetadata) {
    const blockSize =
      (outerMetadata && outerMetadata.blockSize) || DEFAULT_BLOCK_SIZE;

    // Prepend 4-byte payload size (innerBuffer.length)
    let payloadSizeBuf = Buffer.alloc(4);
    payloadSizeBuf.writeInt32LE(innerBuffer.length, 0);
    let uncompressedData = Buffer.concat([payloadSizeBuf, innerBuffer]);

    // Compress in 128KB chunks
    let compressedChunks = [];
    for (let i = 0; i < uncompressedData.length; i += blockSize) {
      let slice = uncompressedData.subarray(
        i,
        Math.min(i + blockSize, uncompressedData.length),
      );
      let deflated = zlib.deflateSync(slice);

      let header = Buffer.alloc(48);
      header.writeBigUInt64LE(PACKAGE_FILE_TAG, 0);
      header.writeBigInt64LE(BigInt(blockSize), 8);
      header.writeBigInt64LE(BigInt(deflated.length), 16);
      header.writeBigInt64LE(BigInt(slice.length), 24);
      header.writeBigInt64LE(BigInt(deflated.length), 32);
      header.writeBigInt64LE(BigInt(slice.length), 40);

      compressedChunks.push(header);
      compressedChunks.push(deflated);
    }

    let fullCompressedData = Buffer.concat(compressedChunks);

    // Build compressedSaveData property tag
    // Name: "compressedSaveData\0"
    let name = Buffer.from("compressedSaveData\0", "utf8");
    let nameLenBuf = Buffer.alloc(4);
    nameLenBuf.writeInt32LE(name.length, 0);

    // Type: "ArrayProperty\0"
    let type = Buffer.from("ArrayProperty\0", "utf8");
    let typeLenBuf = Buffer.alloc(4);
    typeLenBuf.writeInt32LE(type.length, 0);

    // Size: 4 (array count) + fullCompressedData.length
    let propSize = fullCompressedData.length + 4;
    let sizeBuf = Buffer.alloc(8);
    sizeBuf.writeBigInt64LE(BigInt(propSize), 0);

    // InnerType: "ByteProperty\0"
    let innerType = Buffer.from("ByteProperty\0", "utf8");
    let innerTypeLenBuf = Buffer.alloc(4);
    innerTypeLenBuf.writeInt32LE(innerType.length, 0);

    // HasGuid (0)
    let hasGuidBuf = Buffer.alloc(1);
    hasGuidBuf.writeUInt8(0, 0);

    // ArrayCount (int32)
    let countBuf = Buffer.alloc(4);
    countBuf.writeInt32LE(fullCompressedData.length, 0);

    let propTagBuf = Buffer.concat([
      nameLenBuf,
      name,
      typeLenBuf,
      type,
      sizeBuf,
      innerTypeLenBuf,
      innerType,
      hasGuidBuf,
      countBuf,
    ]);

    let outerHeaderBuf = outerMetadata ? outerMetadata.outerHeaderBuf : null;
    let trailingBuf = outerMetadata ? outerMetadata.trailingBuf : null;

    if (outerHeaderBuf && !Buffer.isBuffer(outerHeaderBuf)) {
      if (outerHeaderBuf.data && Array.isArray(outerHeaderBuf.data)) {
        outerHeaderBuf = Buffer.from(outerHeaderBuf.data);
      } else if (typeof outerHeaderBuf === "string") {
        outerHeaderBuf = Buffer.from(outerHeaderBuf, "base64");
      }
    }

    if (trailingBuf && !Buffer.isBuffer(trailingBuf)) {
      if (trailingBuf.data && Array.isArray(trailingBuf.data)) {
        trailingBuf = Buffer.from(trailingBuf.data);
      } else if (typeof trailingBuf === "string") {
        trailingBuf = Buffer.from(trailingBuf, "base64");
      }
    }

    if (!trailingBuf) {
      // Default trailing: Version (IntProperty = 220), None, 00000000
      trailingBuf = Buffer.from(
        "0800000056657273696f6e000c000000496e7450726f706572747900040000000000000000dc000000050000004e6f6e650000000000",
        "hex",
      );
    }

    return Buffer.concat([
      outerHeaderBuf,
      propTagBuf,
      fullCompressedData,
      trailingBuf,
    ]);
  }
}
