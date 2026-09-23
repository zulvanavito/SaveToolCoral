export class Serializer {
  constructor(buf) {
    this._data = buf || Buffer.alloc(0);
    this._offset = 0;
  }
  get Data() {
    return this._data;
  }
  get tell() {
    return this._offset;
  }
  set tell(val) {
    this._offset = val;
  }

  _ensureCapacity(needed) {
    if (this._offset + needed > this._data.length) {
      let newSize = Math.max(
        this._data.length * 2,
        this._offset + needed + 1024,
      );
      let newBuf = Buffer.alloc(newSize);
      this._data.copy(newBuf, 0, 0, this._offset);
      this._data = newBuf;
    }
  }

  seek(count) {
    let target = this._offset + count;
    if (target > this._data.length) {
      this._ensureCapacity(count);
    }
    this._offset = target;
    return this._offset;
  }

  read(count) {
    if (this._offset + count > this._data.length) {
      throw new Error(
        `Reached end of Buffer: attempted to read ${count} bytes at offset 0x${this.tell.toString(16)} (buffer length ${this._data.length})`,
      );
    }
    let start = this._offset;
    this._offset += count;
    return this._data.subarray(start, this._offset);
  }

  readBytes(count) {
    return this.read(count);
  }

  readInt32() {
    let int = this._data.readInt32LE(this._offset);
    this._offset += 4;
    return int;
  }

  readUInt32() {
    let int = this._data.readUInt32LE(this._offset);
    this._offset += 4;
    return int;
  }

  readInt16() {
    let int = this._data.readInt16LE(this._offset);
    this._offset += 2;
    return int;
  }

  readUInt16() {
    let int = this._data.readUInt16LE(this._offset);
    this._offset += 2;
    return int;
  }

  readUInt8() {
    let int = this._data.readUInt8(this._offset);
    this._offset += 1;
    return int;
  }

  readInt8() {
    let int = this._data.readInt8(this._offset);
    this._offset += 1;
    return int;
  }

  readFloat() {
    let float = this._data.readFloatLE(this._offset);
    this._offset += 4;
    return float;
  }

  readDouble() {
    let double = this._data.readDoubleLE(this._offset);
    this._offset += 8;
    return double;
  }

  readInt64() {
    let int = this._data.readBigInt64LE(this._offset);
    this._offset += 8;
    return int;
  }

  readUInt64() {
    let int = this._data.readBigUInt64LE(this._offset);
    this._offset += 8;
    return int;
  }

  readString() {
    let length = this.readInt32();
    if (length === 0) return "";
    if (length > 0) {
      return this.read(length).toString("utf8");
    } else {
      let uLen = -length * 2;
      return this.read(uLen).toString("utf16le");
    }
  }

  write(buf) {
    if (!buf) return;
    this._ensureCapacity(buf.length);
    let written = buf.copy(this._data, this._offset);
    this._offset += written;
  }

  writeBytes(buf) {
    this.write(buf);
  }

  writeInt32(num) {
    this._ensureCapacity(4);
    this._offset = this._data.writeInt32LE(num, this._offset);
  }

  writeUInt32(num) {
    this._ensureCapacity(4);
    this._offset = this._data.writeUInt32LE(num, this._offset);
  }

  writeInt16(num) {
    this._ensureCapacity(2);
    this._offset = this._data.writeInt16LE(num, this._offset);
  }

  writeUInt16(num) {
    this._ensureCapacity(2);
    this._offset = this._data.writeUInt16LE(num, this._offset);
  }

  writeUInt8(byte) {
    this._ensureCapacity(1);
    this._offset = this._data.writeUInt8(byte, this._offset);
  }

  writeInt8(byte) {
    this._ensureCapacity(1);
    this._offset = this._data.writeInt8(byte, this._offset);
  }

  writeFloat(num) {
    this._ensureCapacity(4);
    this._offset = this._data.writeFloatLE(num, this._offset);
  }

  writeDouble(num) {
    this._ensureCapacity(8);
    this._offset = this._data.writeDoubleLE(num, this._offset);
  }

  writeInt64(num) {
    this._ensureCapacity(8);
    this._offset = this._data.writeBigInt64LE(BigInt(num), this._offset);
  }

  writeUInt64(num) {
    this._ensureCapacity(8);
    this._offset = this._data.writeBigUInt64LE(BigInt(num), this._offset);
  }

  writeString(str) {
    if (!str || str.length === 0) {
      this.writeInt32(0);
      return;
    }
    // If string does not end with null character and is an FName/FString, keep as is if already has \0,
    // or add null terminator if standard ASCII/UTF-8
    let toWrite = str;
    if (!toWrite.endsWith("\0")) {
      toWrite = toWrite + "\0";
    }
    let byteLen = Buffer.byteLength(toWrite, "utf8");
    this.writeInt32(byteLen);
    this._ensureCapacity(byteLen);
    this._offset += this._data.write(toWrite, this._offset, "utf8");
  }

  append(buf) {
    this._data = Buffer.concat([this.getWrittenBuffer(), buf]);
    this._offset = this._data.length;
  }

  getWrittenBuffer() {
    return this._data.subarray(0, this._offset);
  }

  static alloc(size) {
    return new Serializer(Buffer.alloc(size));
  }
}
